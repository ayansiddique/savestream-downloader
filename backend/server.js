require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const os = require('os');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = path.resolve(__dirname, '..');
const SHARED_LOG = path.join(ROOT_DIR, 'ai_backend', 'server.log');
const YT_BINARY = path.join(ROOT_DIR, 'backend', 'node_modules', 'yt-dlp-exec', 'bin', os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

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
    // Attempt 1 — Default (Fastest)
    [],
    // Attempt 2 — iOS (Best for Bypass)
    ["--extractor-args", "youtube:player_client=ios;player_skip=configs"],
    // Attempt 3 — Android (Reliable Fallback)
    ["--extractor-args", "youtube:player_client=android;player_skip=configs"]
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
        console.log(`[V34] YT info attempt ${i + 1} for: ${url}`);
        rawJson = await runExtraction(url, [...commonArgs, ...youtubeClientSets[i]]);
        break; // Success
      } catch (e) {
        lastError = e.message;
        const isBot = lastError.includes("bot") || lastError.includes("sign in") || lastError.includes("block");
        if (isBot && i < youtubeClientSets.length - 1) {
          console.warn(`[V34] Block detected on attempt ${i + 1}, trying next client...`);
          // No sleep - just try next client immediately for speed
        } else {
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
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const rawFormats = data.formats || [];
    
    // Better Quality Selection
    const qualities = [];
    const seenHeights = new Set();
    
    // Sort formats: best video quality first
    const sortedFormats = rawFormats.sort((a, b) => (b.height || 0) - (a.height || 0));

    sortedFormats.forEach(f => {
      if (!f.vcodec || f.vcodec === 'none') return;
      const h = f.height || 0;
      if (h < 140 || seenHeights.has(h)) return;
      
      seenHeights.add(h);
      let label = `${h}p`;
      if (h >= 1080) label += " HD";
      else if (h >= 720) label += " HD";

      // Calculate total size estimate (Video + Approx Audio)
      const audioSize = isYouTube ? 8 * 1024 * 1024 : 0; // Approx 8MB for audio on YT
      const totalSize = (f.filesize || f.filesize_approx || 0) + (f.acodec !== 'none' ? 0 : audioSize);

      qualities.push({ 
        label, 
        format_id: f.format_id, 
        ext: 'mp4', 
        size: totalSize,
        height: h
      });
    });

    // Ensure we have at least something
    if (qualities.length === 0) {
        qualities.push({ label: "Best Quality", format_id: "best", ext: "mp4", size: 0 });
    } else {
        // Sort final list by resolution descending
        qualities.sort((a, b) => b.height - a.height);
    }

    const bestAudio = rawFormats
      .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

    let bestThumbnail = data.thumbnail;
    if (data.thumbnails && data.thumbnails.length > 0) {
      // Filter out storyboard images (they are often large but blurry grids)
      // Also filter out any low-res auto-generated fragments
      const cleanThumbs = data.thumbnails.filter(t => 
        !t.url.includes('storyboard') && 
        !t.url.includes('twimg.com/video_thumb') // Example for Twitter low-res
      );
      
      const listToSort = cleanThumbs.length > 0 ? cleanThumbs : data.thumbnails;
      
      // Sort by area, but also check for YouTube high-res markers
      const sortedThumbs = [...listToSort].sort((a, b) => {
        // Boost for YouTube maxresdefault
        const aBoost = a.url.includes('maxresdefault') ? 10000000 : 0;
        const bBoost = b.url.includes('maxresdefault') ? 10000000 : 0;
        
        const areaA = ((a.width || 0) * (a.height || 0)) + aBoost;
        const areaB = ((b.width || 0) * (b.height || 0)) + bBoost;
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
    console.error("Info Parse Error:", e);
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

app.get('/api/download', async (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  if (!url) return res.status(400).send("URL required");

  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isAudio = ext === 'mp3';
  
  // Robust Format Selection
  let fmt = "bestvideo+bestaudio/best";
  if (isAudio) {
    fmt = "bestaudio/best";
  } else if (format_id && format_id !== 'best') {
    // If YouTube, combine specific video with best audio
    // We use [ext=m4a] for audio to avoid heavy re-encoding when merging into MP4
    fmt = isYouTube ? `${format_id}+bestaudio[ext=m4a]/bestaudio/best` : format_id;
  }
  
  const out = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${ext}`);
  
  if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
    fs.mkdirSync(path.join(__dirname, 'downloads'));
  }

  const args = [
    "-f", fmt, 
    "--no-check-certificate", 
    "--geo-bypass", 
    "--no-warnings",
    "--no-playlist",
    "-o", out
  ];

  if (isYouTube) {
    args.push("--extractor-args", "youtube:player_client=ios,android;player_skip=configs");
  }

  if (!isAudio) {
    args.push("--merge-output-format", "mp4");
    // Only use heavy postprocessing if strictly needed, otherwise trust yt-dlp merge
    args.push("--postprocessor-args", "ffmpeg:-c:a aac -b:a 128k");
  } else {
    args.push("--extract-audio", "--audio-format", "mp3");
  }

  args.push(url);

  console.log(`[V34] DOWNLOAD CMD: ${getYTCommand()} ${args.join(' ')}`);
  logStatus(`Download requested: ${url} (Format: ${fmt})`);

  const ytdlp = spawn(getYTCommand(), args);
  
  // 20 minute timeout for large files
  const timeout = setTimeout(() => {
    console.error("[V34] Download timed out");
    ytdlp.kill();
  }, 20 * 60 * 1000);

  ytdlp.stderr.on("data", d => {
    const err = d.toString();
    if (err.includes("ERROR") || err.includes("bot") || err.includes("sign message")) {
      console.error(`[V34] Download Error: ${err}`);
      logError(`Download failed for ${url}: ${err}`);
    }
  });

  ytdlp.on("close", code => {
    clearTimeout(timeout);
    if (code === 0 && fs.existsSync(out)) {
      console.log(`[V34] Download finished: ${out}`);
      res.download(out, `savestream.${ext}`, (err) => {
        if (err) console.error("Download response error:", err);
        // Clean up
        if (fs.existsSync(out)) fs.unlink(out, () => {});
      });
    } else {
      console.error(`[V34] Download failed with code ${code}`);
      if (!res.headersSent) {
        res.status(500).send("Download failed. YouTube might be blocking or the file is too large. Please try again.");
      }
      if (fs.existsSync(out)) fs.unlink(out, () => {});
    }
  });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`SaveStream v34 on port ${PORT}`);
    logStatus("SYSTEM_INITIALIZED: Backend is online and ready.");
});
