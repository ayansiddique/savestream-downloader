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

      <footer>
        <p>&copy; {new Date().getFullYear()} SaveStream Video Downloader. All rights reserved.</p>
      </footer>
    </Router>
  );
}

export default App;
