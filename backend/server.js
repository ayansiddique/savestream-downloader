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
    if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
    return 'yt-dlp';
};

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running - Standard MP4 Mode");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) return res.json(cachedData.data);
  }

  // Optimized Analysis Flags
  const args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    "--format-sort", "ext:mp4:m4a", // Prioritize MP4 compatible formats
    "--extractor-args", "youtube:player_client=ios,web_embedded;player_skip=configs",
    url
  ];

  const ytdlp = spawn(getYTCommand(), args);
  let stdoutData = "";
  let stderrData = "";

  const timeout = setTimeout(() => { ytdlp.kill(); }, 50000);

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      return res.status(500).json({ error: "Analysis Failed: Please try again." });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const formats = (data.formats || [])
        .filter(f => f.vcodec !== 'none' && (f.resolution || (f.width && f.height))) 
        .map(f => ({
          format_id: f.format_id,
          resolution: f.resolution || `${f.width}x${f.height}`,
          ext: 'mp4',
          size: f.filesize || f.filesize_approx,
          hasAudio: f.acodec !== 'none'
        }));

      const qualities = [];
      const seen = new Set();
      formats.sort((a, b) => (b.size || 0) - (a.size || 0)).forEach(f => {
        const height = f.resolution.split('x')[1] || f.height || f.resolution;
        const label = height.toString().includes('p') ? height : `${height}p`;
        if (!seen.has(label)) {
          seen.add(label);
          qualities.push({ label, format_id: f.format_id, ext: 'mp4', size: f.size, hasAudio: f.hasAudio });
        }
      });

      const responseData = {
        title: data.title,
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities.slice(0, 8), // Top 8 qualities
        audio: { format_id: 'bestaudio', ext: 'mp3', size: 0 }
      };

      infoCache.set(url, { timestamp: Date.now(), data: responseData });
      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "Failed to parse data" });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  const isAudioOnly = ext === 'mp3';
  
  // Back to Standard MP4 logic that works natively on Windows/Mobile
  const formatArg = isAudioOnly 
    ? "bestaudio/best" 
    : (format_id && format_id !== 'best' 
        ? `${format_id}+bestaudio/best` 
        : "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best");

  const tempFilePath = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${isAudioOnly ? 'mp3' : 'mp4'}`);
  
  const args = isAudioOnly 
    ? ["-f", formatArg, "--extract-audio", "--audio-format", "mp3", "--no-check-certificate", "-o", tempFilePath, url]
    : ["-f", formatArg, "--merge-output-format", "mp4", "--remux-video", "mp4", "--no-check-certificate", "-o", tempFilePath, url];

  console.log(`[DOWNLOAD] Standard Mode: ${url}`);
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
