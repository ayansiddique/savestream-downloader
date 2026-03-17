require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;
const ROOT_DIR = 'c:\\Users\\786\\Pictures\\free vedio downloader';
const SHARED_LOG = path.join(ROOT_DIR, 'ai_backend', 'server.log');
const YT_BINARY = path.join(ROOT_DIR, 'backend', 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');

// Log helper for AI consistency 
const logError = (msg) => {
    try {
        const entry = `[${new Date().toISOString()}] ERROR: ${msg}\n`;
        fs.appendFileSync(SHARED_LOG, entry);
    } catch (e) {
        console.error("Failed to write to log:", e);
    }
};

const logStatus = (msg) => {
    try {
        const entry = `[${new Date().toISOString()}] STATUS: ${msg}\n`;
        fs.appendFileSync(SHARED_LOG, entry);
    } catch (e) {}
};

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const getYTCommand = () => {
    if (fs.existsSync(YT_BINARY)) return YT_BINARY;
    return 'yt-dlp';
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const randomIP = () => `${Math.floor(Math.random()*200+10)}.${Math.floor(Math.random()*200+10)}.${Math.floor(Math.random()*200+10)}.${Math.floor(Math.random()*200+10)}`;

// Core extraction function - accepts any extra args
const runExtraction = (url, extraArgs) => new Promise((resolve, reject) => {
    const baseArgs = [
        "--dump-single-json",
        "--no-playlist",
        "--no-warnings",
        "--skip-download",
        "--no-check-certificate",
        "--geo-bypass",
        "--force-ipv4",
        ...extraArgs,
        url
    ];

    const ytdlp = spawn(getYTCommand(), baseArgs);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { ytdlp.kill(); reject(new Error("timeout")); }, 50000);

    ytdlp.stdout.on("data", d => stdout += d);
    ytdlp.stderr.on("data", d => stderr += d);
    ytdlp.on("close", code => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr.trim()));
    });
});

