import { Link } from 'react-router-dom';
import { Download, Moon, Sun } from 'lucide-react';

export default function Navbar({ isDark, toggleTheme }) {
  return (
    <nav className="navbar">
      <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
        <Download size={28} color="var(--primary-color)" />
        SaveStream
      </Link>
      
      <div className="nav-links">
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/why-choose-us" className="nav-link">Why Choose Us</Link>
        <Link to="/faq" className="nav-link">FAQ</Link>
        
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" style={{ marginLeft: '1rem' }}>
          {isDark ? <Sun size={24} /> : <Moon size={24} />}
        </button>
      </div>
    </nav>
  );
}
