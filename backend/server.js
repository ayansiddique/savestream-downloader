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
  res.send("SaveStream v32.0 - Embedded Client Engine (Live)");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const randomIP = `${Math.floor(Math.random()*200+10)}.${Math.floor(Math.random()*200+10)}.${Math.floor(Math.random()*200+10)}.${Math.floor(Math.random()*200+10)}`;

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
    // web_embedded and tv_embedded bypass bot detection on datacenter IPs in 2025
    args.push("--extractor-args", "youtube:player_client=web_embedded,tv_embedded;player_skip=configs,webpage");
    args.push("--add-header", `X-Forwarded-For:${randomIP}`);
    args.push("--add-header", "Accept-Language:en-US,en;q=0.9");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else if (url.includes('tiktok.com')) {
    args.push("--add-header", "Referer:https://www.tiktok.com/");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else if (url.includes('instagram.com') || url.includes('facebook.com')) {
    args.push("--add-header", "Referer:https://www.instagram.com/");
    args.push("--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1");
  } else {
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  }

  args.push(url);

  console.log(`[V32] Analyzing: ${url}`);
  const ytdlp = spawn(getYTCommand(), args);

  let stdoutData = "";
  let stderrData = "";
  const timeout = setTimeout(() => { ytdlp.kill(); }, 55000);

  ytdlp.stdout.on("data", (d) => { stdoutData += d.toString(); });
  ytdlp.stderr.on("data", (d) => { stderrData += d.toString(); });

  ytdlp.on("close", (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      const err = stderrData.trim();
      let msg;
      if (err.includes("bot") || err.includes("sign in")) {
        msg = "Analysis Failed: YouTube server is temporarily busy. Please try again.";
      } else if (err.includes("country") || err.includes("not available")) {
        msg = "Analysis Failed: This video is region-restricted.";
      } else if (err.includes("private") || err.includes("login")) {
        msg = "Analysis Failed: This video is private.";
      } else {
        msg = "Analysis Failed: Could not fetch video. Try a different link.";
      }
      return res.status(500).json({ error: msg });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const rawFormats = data.formats || [];
      const seenLabels = new Set();
      const qualities = [];

      rawFormats.forEach(f => {
        if (!f.vcodec || f.vcodec === 'none') return;
        const h = f.height || 0;
        const w = f.width || 0;
        const resVal = Math.min(w, h) || h || w;
        if (resVal < 140) return;

        let label = `${resVal}p`;
        if (resVal >= 1080) label = "1080p HD";
        else if (resVal >= 720) label = "720p HD";
        else if (resVal >= 480) label = "480p";
        else if (resVal >= 360) label = "360p";

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

      qualities.sort((a, b) => parseInt(b.label) - parseInt(a.label));

      const bestAudio = rawFormats
        .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
        .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

      res.json({
        title: data.title || "Video",
        thumbnail: data.thumbnail || data.thumbnails?.[0]?.url,
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities.slice(0, 10),
        audio: {
          format_id: bestAudio?.format_id || 'bestaudio',
          ext: 'mp3',
          size: bestAudio?.filesize || bestAudio?.filesize_approx || 0
        }
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to parse video info. Please try again." });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  const isAudio = ext === 'mp3';
  const fmt = isAudio
    ? "bestaudio/best"
    : (format_id && format_id !== 'best' ? `${format_id}+bestaudio/best` : "bestvideo+bestaudio/best");
  const out = path.join(__dirname, 'downloads', `dl_${crypto.randomUUID()}.${ext}`);

  const args = ["-f", fmt, "--no-check-certificate", "--geo-bypass", "-o", out];

  if (!isAudio) {
    args.push("--merge-output-format", "mp4", "--postprocessor-args", "ffmpeg:-c:a aac -b:a 192k");
  } else {
    args.push("--extract-audio", "--audio-format", "mp3");
  }

  args.push(url);

  const ytdlp = spawn(getYTCommand(), args);
  ytdlp.on("close", (code) => {
    if (code !== 0) return res.status(500).send("Download failed. Please try again.");
    res.download(out, `savestream.${ext}`, () => {
      if (fs.existsSync(out)) fs.unlink(out, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SaveStream v32 running on port ${PORT}`);
});
