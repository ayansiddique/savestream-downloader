import { Zap, Shield, Smartphone } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function WhyChoose() {
  return (
    <div className="container">
      <Helmet>
        <title>Why Choose Us - SaveStream Video Downloader</title>
        <meta name="description" content="Discover why SaveStream is the fastest, most secure, and modern way to download videos from YouTube, TikTok, and 1000+ other platforms." />
      </Helmet>
      
      <section className="features-section" style={{ marginTop: '2rem' }}>
        <h1 className="section-title">Why choose SaveStream?</h1>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><Zap size={32} /></div>
            <h3 className="feature-title">Lightning Fast</h3>
            <p className="feature-desc">Our distributed servers ensure your videos are extracted and processed in milliseconds.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Shield size={32} /></div>
            <h3 className="feature-title">Secure & Private</h3>
            <p className="feature-desc">No registration required. We don't track your downloads or store processed files.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Smartphone size={32} /></div>
            <h3 className="feature-title">Cross Platform</h3>
            <p className="feature-desc">Works flawlessly on Windows, Mac, iOS, Android, and tablets. Fully responsive UI.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
