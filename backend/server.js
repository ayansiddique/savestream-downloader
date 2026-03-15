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
  res.send("SaveStream Backend Running - Bypass Active");
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

  // Advanced Bypass for Data Center IPs (Railway/AWS)
  const args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    "--geo-bypass",
    // Mimic the mobile YouTube player client to bypass "bot" detection
    "--extractor-args", "youtube:player_client=ios,web",
    "--add-header", "User-Agent:Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    "--add-header", "Accept-Language:en-US,en;q=0.9",
    url
  ];

  const ytdlp = spawn(getYTCommand(), args);
  let stdoutData = "";
  let stderrData = "";

  const timeout = setTimeout(() => {
    ytdlp.kill();
  }, 45000); // Increased timeout for bypass evaluation

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      console.error(`[ERROR] Code ${code}:`, stderrData);
      
      let errorMessage = "Analysis Failed";
      if (stderrData.includes("confirm you're not a bot")) errorMessage = "Analysis Failed: Platform is blocking the request. Try again in a minute.";
      else if (stderrData.includes("Sign in to confirm your age")) errorMessage = "Analysis Failed: Age restricted video.";
      else errorMessage = `Analysis Failed: ${stderrData.split('\n')[0].substring(0, 100)}`;

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
      res.status(500).json({ error: "Failed to parse video data" });
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
