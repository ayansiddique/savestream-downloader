import { Link } from 'react-router-dom';
import { Download, Moon, Sun } from 'lucide-react';

export default function Navbar({ isDark, toggleTheme }) {
  return (
    <nav className="navbar">
      <Link to="/" className="logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          backgroundColor: '#22c55e', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(34, 197, 94, 0.3)'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <span style={{ color: '#ffffff', fontWeight: '800', fontSize: '1.4rem', letterSpacing: '-0.02em' }}>
          SaveStream
        </span>
      </Link>

      <div className="nav-links">
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/why-choose-us" className="nav-link">Why Choose Us</Link>
        <Link to="/faq" className="nav-link">FAQ</Link>

        <div className="nav-divider" />

        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </nav>
  );
}
