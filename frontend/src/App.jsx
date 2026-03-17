import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import WhyChoose from './pages/WhyChoose';
import FAQ from './pages/FAQ';

function App() {
  const [isDark, setIsDark] = useState(false);

  // Theme support
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    if (prefersDark) document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  return (
    <Router>
      <div className="bg-blob bg-blob-1"></div>
      <div className="bg-blob bg-blob-2"></div>

      <Navbar isDark={isDark} toggleTheme={toggleTheme} />

      <main style={{ minHeight: 'calc(100vh - 160px)' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/why-choose-us" element={<WhyChoose />} />
          <Route path="/faq" element={<FAQ />} />
        </Routes>
      </main>

      <footer style={{ 
        backgroundColor: '#0f172a', 
        color: '#f8fafc', 
        padding: '80px 20px 40px', 
        borderTop: '1px solid #1e293b',
        marginTop: '100px',
        fontFamily: "'Inter', system-ui, sans-serif"
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
            gap: '50px',
            textAlign: 'left'
          }}>
            {/* Column 1: Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                <div style={{ width: '36px', height: '36px', backgroundColor: '#22c55e', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px 0 rgba(34, 197, 94, 0.39)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>SaveStream</h3>
              </div>
              <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '0.95rem' }}>
                Your trusted online media companion delivering quality downloads with speed and security. Supporting 1000+ platforms worldwide.
              </p>
            </div>

            {/* Column 2: Navigation */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.8rem', color: '#64748b' }}>Quick Links</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <li><a href="/" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '500', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#22c55e'} onMouseOut={e => e.currentTarget.style.color = '#cbd5e1'}>Home</a></li>
                <li><a href="/why-choose-us" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '500', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#22c55e'} onMouseOut={e => e.currentTarget.style.color = '#cbd5e1'}>Why Choose Us</a></li>
                <li><a href="/faq" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '500', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#22c55e'} onMouseOut={e => e.currentTarget.style.color = '#cbd5e1'}>Help & FAQ</a></li>
              </ul>
            </div>

            {/* Column 3: Tools */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.8rem', color: '#64748b' }}>Tools</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <li style={{ color: '#cbd5e1', fontSize: '0.95rem', fontWeight: '500' }}>Full HD MP4</li>
                <li style={{ color: '#cbd5e1', fontSize: '0.95rem', fontWeight: '500' }}>High-Bitrate MP3</li>
                <li style={{ color: '#cbd5e1', fontSize: '0.95rem', fontWeight: '500' }}>Lossless PNG/JPG</li>
                <li style={{ color: '#cbd5e1', fontSize: '0.95rem', fontWeight: '500' }}>AI Assistant</li>
              </ul>
            </div>

            {/* Column 4: Social */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.8rem', color: '#64748b' }}>Social</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <a 
                  href="https://whatsapp.com/channel/0029VbCLfMP5fM5Qug9m0S0c" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#ffffff' }}
                >
                  <div style={{ width: '22px', height: '22px', color: '#22c55e' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>WhatsApp Channel</span>
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '22px', height: '22px', color: '#3b82f6' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Facebook Page</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '22px', height: '22px', color: '#e4405f' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>Instagram Official</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1e293b', marginTop: '60px', paddingTop: '30px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
              &copy; {new Date().getFullYear()} SaveStream Downloader AI. All rights reserved. Professional Media Tools.
            </p>
          </div>
        </div>
      </footer>
    </Router>
  );
}

export default App;
