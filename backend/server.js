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
  res.send("SaveStream Backend Running - Real Error Mode v17.0");
});

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // Ultimate Bypass Strategy: Realistic Android & Web mix
  let args = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--no-check-certificate",
    "--force-ipv4",
    "--geo-bypass",
    "--extractor-args", "youtube:player_client=android,web;player_skip=configs",
    "--user-agent", "com.google.android.youtube/19.12.35 (Linux; U; Android 14; en_US; Pixel 7 Pro) Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
    url
  ];

  console.log(`[V17 DEBUG] Analyzing: ${url}`);
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
      console.error(`[ERROR] Full Log:`, errorMsg);
      
      // We will now show the REAL first line of the error to the user for diagnosis
      let rawError = errorMsg.split('\n')[0].replace("ERROR: ", "").substring(0, 150);
      let userError = `Analysis Failed: ${rawError || "Connection Timeout"}`;
      
      if (errorMsg.includes("confirm you're not a bot")) {
        userError = "Analysis Failed: YouTube Bot Detection is active. Please try again in 5 minutes.";
      }

      return res.status(500).json({ error: userError });
    }

    try {
      const data = JSON.parse(stdoutData || '{}');
      const rawFormats = data.formats || [];
      const seenLabels = new Set();
      const qualities = [];

      // Sort by height to prioritize best quality
      rawFormats.sort((a, b) => (b.height || 0) - (a.height || 0));

      rawFormats.forEach(f => {
        if (!f.vcodec || f.vcodec === 'none') return;
        
        const w = f.width || 0;
        const h = f.height || 0;
        const resVal = Math.min(w, h) || h || w;
        
        if (resVal < 140) return;
        
        const label = `${resVal}p`;
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
      res.status(500).json({ error: "Analysis Failed: Data extraction failed. Try another link." });
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
    res.download(tempFilePath, `Result.${ext}`, () => {
      if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
