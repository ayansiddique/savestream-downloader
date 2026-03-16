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
  res.send("SaveStream Backend Running - Global Support v23.0 (Live)");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const randomIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  
  // Robust arguments for Global Support & Geo-Bypass
  let args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--geo-bypass", // Bypasses country restrictions
    "--geo-bypass-country", "US", // Forces US region for restricted videos
    "--force-ipv4"
  ];

  // Logic based on platform
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    args.push("--extractor-args", "youtube:player_client=android,ios,web;player_skip=configs");
    args.push("--add-header", `X-Forwarded-For:${randomIP}`);
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else if (url.includes('instagram.com')) {
    args.push("--add-header", "Referer:https://www.instagram.com/");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else if (url.includes('tiktok.com')) {
    args.push("--add-header", "Referer:https://www.tiktok.com/");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else {
    // Generic logic for Reddit, Facebook, etc.
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  }

  args.push(url);

  console.log(`[V23 GLOBAL] Deep analysis for: ${url}`);
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
      let userError = "Analysis Failed";
      if (errorMsg.includes("country")) userError = "Video is region-locked. Our US-Bypass is attempting but fails for strict IDs.";
      else if (errorMsg.includes("login") || errorMsg.includes("bot")) userError = "Security check failed. Please try a different video.";
      else userError = `Analysis Failed: Platform restricted. Try again later.`;
      return res.status(500).json({ error: userError });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const rawFormats = data.formats || [];
      const seenLabels = new Set();
      let qualities = [];

      // Unified parsing logic
      rawFormats.forEach(f => {
        if (f.vcodec === 'none') return;
        const w = f.width || 0;
        const h = f.height || 0;
        const resVal = Math.min(w, h) || h || w || 0;
        
        let label = "Video";
        if (resVal >= 2160) label = "4K Ultra HD";
        else if (resVal >= 1080) label = "1080p Full HD";
        else if (resVal >= 720) label = "720p HD";
        else if (resVal >= 480) label = "480p SD";
        else if (resVal > 0) label = `${resVal}p`;

        if (!seenLabels.has(label)) {
          seenLabels.add(label);
          qualities.push({
            label: label,
            format_id: f.format_id || 'best',
            ext: 'mp4',
            size: f.filesize || f.filesize_approx || 0
          });
        }
      });

      // Fallback for Instagram/Reddit
      if (qualities.length === 0) {
        qualities.push({ label: "Best Available", format_id: "best", ext: "mp4", size: 0 });
      }

      qualities.sort((a, b) => {
          const order = ["4K", "1080", "720", "480", "360"];
          const getRank = (lbl) => {
            for(let i=0; i<order.length; i++) if(lbl.includes(order[i])) return i;
            return 99;
          };
          return getRank(a.label) - getRank(b.label);
      });

      const responseData = {
        title: data.title || "Social Video",
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities.slice(0, 10),
        audio: { format_id: 'bestaudio', ext: 'mp3' }
      };

      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "Failed to process video data." });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  const isAudioOnly = ext === 'mp3';
  
  const formatArg = isAudioOnly 
    ? "bestaudio/best" 
    : (format_id && format_id !== 'best' ? `${format_id}+bestaudio/best` : "best");

  const tempFilePath = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${ext}`);
  
  const args = [
    "-f", formatArg,
    "--no-check-certificate",
    "--geo-bypass",
    "-o", tempFilePath
  ];

  if (!isAudioOnly) {
     args.push("--merge-output-format", "mp4", "--postprocessor-args", "ffmpeg:-c:a aac -b:a 192k");
  } else {
     args.push("--extract-audio", "--audio-format", "mp3");
  }
  
  args.push(url);

  const ytdlp = spawn(getYTCommand(), args);
  ytdlp.on("close", (code) => {
    if (code !== 0) return res.status(500).send('Download failed');
    res.download(tempFilePath, `SaveStream_${crypto.randomUUID()}.${ext}`, (err) => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
