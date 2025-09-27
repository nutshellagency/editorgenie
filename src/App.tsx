import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import './App.css';

// Pages
import NodeEditor from './pages/NodeEditor';
import PresetLibrary from './pages/PresetLibrary';
import ProjectManagement from './pages/ProjectManagement';
import UserProfile from './pages/UserProfile';
import Onboarding from './pages/Onboarding';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';

// Stores
import { useUIStore } from './stores/uiStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { theme } = useUIStore();

  return (
    <QueryClientProvider client={queryClient}>
      <div className={`App ${theme}`} data-theme={theme}>
        <Router>
          <div className="app-layout">
            <Header />
            <div className="app-main">
              <Sidebar />
              <main className="app-content">
                <Routes>
                  <Route path="/" element={<NodeEditor />} />
                  <Route path="/presets" element={<PresetLibrary />} />
                  <Route path="/projects" element={<ProjectManagement />} />
                  <Route path="/profile" element={<UserProfile />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                </Routes>
              </main>
            </div>
          </div>
        </Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--surface-color)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            },
          }}
        />
      </div>
    </QueryClientProvider>
  );
}

export default App;