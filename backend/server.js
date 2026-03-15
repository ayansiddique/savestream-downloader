require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

app.set('trust proxy', 1);

const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

// Queue system state
const MAX_CONCURRENT_DOWNLOADS = 3;
let activeDownloads = 0;
const downloadQueue = [];

// Middleware
app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', apiLimiter);

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running");
});

// Helper to find yt-dlp path
const getYtDlpCommand = () => {
    // Check common paths in Linux/Docker
    if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
    if (fs.existsSync('/usr/bin/yt-dlp')) return '/usr/bin/yt-dlp';
    return 'yt-dlp'; // Fallback to PATH
};

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      return res.json(cachedData.data);
    }
    infoCache.delete(url);
  }

  const ytDlpCmd = getYtDlpCommand();
  const cmd = `${ytDlpCmd} --dump-single-json --no-playlist --no-warnings --skip-download --no-check-certificate --force-ipv4 "${url}"`;

  console.log(`Executing: ${cmd}`);

  exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('Info extraction failed:', stderr || err.message);
      return res.status(500).json({ 
        error: 'Failed to extract video info.',
        details: stderr || err.message 
      });
    }

    try {
      const info = JSON.parse(stdout);
      
      const formats = info.formats
        .filter(f => f.vcodec !== 'none' && (f.resolution || (f.width && f.height))) 
        .map(f => ({
          format_id: f.format_id,
          resolution: f.resolution || `${f.width}x${f.height}`,
          ext: f.ext,
          size: f.filesize || f.filesize_approx,
          hasAudio: f.acodec !== 'none'
        }));

      const qualities = [];
      const seen = new Set();
      
      const sortedFormats = formats.sort((a, b) => {
          if (a.hasAudio === b.hasAudio) return (b.size || 0) - (a.size || 0);
          return a.hasAudio ? -1 : 1;
      });

      sortedFormats.forEach(f => {
        const height = f.resolution.split('x')[1] || f.height;
        if (!height) return;
        const label = `${height}p`;
        if (!seen.has(label)) {
          seen.add(label);
          qualities.push({
            label: label,
            format_id: f.format_id,
            ext: f.ext,
            size: f.size,
            hasAudio: f.hasAudio
          });
        }
      });

      const audioFormats = info.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
      let bestAudio = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

      const responseData = {
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        extractor: info.extractor,
        formats: qualities,
        audio: bestAudio ? {
          format_id: bestAudio.format_id,
          ext: bestAudio.ext,
          size: bestAudio.filesize || bestAudio.filesize_approx
        } : null
      };

      infoCache.set(url, {
        timestamp: Date.now(),
        data: responseData
      });

      res.json(responseData);
    } catch (parseErr) {
      console.error('Parse error:', parseErr.message);
      res.status(500).json({ error: 'Failed to process metadata' });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  if (!url) return res.status(400).send('URL is required');

  const isAudioOnly = ext === 'mp3';
  const formatArg = isAudioOnly ? 'bestaudio' : (format_id ? `${format_id}+bestaudio/best` : 'bestvideo+bestaudio/best');
  
  const ytDlpCmd = getYtDlpCommand();

  const startDownload = async () => {
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

    const tempFilePath = path.join(downloadsDir, `dl_${crypto.randomUUID()}.${ext}`);
    let active = true;

    const cleanup = () => {
        if (!active) return;
        active = false;
        if (fs.existsSync(tempFilePath)) fs.unlink(tempFilePath, () => {});
    };

    try {
      res.header('Content-Disposition', `attachment; filename="video.${ext}"`);
      
      const cmd = isAudioOnly 
        ? `${ytDlpCmd} -f bestaudio --extract-audio --audio-format mp3 --no-check-certificate -o "${tempFilePath}" "${url}"`
        : `${ytDlpCmd} -f "${formatArg}" --merge-output-format mp4 --no-check-certificate -o "${tempFilePath}" "${url}"`;

      exec(cmd, (err) => {
        if (err) {
            console.error('Download exec error:', err.message);
            if (!res.headersSent) res.status(500).send('Download failed');
            return;
        }
        res.download(tempFilePath, isAudioOnly ? 'audio.mp3' : 'video.mp4', () => {
            cleanup();
            activeDownloads--;
            if (downloadQueue.length > 0) {
                const next = downloadQueue.shift();
                activeDownloads++;
                next();
            }
        });
      });

    } catch (e) {
      cleanup();
    }
  };

  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    downloadQueue.push(startDownload);
  } else {
    activeDownloads++;
    startDownload();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
