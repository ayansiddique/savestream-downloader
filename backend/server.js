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

// Clearing cache more frequently for testing
const infoCache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds only for now

const getYTCommand = () => {
    if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
    return 'yt-dlp';
};

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running - Quality Unlocker v13.0");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) return res.json(cachedData.data);
  }

  // The "True" High-Res Clients: tv and web_embedded are currently the best for 1080p+
  let args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    "--geo-bypass",
    "--extractor-args", "youtube:player_client=tv,web_embedded;player_skip=configs",
    "--add-header", "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    url
  ];

  console.log(`[QUALITY UNLOCK] Fetching Higher Res: ${url}`);
  const ytdlp = spawn(getYTCommand(), args);
  
  let stdoutData = "";
  let stderrData = "";
  const timeout = setTimeout(() => { ytdlp.kill(); }, 60000);

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      return res.status(500).json({ error: "Analysis Failed: Linking issue." });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const rawFormats = data.formats || [];
      const seenLabels = new Set();
      const qualities = [];

      // Sort by vertical resolution and quality metrics
      rawFormats.sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));

      rawFormats.forEach(f => {
        if (!f.vcodec || f.vcodec === 'none') return; 
        
        // Smart Logic for Vertical (Shorts) & Horizontal
        const w = f.width || 0;
        const h = f.height || 0;
        const resValue = Math.min(w, h) || h || w; // Picking the smaller side for label (1080 for vertical 1080x1920)
        
        if (resValue < 140) return;
        
        const label = `${resValue}p`;
        if (!seenLabels.has(label)) {
          seenLabels.add(label);
          qualities.push({
            label: label,
            format_id: f.format_id,
            ext: 'mp4',
            size: f.filesize || f.filesize_approx || 0,
            hasAudio: true // We merge audio during download always
          });
        }
      });

      // Sort labels: 4K (2160p) > 2K (1440p) > 1080p > 720p ...
      qualities.sort((a, b) => parseInt(b.label) - parseInt(a.label));

      const audioStreams = rawFormats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
      const bestAudio = audioStreams.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0];

      const responseData = {
        title: data.title,
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities.slice(0, 12),
        audio: { 
            format_id: bestAudio ? bestAudio.format_id : 'bestaudio', 
            ext: 'mp3', 
            size: bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx || 0) : 0 
        }
      };

      infoCache.set(url, { timestamp: Date.now(), data: responseData });
      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "Analysis Failed: High-res decoding error." });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  const isAudioOnly = ext === 'mp3';
  
  const formatArg = isAudioOnly 
    ? "bestaudio/best" 
    : (format_id && format_id !== 'best' 
        ? `${format_id}+bestaudio/best` 
        : "bestvideo+bestaudio/best");

  const tempFilePath = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${isAudioOnly ? 'mp3' : 'mp4'}`);
  
  const args = isAudioOnly 
    ? ["-f", formatArg, "--extract-audio", "--audio-format", "mp3", "--no-check-certificate", "-o", tempFilePath, url]
    : [
        "-f", formatArg, 
        "--merge-output-format", "mp4", 
        "--postprocessor-args", "ffmpeg:-c:a aac -b:a 192k", 
        "--no-check-certificate", 
        "-o", tempFilePath, 
        url
      ];

  const ytdlp = spawn(getYTCommand(), args);
  ytdlp.on("close", (code) => {
    if (code !== 0) return res.status(500).send('Download failed');
    res.download(tempFilePath, `video_${crypto.randomUUID()}.${isAudioOnly ? 'mp3' : 'mp4'}`, () => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
