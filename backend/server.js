require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const ytdlp = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 5000;

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
app.use(cors());
app.use(express.json());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', apiLimiter);

// Endpoint: Fetch video metadata
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const info = await ytdlp(url, {
      dumpJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      youtubeSkipDashManifest: true,
    });

    // Formatting qualities available
    const formats = info.formats
      .filter(f => f.vcodec !== 'none' && f.resolution) // Get formats with video
      .map(f => ({
        format_id: f.format_id,
        resolution: f.resolution,
        ext: f.ext,
        filesize: f.filesize ? f.filesize : f.filesize_approx,
        vcodec: f.vcodec,
        acodec: f.acodec,
        hasAudio: f.acodec !== 'none'
      }));

    // Grouping by resolution (e.g., 1080p, 720p)
    const qualities = [];
    const seen = new Set();
    
    // Sort logic to prefer formats that have both audio and video, or just video for a given resolution
    const sortedFormats = formats.sort((a, b) => {
        if (a.hasAudio === b.hasAudio) return (b.filesize || 0) - (a.filesize || 0);
        return a.hasAudio ? -1 : 1;
    });

    sortedFormats.forEach(f => {
      const height = f.resolution.split('x')[1];
      const label = `${height}p`;
      if (!seen.has(label)) {
        seen.add(label);
        qualities.push({
          label: label,
          format_id: f.format_id,
          ext: f.ext,
          size: f.filesize,
          hasAudio: f.hasAudio
        });
      }
    });

    // Also get audio-only option
    const audioFormats = info.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
    let bestAudio = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

    res.json({
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
    });
  } catch (error) {
    console.error('Info extract error:', error.message);
    res.status(500).json({ error: 'Failed to extract video info. Verify the URL is correct.' });
  }
});

// Endpoint: Download video
app.get('/api/download', (req, res) => {
  const { url, format_id, ext = 'mp4' } = req.query;
  if (!url) return res.status(400).send('URL is required');

  const isAudioOnly = ext === 'mp3';
  // Use user-requested format + bestaudio, or best of both, fallback to best
  let formatArg = isAudioOnly 
    ? 'bestaudio' 
    : (format_id ? `${format_id}+bestaudio/best` : 'bestvideo+bestaudio/best');

  const startDownload = async () => {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');

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
        // Clean up file if it exists
        if (fs.existsSync(tempFilePath)) {
          fs.unlink(tempFilePath, (err) => {
            if (err) console.error('Failed to clean up temp file:', err);
          });
        }
      }
    };

    req.on('close', () => {
       // if client disconnects early we can't easily kill yt-dlp through the basic promise wrapper 
       // without keeping the child process ref, but we will clean up afterwards.
    });

    try {
      res.header('Content-Disposition', `attachment; filename="download.${ext}"`);
      res.header('Content-Type', isAudioOnly ? 'audio/mpeg' : 'video/mp4');

      console.log(`Starting yt-dlp download for ${url} into ${tempFilePath}`);
      
      const args = {
        format: formatArg,
        output: tempFilePath,
        noPlaylist: true
      };

      if (isAudioOnly) {
        args.extractAudio = true;
        args.audioFormat = 'mp3';
      } else {
        args.mergeOutputFormat = 'mp4';
      }

      await ytdlp(url, args);

      console.log(`Download completed internally. Streaming file to user...`);
      res.download(tempFilePath, `download.${ext}`, (err) => {
        if (err) {
          console.error('Express stream error:', err.message);
          if (!res.headersSent) res.status(500).send('Streaming failed.');
        }
        onFinish();
      });

    } catch (error) {
      console.error('Download process error:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed during internal processing. Ensure FFmpeg is installed.' });
      }
      onFinish();
    }
  };

  // Queue logic
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    downloadQueue.push(startDownload);
    // Note: To implement a real proper progress/status, we'd need SSE.
    // For now, HTTP request waits until it arrives at the front of the queue, then starts downloading natively over HTTP chunked transfer.
  } else {
    activeDownloads++;
    startDownload();
  }
});

app.get("/", (req, res) => {
  res.send("SaveStream Backend Running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
