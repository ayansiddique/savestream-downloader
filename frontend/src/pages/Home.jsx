import { useState } from 'react';
import { 
  Search, 
  Download, 
  Loader2, 
  Check, 
  Copy,
  AlertCircle
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://savestream-downloader-production-43ee.up.railway.app/api';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('video');
  const [copied, setCopied] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const fetchVideoInfo = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setVideoInfo(null);
    
    try {
      const response = await fetch(`${API_BASE}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video information');
      }

      setVideoInfo(data);
      setActiveTab('video');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTitle = () => {
    if (!videoInfo) return;
    navigator.clipboard.writeText(videoInfo.title);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (formatId, ext) => {
    setDownloadingFormat(formatId);
    const downloadUrl = `${API_BASE}/download?url=${encodeURIComponent(url)}&format_id=${formatId}&ext=${ext}`;
    setTimeout(() => setDownloadingFormat(null), 2000);
    window.location.href = downloadUrl;
  };

  return (
    <div className="container">
      <Helmet>
        <title>SaveStream - All in One Video Downloader</title>
        <meta name="description" content="Download Any Video, Anywhere. The blazing fast, secure, and modern way to save videos from YouTube, TikTok, Instagram, Twitter, and 1000+ more platforms in MP4 and MP3." />
      </Helmet>

      <section className="hero">
        <h1>Download Any Video,<br/>Anywhere.</h1>
        <p>The blazing fast, secure, and modern way to save videos from 1000+ platforms.</p>
      </section>

      <section className="downloader-card">
        <form className="input-group" onSubmit={fetchVideoInfo}>
          <input 
            type="text" 
            className="url-input" 
            placeholder="Paste your video URL here..." 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
          />
          <button type="submit" className="fetch-btn" disabled={loading || !url.trim()}>
            {loading ? <Loader2 className="spinner" size={24} /> : <Search size={24} />}
            {loading ? 'Analyzing...' : 'Fetch Video'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {videoInfo && (
          <div className="video-info">
            <div className="video-header">
              <div className="thumbnail-container">
                <img src={videoInfo.thumbnail} alt="Video Thumbnail" />
                <span className="video-duration">{formatDuration(videoInfo.duration)}</span>
              </div>
              
              <div className="video-details">
                <h3 className="video-title">
                  {videoInfo.title}
                  <button className="copy-btn" onClick={handleCopyTitle} title="Copy title">
                    {copied ? <Check size={18} color="green" /> : <Copy size={18} />}
                  </button>
                </h3>
                <div className="video-meta">
                  <span>Source: {videoInfo.extractor}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="tabs">
                <button 
                  className={`tab ${activeTab === 'video' ? 'active' : ''}`}
                  onClick={() => setActiveTab('video')}
                >
                  Video (.mp4)
                </button>
                {videoInfo.audio && (
                  <button 
                    className={`tab ${activeTab === 'audio' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audio')}
                  >
                    Audio (.mp3)
                  </button>
                )}
                <button 
                  className={`tab ${activeTab === 'thumbnail' ? 'active' : ''}`}
                  onClick={() => setActiveTab('thumbnail')}
                >
                  Thumbnail
                </button>
              </div>

              <div className="quality-list">
                {activeTab === 'video' ? (
                  videoInfo.formats.map((format, idx) => (
                    <div key={idx} className="quality-card">
                      <div className="quality-info">
                        <span className="quality-label">
                          {format.label} 
                          <span className="tag">MP4</span>
                        </span>
                        <span className="quality-size">{formatBytes(format.size)}</span>
                      </div>
                      <button 
                        className="download-btn"
                        disabled={downloadingFormat === format.format_id}
                        onClick={() => handleDownload(format.format_id, 'mp4')}
                      >
                        <Download size={18} />
                        Download
                      </button>
                    </div>
                  ))
                ) : activeTab === 'audio' ? (
                  <div className="quality-card">
                    <div className="quality-info">
                      <span className="quality-label">
                        Best Audio 
                        <span className="tag">MP3</span>
                      </span>
                      <span className="quality-size">{formatBytes(videoInfo.audio.size)}</span>
                    </div>
                    <button 
                      className="download-btn"
                      onClick={() => handleDownload('bestaudio', 'mp3')}
                    >
                      <Download size={18} />
                      Download
                    </button>
                  </div>
                ) : (
                  <div className="thumbnail-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {/* High Quality JPG */}
                    <div className="quality-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                      <div className="quality-info">
                        <span className="quality-label">
                          High Quality
                          <span className="tag" style={{ backgroundColor: '#ff9800' }}>JPG</span>
                        </span>
                        <span className="quality-size">Original Image</span>
                      </div>
                      <button 
                        className="download-btn"
                        style={{ width: '100%', background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
                        onClick={() => window.open(`${API_BASE}/download-thumbnail?url=${encodeURIComponent(videoInfo.thumbnail)}`, '_blank')}
                      >
                        <Download size={18} />
                        Download JPG
                      </button>
                    </div>

                    {/* High Quality PNG */}
                    <div className="quality-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                      <div className="quality-info">
                        <span className="quality-label">
                          Lossless
                          <span className="tag" style={{ backgroundColor: '#4caf50' }}>PNG</span>
                        </span>
                        <span className="quality-size">HD Precision</span>
                      </div>
                      <button 
                        className="download-btn"
                        style={{ width: '100%', background: 'linear-gradient(135deg, #f43f5e, #fb923c)' }}
                        onClick={() => window.open(`${API_BASE}/download-thumbnail?url=${encodeURIComponent(videoInfo.thumbnail)}`, '_blank')}
                      >
                        <Download size={18} />
                        Download PNG
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
