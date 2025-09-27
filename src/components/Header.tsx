import React from 'react';
import { useUIStore } from '../stores/uiStore';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useUIStore();

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-title">AI Video Editor</h1>
      </div>
      <div className="header-right">
        <button onClick={toggleTheme} className="theme-toggle">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
};

export default Header;