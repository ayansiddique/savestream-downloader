require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

app.set('trust proxy', 1);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const MAX_CONCURRENT_DOWNLOADS = 3;
let activeDownloads = 0;
const downloadQueue = [];

const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
};

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running - v2.1");
});

// Health check to verify yt-dlp version
app.get("/api/health", (req, res) => {
  const YTDLP_PATH = '/usr/local/bin/yt-dlp';
  const ytdlp = spawn(YTDLP_PATH, ["--version"]);
  let output = "";
  ytdlp.stdout.on("data", (d) => output += d.toString());
  ytdlp.on("close", (code) => {
    res.json({
      status: code === 0 ? "ready" : "error",
      version: output.trim(),
      port: PORT,
      timestamp: new Date().toISOString()
    });
  });
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Valid URL is required' });
  }

  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      return res.json(cachedData.data);
    }
  }

  // Professional flags for bypass and stability
  const args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    url
  ];

  const YTDLP_PATH = '/usr/local/bin/yt-dlp';
  console.log(`[INFO] Spawning: ${YTDLP_PATH} ${args.join(' ')}`);

  const ytdlp = spawn(YTDLP_PATH, args);

  let stdoutData = "";
  let stderrData = "";

  const timeout = setTimeout(() => {
    ytdlp.kill();
    console.error(`[TIMEOUT] yt-dlp killed after 25s for: ${url}`);
  }, 25000);

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);

    if (code !== 0) {
      console.error(`[ERROR] yt-dlp failed (Code ${code}):`, stderrData);
      
      // Clean up common error messages for user
      let userFriendlyError = "Analysis Failed";
      if (stderrData.includes("Sign in to confirm your age")) userFriendlyError = "Age restricted content requires login.";
      else if (stderrData.includes("Video unavailable")) userFriendlyError = "This video is unavailable.";
      else if (stderrData.includes("403")) userFriendlyError = "Access denied by platform (Rate limited).";

      return res.status(500).json({ 
        error: userFriendlyError, 
        details: stderrData.split('\n')[0] 
      });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      
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
      console.error('[PARSE ERROR]:', parseError.message);
      res.status(500).json({ error: "Failed to parse video data" });
    }
  });
});

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
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
      if (downloadQueue.length > 0) {
        const nextTask = downloadQueue.shift();
        nextTask();
      }
    };

    try {
      res.header('Content-Disposition', `attachment; filename="SaveStream_${crypto.randomUUID()}.${ext}"`);
      
      const args = isAudioOnly 
        ? ["-f", "bestaudio", "--extract-audio", "--audio-format", "mp3", "--no-check-certificate", "-o", tempFilePath, url]
        : ["-f", formatArg, "--merge-output-format", "mp4", "--no-check-certificate", "-o", tempFilePath, url];

      console.log(`[DOWNLOAD] Starting: ${url}`);
      const YTDLP_PATH = '/usr/local/bin/yt-dlp';
      const ytdlpDownload = spawn(YTDLP_PATH, args);

      ytdlpDownload.on("close", (code) => {
        if (code !== 0) {
          if (!res.headersSent) res.status(500).send('Download failed');
          onComplete();
          return;
        }
        res.download(tempFilePath, isAudioOnly ? 'audio.mp3' : 'video.mp4', () => onComplete());
      });
    } catch (e) {
      console.error('[DOWNLOAD ERROR]:', e);
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
