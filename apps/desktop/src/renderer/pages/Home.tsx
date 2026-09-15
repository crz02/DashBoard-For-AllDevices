import React, { useEffect, useState } from 'react'

interface HomeProps {
  onToast: (type: 'success' | 'error', message: string) => void
}

export default function Home({ onToast }: HomeProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reporting, setReporting] = useState(false)
  const [lastReportedTime, setLastReportedTime] = useState<string | null>(null)
  const [config, setConfig] = useState<any>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  const loadStats = async () => {
    try {
      const data = await window.api.getTelemetry()
      setStats(data)
    } catch (e: any) {
      console.error('Failed to load telemetry:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
    window.api.getConfig().then(setConfig)

    const interval = setInterval(loadStats, 4000)

    const cleanupUpdate = window.api.on('telemetry-updated', (updated: any) => {
      setStats(updated)
    })

    const cleanupStatus = window.api.on('report-status', (status: any) => {
      if (status.success) {
        setReportError(null)
        setLastReportedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      } else {
        setReportError(status.message)
      }
    })

    return () => {
      clearInterval(interval)
      cleanupUpdate()
      cleanupStatus()
    }
  }, [])

  const handleReportNow = async () => {
    setReporting(true)
    try {
      const res = await window.api.triggerReport()
      if (res.success) {
        setReportError(null)
        setLastReportedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        onToast('success', 'Telemetry reported to dashboard')
        loadStats()
      } else {
        setReportError(res.error || 'Server unreachable')
        onToast('error', res.error || 'Report failed')
      }
    } catch (err: any) {
      setReportError(err.message)
      onToast('error', err.message || 'Report failed')
    } finally {
      setReporting(false)
    }
  }

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%' }}>
        <svg className="spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6366f1', marginBottom: 12 }}>
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Reading native macOS hardware sensors...</span>
      </div>
    )
  }

  const battColor = stats?.is_charging
    ? '#06b6d4'
    : stats?.battery_level > 40
      ? '#10b981'
      : stats?.battery_level > 20
        ? '#f59e0b'
        : '#f43f5e'

  return (
    <div>
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{stats?.name || 'Local Machine'}</h1>
          <p className="page-subtitle">
            {stats?.model} • {stats?.cpu_model || stats?.platform}
          </p>
        </div>

        <button
          className="btn primary"
          onClick={handleReportNow}
          disabled={reporting}
        >
          {reporting ? (
            <>
              <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              Reporting...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Report Now
            </>
          )}
        </button>
      </div>

      {/* Sync Status Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, fontSize: 12, color: 'var(--text-dim)' }}>
        <span>
          Destination:{' '}
          <strong style={{ color: 'var(--text-muted)' }}>
            {config?.dashboardUrl || 'http://localhost:8080'}
          </strong>
        </span>
        <span>
          {lastReportedTime ? `Last reported: ${lastReportedTime}` : 'Telemetry synced locally'}
        </span>
      </div>

      {/* Unreachable Server Warning Alert */}
      {reportError && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#fda4af'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>Server unreachable:</strong> Could not connect to {config?.dashboardUrl}. Check that the dashboard server is running or update the URL in Settings.
          </div>
        </div>
      )}

      {/* Main Hero Battery Card */}
      <div className="hero-battery-card">
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-dim)', fontWeight: 600 }}>
            Battery Level
          </div>
          <div className="battery-display">
            <span className="battery-percent-num" style={{ color: battColor }}>
              {stats?.battery_level}%
            </span>
          </div>

          <div
            className="battery-status-badge"
            style={{
              backgroundColor: `${battColor}22`,
              color: battColor,
              border: `1px solid ${battColor}44`
            }}
          >
            {stats?.is_charging ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Charging ({stats?.power_source})
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
                  <line x1="22" y1="11" x2="22" y2="13" />
                </svg>
                {stats?.power_source || 'Battery Power'}
              </>
            )}
          </div>
        </div>

        {/* Circular or Minimal Battery Graphic */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Health: <strong style={{ color: 'var(--text-main)' }}>{stats?.battery_health}</strong>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Cycle Count: <strong style={{ color: 'var(--text-main)' }}>{stats?.cycle_count} cycles</strong>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Thermal State: <strong style={{ color: 'var(--text-main)' }}>{stats?.thermal_state || 'Nominal'}</strong>
          </div>
        </div>
      </div>

      {/* Battery Percentage Bar */}
      <div className="card" style={{ padding: '14px 20px', marginTop: -8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          <span>Charge Capacity</span>
          <span>{stats?.battery_level}%</span>
        </div>
        <div className="battery-bar-container" style={{ marginTop: 0 }}>
          <div
            className="battery-bar-fill"
            style={{ width: `${Math.min(100, Math.max(0, stats?.battery_level))}%`, backgroundColor: battColor }}
          />
        </div>
      </div>

      {/* System Metrics Grid */}
      <div className="stats-grid">
        <div className="stat-item-card">
          <div className="stat-label">CPU Usage</div>
          <div className="stat-value">{stats?.cpu_usage}%</div>
          <div className="stat-bar">
            <div
              className="stat-bar-fill"
              style={{
                width: `${Math.min(100, stats?.cpu_usage)}%`,
                backgroundColor: stats?.cpu_usage > 85 ? 'var(--color-red)' : stats?.cpu_usage > 60 ? 'var(--color-amber)' : 'var(--color-primary)'
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            {stats?.cpu_model || 'System CPU'}
          </div>
        </div>

        <div className="stat-item-card">
          <div className="stat-label">RAM Usage</div>
          <div className="stat-value">{stats?.ram_usage}%</div>
          <div className="stat-bar">
            <div
              className="stat-bar-fill"
              style={{
                width: `${Math.min(100, stats?.ram_usage)}%`,
                backgroundColor: stats?.ram_usage > 85 ? 'var(--color-red)' : stats?.ram_usage > 70 ? 'var(--color-amber)' : 'var(--color-accent)'
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            Active Physical Memory
          </div>
        </div>

        <div className="stat-item-card">
          <div className="stat-label">Battery Condition</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{stats?.battery_health}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            Designed for 1,000 max cycles
          </div>
        </div>

        <div className="stat-item-card">
          <div className="stat-label">Device Hardware</div>
          <div className="stat-value" style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stats?.model}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            macOS {stats?.platform === 'macos' ? 'Apple Silicon' : stats?.platform}
          </div>
        </div>
      </div>
    </div>
  )
}
