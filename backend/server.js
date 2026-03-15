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
app.use(cors());
app.use(express.json());

const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const MAX_CONCURRENT_DOWNLOADS = 3;
let activeDownloads = 0;
const downloadQueue = [];

const getYTCommand = () => {
    try {
        if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
        return 'yt-dlp';
    } catch (e) {
        return 'yt-dlp';
    }
};

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running - Enhanced Bypass v3.1");
});

app.get("/api/health", (req, res) => {
  const cmd = getYTCommand();
  const ytdlp = spawn(cmd, ["--version"]);
  let output = "";
  let error = "";
  ytdlp.stdout.on("data", (d) => output += d.toString());
  ytdlp.stderr.on("data", (d) => error += d.toString());
  ytdlp.on("close", (code) => {
    res.json({
      status: code === 0 ? "ready" : "error",
      version: output.trim(),
      error_details: error.trim(),
      path_used: cmd,
      timestamp: new Date().toISOString()
    });
  });
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) return res.json(cachedData.data);
  }

  // Advanced Bypass: Combining Android client with Web configs to confuse BOT detection
  const args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    "--geo-bypass",
    "--extractor-args", "youtube:player_client=android,web;player_skip=webpage,configs",
    "--add-header", "User-Agent:Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    "--add-header", "Accept-Language:en-US,en;q=0.9",
    url
  ];

  const ytdlp = spawn(getYTCommand(), args);
  let stdoutData = "";
  let stderrData = "";

  const timeout = setTimeout(() => {
    ytdlp.kill();
  }, 45000);

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      const cleanError = stderrData.trim();
      console.error(`[ERROR] Code ${code}:`, cleanError);
      
      let errorMessage = "Analysis Failed";
      if (cleanError.includes("confirm you're not a bot")) {
        errorMessage = "Analysis Failed: YouTube is blocking this server (Bot detection). Try another link or wait.";
      } else if (cleanError.includes("Sign in to confirm your age")) {
        errorMessage = "Analysis Failed: This video is age-restricted.";
      } else if (cleanError.length > 0) {
        errorMessage = `Analysis Failed: ${cleanError.split('\n')[0].substring(0, 150)}`;
      }

      return res.status(500).json({ error: errorMessage });
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
      formats.sort((a, b) => (b.size || 0) - (a.size || 0)).forEach(f => {
        const height = f.resolution.split('x')[1] || f.height;
        if (!height) return;
        const label = `${height}p`;
        if (!seen.has(label)) {
          seen.add(label);
          qualities.push({ label, format_id: f.format_id, ext: f.ext, size: f.size, hasAudio: f.hasAudio });
        }
      });

      const responseData = {
        title: data.title,
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities,
        audio: (data.formats || []).filter(f => f.vcodec === 'none' && f.acodec !== 'none')
          .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0] ? {
            format_id: (data.formats || []).filter(f => f.vcodec === 'none' && f.acodec !== 'none').sort((a, b) => (b.abr || 0) - (a.abr || 0))[0].format_id,
            ext: (data.formats || []).filter(f => f.vcodec === 'none' && f.acodec !== 'none').sort((a, b) => (b.abr || 0) - (a.abr || 0))[0].ext,
            size: (data.formats || []).filter(f => f.vcodec === 'none' && f.acodec !== 'none').sort((a, b) => (b.abr || 0) - (a.abr || 0))[0].filesize || (data.formats || []).filter(f => f.vcodec === 'none' && f.acodec !== 'none').sort((a, b) => (b.abr || 0) - (a.abr || 0))[0].filesize_approx
          } : null
      };

      infoCache.set(url, { timestamp: Date.now(), data: responseData });
      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "Failed to parse video data. YouTube might have changed its format." });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  const isAudioOnly = ext === 'mp3';
  const formatArg = isAudioOnly ? 'bestaudio' : (format_id ? `${format_id}+bestaudio/best` : 'bestvideo+bestaudio/best');
  const tempFilePath = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${ext}`);
  
  const args = isAudioOnly 
    ? ["-f", "bestaudio", "--extract-audio", "--audio-format", "mp3", "--no-check-certificate", "-o", tempFilePath, url]
    : ["-f", formatArg, "--merge-output-format", "mp4", "--no-check-certificate", "-o", tempFilePath, url];

  const ytdlp = spawn(getYTCommand(), args);
  ytdlp.on("close", (code) => {
    if (code !== 0) return res.status(500).send('Download failed');
    res.download(tempFilePath, `video.${ext}`, () => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
