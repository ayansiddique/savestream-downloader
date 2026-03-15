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
  res.send("SaveStream Backend Running - Ultra Bypass v4.0");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) return res.json(cachedData.data);
  }

  // Base arguments for all extractions
  let args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    "--geo-bypass",
    "--add-header", "Accept-Language:en-US,en;q=0.9",
    "--add-header", "Sec-Ch-Ua-Platform:Windows",
    "--add-header", "Sec-Fetch-Mode:navigate"
  ];

  // Specific Logic for YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    args.push("--extractor-args", "youtube:player_client=ios,web_embedded;player_skip=configs");
    args.push("--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1");
  } 
  // Specific Logic for TikTok
  else if (url.includes('tiktok.com')) {
    args.push("--add-header", "Referer:https://www.tiktok.com/");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
  }
  // Generic Logic for others (Instagram, Facebook, etc.)
  else {
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
  }

  args.push(url);

  console.log(`[INFO] Extraction started for: ${url}`);
  const ytdlp = spawn(getYTCommand(), args);
  
  let stdoutData = "";
  let stderrData = "";

  const timeout = setTimeout(() => { ytdlp.kill(); }, 50000);

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      const errorMsg = stderrData.trim();
      console.error(`[ERROR] Extraction failed:`, errorMsg);
      
      let userError = "Analysis Failed";
      if (errorMsg.includes("confirm you're not a bot")) userError = "Analysis Failed: Platform is blocking the server. Please try a different video or wait.";
      else if (errorMsg.includes("Video not available") || errorMsg.includes("status code 0")) userError = "Analysis Failed: Video is restricted or platform is blocked.";
      else userError = `Analysis Failed: ${errorMsg.split('\n')[0].substring(0, 100)}`;

      return res.status(500).json({ error: userError });
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

      const audio = (data.formats || []).filter(f => f.vcodec === 'none' && f.acodec !== 'none')
        .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

      const responseData = {
        title: data.title,
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities,
        audio: audio ? { format_id: audio.format_id, ext: audio.ext, size: audio.filesize || audio.filesize_approx } : null
      };

      infoCache.set(url, { timestamp: Date.now(), data: responseData });
      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "Analysis Failed: Data parsing error." });
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
    res.download(tempFilePath, `SaveStream_${crypto.randomUUID()}.${ext}`, () => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
