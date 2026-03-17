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
        backgroundColor: '#000', 
        color: '#fff', 
        padding: '40px 20px', 
        textAlign: 'center',
        marginTop: 'auto'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '2rem', 
            flexWrap: 'wrap',
            marginBottom: '1.5rem'
          }}>
            {/* WhatsApp */}
            <a 
              href="https://whatsapp.com/channel/0029VbCLfMP5fM5Qug9m0S0c" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#25D366', 
                textDecoration: 'none', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                fontWeight: 600,
                transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '1.25rem' }}>📱</span> WhatsApp
            </a>

            {/* Facebook */}
            <a 
              href="#" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#1877F2', 
                textDecoration: 'none', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                fontWeight: 600,
                transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '1.25rem' }}>📘</span> Facebook
            </a>

            {/* Instagram */}
            <a 
              href="#" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#E4405F', 
                textDecoration: 'none', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                fontWeight: 600,
                transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '1.25rem' }}>📸</span> Instagram
            </a>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid #333', margin: '1.5rem auto', maxWidth: '600px' }} />
          
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#aaa', letterSpacing: '0.5px' }}>
            &copy; {new Date().getFullYear()} SaveStream Video Downloader. All rights reserved.
          </p>
        </div>
      </footer>
    </Router>
  );
}

export default App;
