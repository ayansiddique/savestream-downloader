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

// Enable trust proxy for platforms like Railway/Render
app.set('trust proxy', 1);

// In-memory cache for video info
const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Queue system state
const MAX_CONCURRENT_DOWNLOADS = 3;
let activeDownloads = 0;
const downloadQueue = [];

const processQueue = () => {
  if (activeDownloads < MAX_CONCURRENT_DOWNLOADS && downloadQueue.length > 0) {
    const nextDownload = downloadQueue.shift();
    activeDownloads++;
    nextDownload();
  }
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', apiLimiter);

// Health Check / Root route
app.get("/", (req, res) => {
  res.send("SaveStream Backend Running");
});

// Endpoint: Fetch video metadata (Optimized)
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // 1. Check Cache
  if (infoCache.has(url)) {
    const cachedData = infoCache.get(url);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log(`Cache hit for: ${url}`);
      return res.json(cachedData.data);
    }
    infoCache.delete(url);
  }

  try {
    console.log(`Fetching info for: ${url}`);
    
    // 2. Execute yt-dlp binary directly for speed
    // Flags used: --dump-single-json (Fastest), --no-playlist, --force-ipv4 (Bypass throttling)
    const ytDlpPath = 'yt-dlp'; // Assumes installed in Docker path
    const cmd = `${ytDlpPath} --dump-single-json --no-playlist --no-warnings --skip-download --force-ipv4 "${url}"`;

    exec(cmd, { timeout: 20000 }, (err, stdout) => {
      if (err) {
        console.error('yt-dlp exec error:', err.message);
        return res.status(500).json({ error: 'Failed to analyze video. It might be blocked or private.' });
      }

      try {
        const info = JSON.parse(stdout);

        // Formatting qualities available
        const formats = info.formats
          .filter(f => f.vcodec !== 'none' && f.resolution) 
          .map(f => ({
            format_id: f.format_id,
            resolution: f.resolution,
            ext: f.ext,
            size: f.filesize ? f.filesize : f.filesize_approx,
            hasAudio: f.acodec !== 'none'
          }));

        // Grouping by resolution (e.g., 1080p, 720p)
        const qualities = [];
        const seen = new Set();
        
        const sortedFormats = formats.sort((a, b) => {
            if (a.hasAudio === b.hasAudio) return (b.size || 0) - (a.size || 0);
            return a.hasAudio ? -1 : 1;
        });

        sortedFormats.forEach(f => {
          const height = f.resolution.split('x')[1] || f.height;
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

        // 3. Store in Cache
        infoCache.set(url, {
          timestamp: Date.now(),
          data: responseData
        });

        res.json(responseData);
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr.message);
        res.status(500).json({ error: 'Failed to process video metadata.' });
      }
    });
  } catch (error) {
    console.error('Server error:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Endpoint: Download video
app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  if (!url) return res.status(400).send('URL is required');

  const isAudioOnly = ext === 'mp3';
  let formatArg = isAudioOnly 
    ? 'bestaudio' 
    : (format_id ? `${format_id}+bestaudio/best` : 'bestvideo+bestaudio/best');

  const startDownload = async () => {
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const tempId = crypto.randomUUID();
    const tempFileName = `video_${tempId}.${ext}`;
    const tempFilePath = path.join(downloadsDir, tempFileName);

    let finished = false;
    const onFinish = () => {
      if (!finished) {
        finished = true;
        activeDownloads--;
        processQueue();
        if (fs.existsSync(tempFilePath)) {
          fs.unlink(tempFilePath, (err) => {
            if (err) console.error('Failed to clean up temp file:', err);
          });
        }
      }
    };

    try {
      res.header('Content-Disposition', `attachment; filename="download.${ext}"`);
      res.header('Content-Type', isAudioOnly ? 'audio/mpeg' : 'video/mp4');

      console.log(`Starting download into ${tempFilePath}`);
      
      const cmd = `yt-dlp -f "${formatArg}" --no-playlist --merge-output-format mp4 -o "${tempFilePath}" "${url}"`;
      if (isAudioOnly) {
        exec(`yt-dlp -f bestaudio --extract-audio --audio-format mp3 -o "${tempFilePath}" "${url}"`, (err) => {
          if (err) throw err;
          res.download(tempFilePath, `download.mp3`, onFinish);
        });
      } else {
        exec(cmd, (err) => {
          if (err) throw err;
          res.download(tempFilePath, `download.mp4`, onFinish);
        });
      }

    } catch (error) {
      console.error('Download error:', error.message);
      if (!res.headersSent) res.status(500).send('Download failed.');
      onFinish();
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
