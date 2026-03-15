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
  res.send("SaveStream Backend Running - Master High-Res v11.0");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) return res.json(cachedData.data);
  }

  // Back to most resilient multi-client strategy for bypassing blocks
  let args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    "--geo-bypass",
    "--extractor-args", "youtube:player_client=android_vr,ios,web,mweb,android;player_skip=configs",
    "--add-header", "Accept-Language:en-US,en;q=0.9",
    url
  ];

  console.log(`[MASTER INFO] Deep Extraction: ${url}`);
  const ytdlp = spawn(getYTCommand(), args);
  
  let stdoutData = "";
  let stderrData = "";
  const timeout = setTimeout(() => { ytdlp.kill(); }, 60000);

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      const errorStr = stderrData.trim();
      console.error(`[ERROR] yt-dlp failed:`, errorStr);
      
      let userError = "Analysis Failed";
      if (errorStr.includes("confirm you're not a bot")) userError = "Analysis Failed: Platform protected (Bot detected). Please try again in a few minutes.";
      else if (errorStr.includes("This video is unavailable")) userError = "Analysis Failed: Video is restricted or unavailable.";
      else userError = `Analysis Failed: ${errorStr.split('\n')[0].substring(0, 120)}`;

      return res.status(500).json({ error: userError });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const rawFormats = data.formats || [];
      const seenLabels = new Set();
      const qualities = [];

      // Sort raw formats by quality metrics
      rawFormats.sort((a, b) => (b.tbr || b.filesize || 0) - (a.tbr || a.filesize || 0));

      rawFormats.forEach(f => {
        if (!f.vcodec || f.vcodec === 'none') return; 
        
        // Smart Logic for Vertical and Horizontal videos
        const w = f.width || 0;
        const h = f.height || 0;
        const resValue = Math.min(w, h) || h || w;
        
        if (resValue < 140) return;
        
        const label = `${resValue}p`;
        if (!seenLabels.has(label)) {
          seenLabels.add(label);
          qualities.push({
            label: label,
            format_id: f.format_id,
            ext: 'mp4',
            size: f.filesize || f.filesize_approx || 0,
            hasAudio: f.acodec !== 'none' || f.audio_ext !== 'none'
          });
        }
      });

      qualities.sort((a, b) => parseInt(b.label) - parseInt(a.label));

      const audioStreams = rawFormats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
      const bestAudio = audioStreams.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0];

      const responseData = {
        title: data.title,
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities.slice(0, 15),
        audio: { 
            format_id: bestAudio ? bestAudio.format_id : 'bestaudio', 
            ext: 'mp3', 
            size: bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx || 0) : 0 
        }
      };

      infoCache.set(url, { timestamp: Date.now(), data: responseData });
      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "Analysis Failed: Could not process high-resolution signals." });
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
    : ["-f", formatArg, "--merge-output-format", "mp4", "--remux-video", "mp4", "--no-check-certificate", "-o", tempFilePath, url];

  const ytdlp = spawn(getYTCommand(), args);
  ytdlp.on("close", (code) => {
    if (code !== 0) return res.status(500).send('Download failed');
    res.download(tempFilePath, `video_${crypto.randomUUID()}.${ext}`, () => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
