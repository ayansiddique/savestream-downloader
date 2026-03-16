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

// Cookie file path (uploaded by admin via env or file)
const COOKIE_FILE = path.join(__dirname, 'cookies', 'youtube.txt');
const hasCookies = () => fs.existsSync(COOKIE_FILE) && fs.statSync(COOKIE_FILE).size > 100;

app.get("/", (req, res) => {
  res.send(`SaveStream v30.0 (Live) | Cookies: ${hasCookies() ? 'Active ✅' : 'Not Set ⚠️'}`);
});

// Cookie upload endpoint (Admin only, protected by env secret)
app.post('/api/admin/upload-cookies', express.text({ limit: '5mb', type: '*/*' }), (req, res) => {
    const authHeader = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_KEY || 'savestream_admin_2025';
    if (authHeader !== expectedKey) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const cookieDir = path.join(__dirname, 'cookies');
        if (!fs.existsSync(cookieDir)) fs.mkdirSync(cookieDir, { recursive: true });
        fs.writeFileSync(COOKIE_FILE, req.body);
        res.json({ success: true, message: `Cookie file saved (${req.body.length} bytes)` });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save cookie file' });
    }
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
    "--force-ipv4"
  ];

  // Use cookies if available (THE PERMANENT FIX)
  if (hasCookies()) {
    args.push("--cookies", COOKIE_FILE);
    console.log("[V30] Using cookie-based auth for extraction");
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    args.push("--extractor-args", "youtube:player_client=android,ios;player_skip=configs");
    args.push("--add-header", `X-Forwarded-For:${randomIP}`);
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else if (url.includes('instagram.com') || url.includes('facebook.com')) {
    args.push("--add-header", "Referer:https://www.instagram.com/");
    args.push("--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1");
  } else {
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  }

  args.push(url);

  console.log(`[V30] Analyzing: ${url}`);
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
      let userError;
      if (errorMsg.includes("bot") || errorMsg.includes("sign in")) {
        userError = hasCookies()
          ? "Analysis Failed: Cookie expired. Please refresh cookies."
          : "Analysis Failed: YouTube requires authentication. Admin must upload cookies.";
      } else if (errorMsg.includes("country") || errorMsg.includes("available")) {
        userError = "Analysis Failed: Video is region-restricted.";
      } else {
        userError = "Analysis Failed: Platform is temporarily protected. Try again.";
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
        if (resVal < 140) return;

        let label = `${resVal}p`;
        if (resVal >= 1080) label = "1080p Full HD";
        else if (resVal >= 720) label = "720p HD";

        if (!seenLabels.has(label)) {
          seenLabels.add(label);
          qualities.push({
            label,
            format_id: f.format_id || 'best',
            ext: 'mp4',
            size: f.filesize || f.filesize_approx || 0
          });
        }
      });

      if (qualities.length === 0) {
        qualities.push({ label: "Best Quality", format_id: "best", ext: "mp4", size: 0 });
      }

      qualities.sort((a, b) => (parseInt(b.label) || 0) - (parseInt(a.label) || 0));

      res.json({
        title: data.title || "Video",
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities.slice(0, 10),
        audio: { format_id: 'bestaudio', ext: 'mp3' }
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to parse video info." });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  const isAudioOnly = ext === 'mp3';
  const formatArg = isAudioOnly ? "bestaudio/best" : (format_id && format_id !== 'best' ? `${format_id}+bestaudio/best` : "best");
  const tempFilePath = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${ext}`);

  const args = ["-f", formatArg, "--no-check-certificate", "--geo-bypass", "-o", tempFilePath];

  // Use cookies for download too if available
  if (hasCookies()) args.push("--cookies", COOKIE_FILE);

  if (!isAudioOnly) {
    args.push("--merge-output-format", "mp4", "--postprocessor-args", "ffmpeg:-c:a aac -b:a 192k");
  } else {
    args.push("--extract-audio", "--audio-format", "mp3");
  }

  args.push(url);

  const ytdlp = spawn(getYTCommand(), args);
  ytdlp.on("close", (code) => {
    if (code !== 0) return res.status(500).send('Download failed');
    res.download(tempFilePath, `savestream_media.${ext}`, () => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} | Cookies: ${hasCookies() ? 'Active' : 'Not Set'}`);
});
