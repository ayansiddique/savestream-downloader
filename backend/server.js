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

const extractWithClient = (url, clientStr) => {
    return new Promise((resolve, reject) => {
        const randomIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        const args = [
            "--dump-single-json",
            "--no-playlist",
            "--no-warnings",
            "--skip-download",
            "--no-check-certificate",
            "--geo-bypass",
            "--geo-bypass-country", "US",
            "--force-ipv4",
            "--extractor-args", `youtube:player_client=${clientStr};player_skip=configs`,
            "--add-header", `X-Forwarded-For:${randomIP}`,
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            url
        ];

        const ytdlp = spawn(getYTCommand(), args);
        let stdoutData = "";
        let stderrData = "";
        const timeout = setTimeout(() => { ytdlp.kill(); }, 30000);

        ytdlp.stdout.on("data", (chunk) => { stdoutData += chunk.toString(); });
        ytdlp.stderr.on("data", (chunk) => { stderrData += chunk.toString(); });

        ytdlp.on("close", (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                try {
                    resolve(JSON.parse(stdoutData));
                } catch (e) {
                    reject(new Error("Parse fail"));
                }
            } else {
                reject(new Error(stderrData.trim()));
            }
        });
    });
};

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running - Resilience Engine v29.0 (Live)");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // Social Media check
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      // Direct extraction for Insta/TikTok/Facebook/Reddit
      const randomIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      const args = [
          "--dump-single-json", "--no-playlist", "--no-warnings", "--skip-download", "--no-check-certificate",
          "--add-header", `X-Forwarded-For:${randomIP}`,
          "--add-header", "Referer:https://www.google.com/",
          "--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
          url
      ];
      const ytdlp = spawn(getYTCommand(), args);
      let stdout = "";
      ytdlp.stdout.on("data", (chunk) => stdout += chunk);
      ytdlp.on("close", (code) => {
          if (code !== 0) return res.status(500).json({ error: "Platform restricted. Try again." });
          processData(JSON.parse(stdout || '{}'), res);
      });
      return;
  }

  // YouTube Resilience Loop
  const clientConfigs = ['ios,mweb', 'android_vr,tv', 'web,android'];
  let lastError = "";

  for (const client of clientConfigs) {
      try {
          console.log(`[V29 RETRY] Trying YouTube with client: ${client}`);
          const data = await extractWithClient(url, client);
          return processData(data, res);
      } catch (e) {
          lastError = e.message;
          console.warn(`[V29 REJECT] Client ${client} failed.`);
      }
  }

  // If all attempts fail
  let userError = "Analysis Failed: Protected Content.";
  if (lastError.includes("country")) userError = "Analysis Failed: Video is region-blocked.";
  else if (lastError.includes("bot") || lastError.includes("busy")) userError = "Analysis Failed: YouTube is busy. Try again in 1 minute.";

  res.status(500).json({ error: userError });
});

const processData = (data, res) => {
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
                label: label,
                format_id: f.format_id || 'best',
                ext: 'mp4',
                size: f.filesize || f.filesize_approx || 0
            });
        }
    });

    if (qualities.length === 0) {
        qualities.push({ label: "Best MP4 Result", format_id: "best", ext: "mp4", size: 0 });
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
};

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
    res.download(tempFilePath, `savestream_final.${ext}`, (err) => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
