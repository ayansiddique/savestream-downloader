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
const getYTCommand = () => {
    if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
    return 'yt-dlp';
};

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running - Global Bypass v19.0 (Live)");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const randomIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

  // Multi-Platform Bypass Configurations
  let args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--geo-bypass",
    "--force-ipv4"
  ];

  // Specific Logic for YouTube (v18 stealth logic)
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    args.push("--extractor-args", "youtube:player_client=mweb,android_vr;player_skip=configs");
    args.push("--add-header", `X-Forwarded-For:${randomIP}`);
    args.push("--add-header", "Accept-Language:en-US,en;q=0.9");
    args.push("--user-agent", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36");
  } 
  // Specific Logic for TikTok (The Status 0 Fix)
  else if (url.includes('tiktok.com')) {
    args.push("--add-header", "Referer:https://www.tiktok.com/");
    args.push("--add-header", "Accept-Language:en-US,en;q=0.9");
    // Use desktop UA for better TikTok stability on servers
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
  }
  // Generic Logic
  else {
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  }

  args.push(url);

  console.log(`[V19 GLOBAL] Analyzing URL: ${url}`);
  const ytdlp = spawn(getYTCommand(), args);
  
  let stdoutData = "";
  let stderrData = "";
  const timeout = setTimeout(() => { ytdlp.kill(); }, 60000);

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      const errorMsg = stderrData.trim();
      console.error(`[ERROR]`, errorMsg);
      
      let userError = "Analysis Failed";
      if (errorMsg.includes("confirm you're not a bot")) {
        userError = "Analysis Failed: YouTube is blocking the server. Please try a different video.";
      } else if (errorMsg.includes("status code 0") || errorMsg.includes("Video not available")) {
        userError = "Analysis Failed: Platform (TikTok/Instagram) restricted the connection. Please try again.";
      } else {
        userError = `Analysis Failed: ${errorMsg.split('\n')[0].substring(0, 140)}`;
      }

      return res.status(500).json({ error: userError });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const rawFormats = data.formats || [];
      const seenLabels = new Set();
      const qualities = [];

      rawFormats.sort((a, b) => (b.height || 0) - (a.height || 0));

      rawFormats.forEach(f => {
        if (!f.vcodec || f.vcodec === 'none') return;
        const w = f.width || 0;
        const h = f.height || 0;
        // Correct 1080p label for Vertical (Shorts/TikTok) and Horizontal
        const labelVal = Math.min(w, h) || h || w;
        if (labelVal < 140) return;
        
        const label = `${labelVal}p`;
        if (!seenLabels.has(label)) {
          seenLabels.add(label);
          qualities.push({
            label: label,
            format_id: f.format_id,
            ext: 'mp4',
            size: f.filesize || f.filesize_approx || 0,
            hasAudio: true
          });
        }
      });

      qualities.sort((a, b) => parseInt(b.label) - parseInt(a.label));

      const bestAudio = rawFormats.filter(f => f.vcodec === 'none' && f.acodec !== 'none')
        .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

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

      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "Analysis Failed: Please try a different link." });
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

  const tempFilePath = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${ext}`);
  
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
    res.download(tempFilePath, `video.${ext}`, () => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
