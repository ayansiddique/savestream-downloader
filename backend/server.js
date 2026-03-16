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
  res.send("SaveStream Backend Running - Stable Power v27.0 (Live)");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const randomIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  
  let args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--geo-bypass",
    "--geo-bypass-country", "US",
    "--force-ipv4"
  ];

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    // Reverting to the most stable client combo for standard & restricted videos
    args.push("--extractor-args", "youtube:player_client=android,ios,web;player_skip=configs");
    args.push("--add-header", `X-Forwarded-For:${randomIP}`);
    args.push("--add-header", "Accept-Language:en-US,en;q=0.9");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else if (url.includes('instagram.com') || url.includes('facebook.com')) {
    args.push("--add-header", "Referer:https://www.instagram.com/");
    args.push("--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1");
  } else {
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  }

  args.push(url);

  console.log(`[V27 STABLE] Extraction for: ${url}`);
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
      if (errorMsg.includes("country") || errorMsg.includes("available")) {
         userError = "Analysis Failed: This video is heavily protected by YouTube. Please try another video link.";
      } else if (errorMsg.includes("bot")) {
         userError = "Analysis Failed: Server busy. Please wait 1 minute.";
      } else {
         userError = `Analysis Failed: Platform restricted.`;
      }
      return res.status(500).json({ error: userError });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const rawFormats = data.formats || [];
      const seenLabels = new Set();
      let qualities = [];

      rawFormats.forEach(f => {
        if (f.vcodec === 'none' || !f.vcodec) return;
        const resVal = Math.min(f.width || 0, f.height || 0) || f.height || f.width || 0;
        
        // Simple, Clean Labeling (Fixing "karab" buttons)
        if (resVal < 140) return;
        let label = `${resVal}p`;

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

      // Fallback for Insta/Facebook/Reddit
      if (qualities.length === 0) {
        qualities.push({ label: "High Quality", format_id: "best", ext: "mp4", size: 0 });
      }

      // Strict Sorting: 1080p > 720p > 480p ...
      qualities.sort((a, b) => (parseInt(b.label) || 0) - (parseInt(a.label) || 0));

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
      res.status(500).json({ error: "Analysis error. Try again." });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  const isAudioOnly = ext === 'mp3';
  const formatArg = isAudioOnly ? "bestaudio/best" : (format_id && format_id !== 'best' ? `${format_id}+bestaudio/best` : "best");
  const tempFilePath = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${ext}`);
  
  const args = [
    "-f", formatArg,
    "--no-check-certificate",
    "--geo-bypass",
    "-o", tempFilePath,
    url
  ];

  if (!isAudioOnly) {
     args.push("--merge-output-format", "mp4", "--postprocessor-args", "ffmpeg:-c:a aac -b:a 192k");
  } else {
     args.push("--extract-audio", "--audio-format", "mp3");
  }

  const ytdlp = spawn(getYTCommand(), args);
  ytdlp.on("close", (code) => {
    if (code !== 0) return res.status(500).send('Download failed');
    res.download(tempFilePath, `savestream_media.${ext}`, (err) => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