app.get("/", (req, res) => {
  res.send("SaveStream v34.0 - Auto-Retry Engine (Live)");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isTikTok = url.includes('tiktok.com');
  const isInsta = url.includes('instagram.com') || url.includes('facebook.com');

  // Clean connection - IP spoofing often triggers strict bot checks on DC IPs
  const commonArgs = [
    "--add-header", "Accept-Language:en-US,en;q=0.9"
  ];

  const youtubeClientSets = [
    // Attempt 1 — Default
    [],
    // Attempt 2 — iOS
    ["--extractor-args", "youtube:player_client=ios;player_skip=configs"],
    // Attempt 3 — Web
    ["--extractor-args", "youtube:player_client=web;player_skip=configs"],
    // Attempt 4 — Android
    ["--extractor-args", "youtube:player_client=android;player_skip=configs"],
    // Attempt 5 — Android VR
    ["--extractor-args", "youtube:player_client=android_vr;player_skip=configs"]
  ];

  const socialArgs = isTikTok
    ? [...commonArgs, "--add-header", "Referer:https://www.tiktok.com/", "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36"]
    : isInsta
    ? [...commonArgs, "--add-header", "Referer:https://www.instagram.com/", "--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"]
    : [...commonArgs, "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36"];

  let rawJson = null;
  let lastError = "";

  if (isYouTube) {
    for (let i = 0; i < youtubeClientSets.length; i++) {
      try {
        console.log(`[V34] YT attempt ${i + 1} (${youtubeClientSets[i].join(' ') || 'default'}) for: ${url}`);
        rawJson = await runExtraction(url, [...commonArgs, ...youtubeClientSets[i]]);
        break; // Success
      } catch (e) {
        lastError = e.message;
        const isBot = lastError.includes("bot") || lastError.includes("sign in") || lastError.includes("block");
        if (isBot && i < youtubeClientSets.length - 1) {
          console.warn(`[V34] Block detected on attempt ${i + 1}, trying next client...`);
          await sleep(1500);
        } else {
          // If it's a non-bot error (like private video), don't bother retrying clients
          if (!isBot) break;
        }
      }
    }
  } else {
    try {
      rawJson = await runExtraction(url, socialArgs);
    } catch (e) {
      lastError = e.message;
    }
  }

  if (!rawJson) {
    let msg;
    if (lastError.includes("bot") || lastError.includes("sign in")) {
      msg = "Analysis Failed: YouTube is temporarily blocking. Please wait 30 seconds and try again.";
      logError(`YouTube Block detected for ${url}. Error: ${lastError}`);
    } else if (lastError.includes("country") || lastError.includes("not available")) {
      msg = "Analysis Failed: This video is region-restricted.";
      logError(`Region Lock for ${url}. Error: ${lastError}`);
    } else if (lastError.includes("private") || lastError.includes("login")) {
      msg = "Analysis Failed: This video is private or login-protected.";
      logError(`Privacy Lock for ${url}. Error: ${lastError}`);
    } else {
      msg = "Analysis Failed: Could not load this video. Try a different link.";
      logError(`General Extraction Failure for ${url}. Error: ${lastError}`);
    }
    return res.status(500).json({ error: msg });
  }

  try {
    const data = JSON.parse(rawJson || '{}');
    const rawFormats = data.formats || [];
    const seenLabels = new Set();
    const qualities = [];

    rawFormats.forEach(f => {
      if (!f.vcodec || f.vcodec === 'none') return;
      const h = f.height || 0;
      const w = f.width || 0;
      const resVal = (w && h) ? Math.min(w, h) : (h || w);
      if (!resVal || resVal < 140) return;

      let label = `${resVal}p`;
      if (resVal >= 1080) label = "1080p HD";
      else if (resVal >= 720) label = "720p HD";
      else if (resVal >= 480) label = "480p";
      else if (resVal >= 360) label = "360p";

      if (!seenLabels.has(label)) {
        seenLabels.add(label);
        qualities.push({ label, format_id: f.format_id || 'best', ext: 'mp4', size: f.filesize || f.filesize_approx || 0 });
      }
    });

    if (qualities.length === 0) qualities.push({ label: "Best Quality", format_id: "best", ext: "mp4", size: 0 });
    qualities.sort((a, b) => parseInt(b.label) - parseInt(a.label));

    const bestAudio = rawFormats
      .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

    // Enhanced Thumbnail Selection (find largest)
    let bestThumbnail = data.thumbnail;
    if (data.thumbnails && data.thumbnails.length > 0) {
      const sortedThumbs = [...data.thumbnails].sort((a, b) => {
        const areaA = (a.width || 0) * (a.height || 0);
        const areaB = (b.width || 0) * (b.height || 0);
        return areaB - areaA;
      });
      bestThumbnail = sortedThumbs[0].url;
    }

    res.json({
      title: data.title || "Video",
      thumbnail: bestThumbnail,
      duration: data.duration,
      extractor: data.extractor,
      formats: qualities.slice(0, 10),
      audio: { format_id: bestAudio?.format_id || 'bestaudio', ext: 'mp3', size: bestAudio?.filesize || 0 }
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to parse video info. Please try again." });
  }
});

// Thumbnail download proxy (forces file download instead of browser open)
app.get('/api/download-thumbnail', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL required');
  try {
    const https = require('https');
    const http = require('http');
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (imgRes) => {
      const contentType = imgRes.headers['content-type'] || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      res.setHeader('Content-Disposition', `attachment; filename="thumbnail.${ext}"`);
      res.setHeader('Content-Type', contentType);
      imgRes.pipe(res);
    }).on('error', () => res.status(500).send('Failed to fetch thumbnail'));
  } catch (e) {
    res.status(500).send('Thumbnail download failed');
  }
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  const isAudio = ext === 'mp3';
  const fmt = isAudio
    ? "bestaudio/best"
    : (format_id && format_id !== 'best' ? `${format_id}+bestaudio/best` : "bestvideo+bestaudio/best");
  const out = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${ext}`);

  const args = ["-f", fmt, "--no-check-certificate", "--geo-bypass", "-o", out];
  if (!isAudio) args.push("--merge-output-format", "mp4", "--postprocessor-args", "ffmpeg:-c:a aac -b:a 192k");
  else args.push("--extract-audio", "--audio-format", "mp3");
  args.push(url);

  const ytdlp = spawn(getYTCommand(), args);
  ytdlp.on("close", code => {
    if (code !== 0) return res.status(500).send("Download failed. Please try again.");
    res.download(out, `savestream.${ext}`, () => {
      if (fs.existsSync(out)) fs.unlink(out, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`SaveStream v34 on port ${PORT}`);
    logStatus("SYSTEM_INITIALIZED: Backend is online and ready.");
});
