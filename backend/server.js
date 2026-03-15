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
  res.send("SaveStream Backend Running - Ghost Bypass v22.0 (Live)");
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

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    // Android VR is currently the most stealthy client
    args.push("--extractor-args", "youtube:player_client=android_vr,ios,mweb;player_skip=configs");
    args.push("--add-header", `X-Forwarded-For:${randomIP}`);
    args.push("--add-header", "Accept-Language:en-US,en;q=0.9");
    args.push("--add-header", "Sec-Fetch-Mode:navigate");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else if (url.includes('tiktok.com')) {
    args.push("--add-header", "Referer:https://www.tiktok.com/");
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  } else {
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  }

  args.push(url);

  console.log(`[V22 GHOST] Extraction started for: ${url}`);
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
      if (errorMsg.includes("bot")) userError = "YouTube Bot Protection Active. Please retry with a different YouTube link or wait a moment.";
      else userError = `Analysis Failed: ${errorMsg.split('\n')[0].substring(0, 100)}`;
      return res.status(500).json({ error: userError });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const rawFormats = data.formats || [];
      const seenLabels = new Set();
      let qualities = [];

      // Unified parsing for all platforms
      rawFormats.forEach(f => {
        if (f.vcodec === 'none') return;
        
        const w = f.width || 0;
        const h = f.height || 0;
        const resVal = Math.min(w, h) || h || w || 0;
        
        let label = "HD Video";
        if (resVal >= 2160) label = "4K Ultra HD";
        else if (resVal >= 1440) label = "2K Quad HD";
        else if (resVal >= 1080) label = "1080p Full HD";
        else if (resVal >= 720) label = "720p HD";
        else if (resVal >= 480) label = "480p SD";
        else if (resVal >= 360) label = "360p SD";
        else if (resVal > 0) label = `${resVal}p`;

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

      // TikTok Fallback: If no format list, use main URL data
      if (qualities.length === 0 && (data.url || data.webpage_url)) {
        qualities.push({ label: "High Quality (MP4)", format_id: "best", ext: "mp4", size: 0, hasAudio: true });
      }

      qualities.sort((a, b) => {
          const order = ["4K", "2K", "1080", "720", "480", "360"];
          const getRank = (lbl) => {
              for(let i=0; i<order.length; i++) if(lbl.includes(order[i])) return i;
              return 99;
          };
          return getRank(a.label) - getRank(b.label);
      });

      const bestAudio = rawFormats.filter(f => f.vcodec === 'none')
        .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0];

      const responseData = {
        title: data.title || "Social Video",
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url),
        duration: data.duration,
        extractor: data.extractor,
        formats: qualities.slice(0, 10),
        audio: { 
            format_id: bestAudio ? bestAudio.format_id : 'bestaudio', 
            ext: 'mp3', 
            size: bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx || 0) : 0 
        }
      };

      res.json(responseData);
    } catch (e) {
      res.status(500).json({ error: "High extraction load. Please try again in a few seconds." });
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
    res.download(tempFilePath, `savestream_final.${ext}`, (err) => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
