require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable trust proxy for Railway
app.set('trust proxy', 1);

// Configure CORS for Vercel and other frontends
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// In-memory cache for faster repeated requests
const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Queue for downloads to prevent server overload
const MAX_CONCURRENT_DOWNLOADS = 3;
let activeDownloads = 0;
const downloadQueue = [];

// Helper: Basic URL validation
const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
};

// Root Health Check
app.get("/", (req, res) => {
  res.send("SaveStream Backend Running");
});

// POST: /api/info - Fetch video metadata (Optimized using spawn for stability)
app.post('/api/info', async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Valid URL is required' });
  }

  // Check Cache
  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      return res.json(cachedData.data);
    }
    infoCache.delete(url);
  }

  const args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    url
  ];

  console.log(`Analyzing: ${url}`);

  const ytdlp = spawn("yt-dlp", args);

  let stdoutData = "";
  let stderrData = "";

  const timeout = setTimeout(() => {
    ytdlp.kill();
    console.error("yt-dlp timed out for:", url);
  }, 25000); // 25s timeout

  ytdlp.stdout.on("data", (chunk) => {
    stdoutData += chunk.toString();
  });

  ytdlp.stderr.on("data", (chunk) => {
    stderrData += chunk.toString();
  });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);

    if (code !== 0) {
      console.error("yt-dlp error:", stderrData);
      return res.status(500).json({ 
        error: "Analysis Failed", 
        message: stderrData.split('\n')[0] || "Unknown error occurred"
      });
    }

    try {
      const data = JSON.parse(stdoutData);
      
      const formats = (data.formats || [])
        .filter(f => f.vcodec !== 'none' && (f.resolution || (f.width && f.height))) 
        .map(f => ({
          format_id: f.format_id,
          resolution: f.resolution || `${f.width}x${f.height}`,
          ext: f.ext,
          size: f.filesize || f.filesize_approx,
          hasAudio: f.acodec !== 'none'
        }));

      const qualities = [];
      const seen = new Set();
      const sortedFormats = formats.sort((a, b) => (b.size || 0) - (a.size || 0));

      sortedFormats.forEach(f => {
        const height = f.resolution.split('x')[1] || f.height;
        if (!height) return;
        const label = `${height}p`;
        if (!seen.has(label)) {
          seen.add(label);
          qualities.push({
            label: label,
            format_id: f.format_id,
            ext: f.ext,
            size: f.size,
            hasAudio: f.hasAudio
          });
        }
      });

      const audioFormats = (data.formats || []).filter(f => f.vcodec === 'none' && f.acodec !== 'none');
      let bestAudio = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

      const responseData = {
        title: data.title,
        thumbnail: data.thumbnail || (data.thumbnails && data.thumbnails[0] ? data.thumbnails[0].url : null),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities,
        audio: bestAudio ? {
          format_id: bestAudio.format_id,
          ext: bestAudio.ext,
          size: bestAudio.filesize || bestAudio.filesize_approx
        } : null
      };

      infoCache.set(url, { timestamp: Date.now(), data: responseData });
      res.json(responseData);

    } catch (parseError) {
      console.error('Parse Error:', parseError.message);
      res.status(500).json({ error: "Failed to process video metadata" });
    }
  });
});

// GET: /api/download - Download file locally then stream
app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  if (!url || !isValidUrl(url)) return res.status(400).send('Valid URL is required');

  const isAudioOnly = ext === 'mp3';
  const formatArg = isAudioOnly ? 'bestaudio' : (format_id ? `${format_id}+bestaudio/best` : 'bestvideo+bestaudio/best');
  
  const startDownload = async () => {
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

    const tempFilePath = path.join(downloadsDir, `dl_${crypto.randomUUID()}.${ext}`);
    
    const onComplete = () => {
      activeDownloads--;
      if (fs.existsSync(tempFilePath)) {
          fs.unlink(tempFilePath, (err) => {
              if (err) console.error('Cleanup error:', err);
          });
      }
      if (downloadQueue.length > 0) {
        const next = downloadQueue.shift();
        next();
      }
    };

    try {
      res.header('Content-Disposition', `attachment; filename="SaveStream_Download.${ext}"`);
      
      const args = isAudioOnly 
        ? ["-f", "bestaudio", "--extract-audio", "--audio-format", "mp3", "--no-check-certificate", "-o", tempFilePath, url]
        : ["-f", formatArg, "--merge-output-format", "mp4", "--no-check-certificate", "-o", tempFilePath, url];

      console.log(`Downloading: ${url}`);
      
      const ytdlpDownload = spawn("yt-dlp", args);

      ytdlpDownload.on("close", (code) => {
        if (code !== 0) {
          if (!res.headersSent) res.status(500).send('Download failed');
          onComplete();
          return;
        }
        res.download(tempFilePath, isAudioOnly ? 'audio.mp3' : 'video.mp4', (err) => {
            if (err) console.error('Streaming error:', err);
            onComplete();
        });
      });
    } catch (e) {
      console.error('Download system error:', e);
      onComplete();
    }
  };

  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    downloadQueue.push(startDownload);
  } else {
    activeDownloads++;
    startDownload();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
