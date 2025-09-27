import React from 'react';
import { useUIStore } from '../stores/uiStore';

const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <nav className="sidebar-nav">
        <ul>
          <li>
            <a href="/" className="nav-link active">
              <span className="nav-icon">🎬</span>
              <span className="nav-text">Editor</span>
            </a>
          </li>
          <li>
            <a href="/presets" className="nav-link">
              <span className="nav-icon">📚</span>
              <span className="nav-text">Presets</span>
            </a>
          </li>
          <li>
            <a href="/projects" className="nav-link">
              <span className="nav-icon">📁</span>
              <span className="nav-text">Projects</span>
            </a>
          </li>
          <li>
            <a href="/profile" className="nav-link">
              <span className="nav-icon">👤</span>
              <span className="nav-text">Profile</span>
            </a>
          </li>
        </ul>
      </nav>
      <button onClick={toggleSidebar} className="sidebar-toggle">
        {sidebarCollapsed ? '→' : '←'}
      </button>
    </aside>
  );
};

export default Sidebar;