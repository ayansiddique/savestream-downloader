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

const getYTCommand = () => {
    if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
    return 'yt-dlp';
};

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running - High Quality Mode v8.0");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) return res.json(cachedData.data);
  }

  // Optimized for High Resolution Discovery
  let args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    "--extractor-args", "youtube:player_client=android,web,ios;player_skip=configs",
    url
  ];

  const ytdlp = spawn(getYTCommand(), args);
  let stdoutData = "";
  let stderrData = "";

  const timeout = setTimeout(() => { ytdlp.kill(); }, 55000);

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      return res.status(500).json({ error: "Analysis Failed: Linking issue or restricted." });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      
      // Professional Quality Extraction: No strict MP4 filtering here to allow 1080p/4k
      const formats = (data.formats || [])
        .filter(f => f.vcodec !== 'none') 
        .map(f => {
          let resolution = "Unknown";
          if (f.height) resolution = `${f.height}p`;
          else if (f.resolution) resolution = f.resolution;

          return {
            format_id: f.format_id,
            height: f.height || 0,
            resolution: resolution,
            ext: 'mp4', // We tell the user it's MP4 because we remux it on download
            size: f.filesize || f.filesize_approx || 0,
            hasAudio: f.acodec !== 'none'
          };
        });

      const qualities = [];
      const seen = new Set();
      
      // Sort strictly by height (1080, 720, 480...)
      formats.sort((a, b) => b.height - a.height).forEach(f => {
        if (!f.height) return;
        const label = `${f.height}p`;
        if (!seen.has(label)) {
          seen.add(label);
          qualities.push({
            label: label,
            format_id: f.format_id,
            ext: 'mp4',
            size: f.size,
            hasAudio: f.hasAudio
          });
        }
      });

      const responseData = {
        title: data.title,
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities.slice(0, 12), // Show more quality levels
        audio: { format_id: 'bestaudio', ext: 'mp3', size: 0 }
      };

      infoCache.set(url, { timestamp: Date.now(), data: responseData });
      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "Analysis Failed: Unable to parse video data" });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  const isAudioOnly = ext === 'mp3';
  
  // High-Quality Download Logic: Best video (any codec) + Best audio -> MP4 Container
  const formatArg = isAudioOnly 
    ? "bestaudio/best" 
    : (format_id && format_id !== 'best' 
        ? `${format_id}+bestaudio/best` 
        : "bestvideo+bestaudio/best");

  const tempFilePath = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${isAudioOnly ? 'mp3' : 'mp4'}`);
  
  const args = isAudioOnly 
    ? ["-f", formatArg, "--extract-audio", "--audio-format", "mp3", "--no-check-certificate", "-o", tempFilePath, url]
    : ["-f", formatArg, "--merge-output-format", "mp4", "--remux-video", "mp4", "--no-check-certificate", "-o", tempFilePath, url];

  console.log(`[DOWNLOAD] High-Quality Mode: ${url}`);
  const ytdlp = spawn(getYTCommand(), args);

  ytdlp.on("close", (code) => {
    if (code !== 0) return res.status(500).send('Download failed');
    res.download(tempFilePath, `SaveStream_${isAudioOnly ? 'Audio.mp3' : 'Video.mp4'}`, () => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
