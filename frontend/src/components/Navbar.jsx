import { Link } from 'react-router-dom';
import { Download, Moon, Sun } from 'lucide-react';

export default function Navbar({ isDark, toggleTheme }) {
  return (
    <nav className="navbar">
      <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
        <Download size={26} color="var(--primary-color)" />
        SaveStream
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
