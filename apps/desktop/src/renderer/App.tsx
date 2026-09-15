import React, { useState, useEffect } from 'react'
import Home from './pages/Home'
import Devices from './pages/Devices'
import Settings from './pages/Settings'

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'devices' | 'settings'>('home')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [intervalMin, setIntervalMin] = useState<number>(5)

  useEffect(() => {
    // Listen for menu navigation (e.g. Preferences Command+,)
    const cleanupNav = window.api.on('navigate-to', (tab: string) => {
      if (tab === 'home' || tab === 'devices' || tab === 'settings') {
        setActiveTab(tab as any)
      }
    })

    // Listen for report status notifications
    const cleanupStatus = window.api.on('report-status', (status: any) => {
      showToast(status.success ? 'success' : 'error', status.message)
    })

    // Read current config
    window.api.getConfig().then((cfg) => {
      if (cfg && cfg.intervalMin !== undefined) {
        setIntervalMin(cfg.intervalMin)
      }
    })

    return () => {
      cleanupNav()
      cleanupStatus()
    }
  }, [])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev))
    }, 3500)
  }

  return (
    <div className="app-container">
      {/* Draggable macOS Window Header with traffic light clearance */}
      <header className="titlebar-header">
        <div className="titlebar-left">
          <div className="app-brand-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Statuser
            <span className="app-brand-badge">Agent</span>
          </div>
        </div>

        <div className="titlebar-right">
          <div className="agent-status-pill">
            <div className="status-pulse-dot" />
            <span>{intervalMin > 0 ? `Every ${intervalMin}m` : 'Manual sync'}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="content-area">
        {activeTab === 'home' && <Home onToast={showToast} />}
        {activeTab === 'devices' && <Devices onToast={showToast} />}
        {activeTab === 'settings' && (
          <Settings
            onToast={showToast}
            onIntervalChange={(min) => setIntervalMin(min)}
          />
        )}
      </main>

      {/* Modern Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Telemetry
        </button>

        <button
          className={`nav-item ${activeTab === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('devices')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          All Devices
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </nav>

      {/* Toast Overlay */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}
