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

const getYTCommand = () => {
    if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
    return 'yt-dlp';
};

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running - Ultimate Solution v20.0 (Live)");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // Ultimate Stealth Headers
  const randomIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  
  let args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--geo-bypass",
    "--force-ipv4"
  ];

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    // IOS client is currently the MOST resilient for bot detection
    args.push("--extractor-args", "youtube:player_client=ios,android;player_skip=configs");
    args.push("--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1");
    args.push("--add-header", `X-Forwarded-For:${randomIP}`);
  } else if (url.includes('tiktok.com')) {
    args.push("--add-header", "Referer:https://www.tiktok.com/");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else {
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  }

  args.push(url);

  console.log(`[V20 NUCLEAR] Analyzing: ${url}`);
  const ytdlp = spawn(getYTCommand(), args);
  
  let stdoutData = "";
  let stderrData = "";
  const timeout = setTimeout(() => { ytdlp.kill(); }, 55000);

  ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
  ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      const errorMsg = stderrData.trim();
      let userError = "Analysis Failed";
      if (errorMsg.includes("confirm you're not a bot")) userError = "YouTube is currently blocking the server. Please try a TikTok/Instagram link or wait 10 minutes.";
      else userError = `Analysis Failed: ${errorMsg.split('\n')[0].substring(0, 100)}`;
      return res.status(500).json({ error: userError });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const rawFormats = data.formats || [];
      const seenLabels = new Set();
      let qualities = [];

      // Improved Format Parsing: Ensures buttons ALWAYS show for video
      rawFormats.forEach(f => {
        // If it's a pure audio stream, skip it for the video tab
        if (f.vcodec === 'none') return;
        
        const w = f.width || 0;
        const h = f.height || 0;
        const resVal = Math.min(w, h) || h || w || 0;
        
        // Basic label calculation
        let label = resVal > 0 ? `${resVal}p` : "HD Video";
        if (resVal >= 1080) label = "1080p Full HD";
        else if (resVal >= 720) label = "720p HD";

        if (!seenLabels.has(label)) {
          seenLabels.add(label);
          qualities.push({
            label: label,
            format_id: f.format_id || 'best',
            ext: 'mp4',
            size: f.filesize || f.filesize_approx || 0,
            hasAudio: true
          });
        }
      });

      // Special fallback if no qualities were found but we have video info
      if (qualities.length === 0) {
        qualities.push({ label: "Best Quality", format_id: "best", ext: "mp4", size: 0, hasAudio: true });
      }

      qualities.sort((a, b) => (parseInt(b.label) || 0) - (parseInt(a.label) || 0));

      const bestAudio = rawFormats.filter(f => f.vcodec === 'none')
        .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

      const responseData = {
        title: data.title || "Video",
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities.slice(0, 10),
        audio: { format_id: bestAudio ? bestAudio.format_id : 'bestaudio', ext: 'mp3', size: 0 }
      };

      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "Failed to parse platform data." });
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
    res.download(tempFilePath, `savestream_media.${ext}`, () => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
