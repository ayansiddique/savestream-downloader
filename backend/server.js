require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable trust proxy for Railway/Load Balancers
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

// Root Health Check
app.get("/", (req, res) => {
  res.send("SaveStream Backend Running");
});

// GET: /api/test - Quick dependency check
app.get("/api/test", (req, res) => {
    exec("yt-dlp --version", (err, stdout) => {
        if (err) return res.status(500).send("yt-dlp not found: " + err.message);
        res.send("yt-dlp version: " + stdout.trim());
    });
});

// POST: /api/info - Fetch video metadata (Optimized for speed)
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  // Check Cache
  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) return res.json(cachedData.data);
  }

  // Optimized yt-dlp command
  const command = `yt-dlp --dump-single-json --no-playlist --no-warnings --skip-download --no-check-certificate --force-ipv4 "${url}"`;

  console.log(`Analyzing (Speed Mode): ${url}`);

  exec(command, { timeout: 20000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('yt-dlp Error:', stderr || error.message);
      return res.status(500).json({ 
        error: "Analysis Failed",
        message: stderr || error.message 
      });
    }

    try {
      const data = JSON.parse(stdout);
      
      // Extracting formats with resolution
      const formats = data.formats
        .filter(f => f.vcodec !== 'none' && (f.resolution || (f.width && f.height))) 
        .map(f => ({
          format_id: f.format_id,
          resolution: f.resolution || `${f.width}x${f.height}`,
          ext: f.ext,
          size: f.filesize || f.filesize_approx,
          hasAudio: f.acodec !== 'none'
        }));

      // Sort and group by unique resolution labels
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

      const audioFormats = data.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
      let bestAudio = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

      const responseData = {
        title: data.title,
        thumbnail: data.thumbnail || data.thumbnails?.[0]?.url,
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities,
        audio: bestAudio ? {
          format_id: bestAudio.format_id,
          ext: bestAudio.ext,
          size: bestAudio.filesize || bestAudio.filesize_approx
        } : null
      };

      // Save to cache
      infoCache.set(url, { timestamp: Date.now(), data: responseData });
      res.json(responseData);

    } catch (parseError) {
      console.error('Parse Error:', parseError.message);
      res.status(500).json({ error: "Failed to parse yt-dlp output" });
    }
  });
});

// GET: /api/download - Download file locally then stream
app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  if (!url) return res.status(400).send('URL is required');

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
      
      const cmd = isAudioOnly 
        ? `yt-dlp -f bestaudio --extract-audio --audio-format mp3 --no-check-certificate -o "${tempFilePath}" "${url}"`
        : `yt-dlp -f "${formatArg}" --merge-output-format mp4 --no-check-certificate -o "${tempFilePath}" "${url}"`;

      console.log(`Downloading: ${url}`);
      
      exec(cmd, (err) => {
        if (err) {
            console.error('Download Exec Error:', err.message);
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
