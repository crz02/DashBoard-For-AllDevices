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
  const [serverStatus, setServerStatus] = useState<{ running: boolean; url: string; canManage: boolean }>({
    running: false,
    url: 'http://localhost:8080',
    canManage: false
  })
  const [serverActionLoading, setServerActionLoading] = useState(false)

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

  const checkServer = async () => {
    try {
      const s = await window.api.getServerStatus()
      setServerStatus(s)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadStats()
    checkServer()
    window.api.getConfig().then(setConfig)

    const intervalStats = setInterval(loadStats, 3500)
    const intervalServer = setInterval(checkServer, 5000)

    const cleanupUpdate = window.api.on('telemetry-updated', (updated: any) => {
      setStats(updated)
    })

    const cleanupStatus = window.api.on('report-status', (status: any) => {
      if (status.success) {
        setLastReportedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      }
    })

    return () => {
      clearInterval(intervalStats)
      clearInterval(intervalServer)
      cleanupUpdate()
      cleanupStatus()
    }
  }, [])

  const handleReportNow = async () => {
    setReporting(true)
    try {
      const res = await window.api.triggerReport()
      if (res.success) {
        setLastReportedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        onToast('success', 'Telemetry reported to dashboard')
        loadStats()
      } else {
        onToast('error', res.error || 'Report failed')
      }
    } catch (err: any) {
      onToast('error', err.message || 'Report failed')
    } finally {
      setReporting(false)
    }
  }

  const handleStartServer = async () => {
    setServerActionLoading(true)
    try {
      const res = await window.api.startServer()
      if (res.success) {
        onToast('success', 'Dashboard server started on :8080')
        await checkServer()
        // Trigger report right away
        await handleReportNow()
      } else {
        onToast('error', res.message || 'Failed to start server')
      }
    } catch (e: any) {
      onToast('error', e.message || 'Error starting server')
    } finally {
      setServerActionLoading(false)
    }
  }

  const handleOpenDashboard = () => {
    const url = config?.dashboardUrl || 'http://localhost:8080'
    window.api.openExternal(url)
  }

  const handleCopySpecs = () => {
    if (!stats) return
    const text = `--- Statuser System Report ---
Device: ${stats.name}
Model: ${stats.model}
CPU: ${stats.cpu_model || stats.platform} (${stats.cpu_usage}% load)
Memory: ${stats.ram_used_gb || ''} / ${stats.ram_total_gb || ''} (${stats.ram_usage}% used)
Battery: ${stats.battery_level}% (${stats.power_source}${stats.time_remaining ? `, ${stats.time_remaining}` : ''})
Battery Health: ${stats.battery_health} (${stats.cycle_count} cycles)
Disk: ${stats.disk_usage?.used || ''} / ${stats.disk_usage?.total || ''} (${stats.disk_usage?.percent || 0}% used)
Local IP: ${stats.local_ip || '127.0.0.1'}
Platform: macOS ${stats.platform}
Generated: ${new Date().toLocaleString()}
------------------------------`
    window.api.copyClipboard(text)
    onToast('success', 'System report copied to clipboard')
  }

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '65%' }}>
        <svg className="spin" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" style={{ marginBottom: 14 }}>
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Connecting to native macOS sensors...</span>
      </div>
    )
  }

  const battPercent = Math.min(100, Math.max(0, stats?.battery_level || 0))
  const isCharging = stats?.is_charging
  const battColor = isCharging
    ? '#06b6d4'
    : battPercent > 40
      ? '#10b981'
      : battPercent > 20
        ? '#f59e0b'
        : '#f43f5e'

  // Circumference for 120px diameter circle (radius = 50)
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (battPercent / 100) * circumference

  return (
    <div>
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{stats?.name || 'Local Mac'}</h1>
          <p className="page-subtitle">
            {stats?.model} • {stats?.cpu_model || 'Apple Silicon'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={handleCopySpecs} title="Copy specs to clipboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Specs
          </button>

          <button className="btn primary" onClick={handleReportNow} disabled={reporting}>
            {reporting ? (
              <>
                <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 2L11 13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Sync Telemetry
              </>
            )}
          </button>
        </div>
      </div>

      {/* Local Server Quick Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: serverStatus.running ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
          border: `1px solid ${serverStatus.running ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: 12,
          padding: '10px 16px',
          marginBottom: 18,
          fontSize: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: serverStatus.running ? 'var(--color-green)' : 'var(--text-dim)',
              boxShadow: serverStatus.running ? '0 0 8px var(--color-green)' : 'none'
            }}
          />
          <span style={{ color: serverStatus.running ? '#34d399' : 'var(--text-muted)', fontWeight: 600 }}>
            {serverStatus.running
              ? `Dashboard Server Online on ${serverStatus.url}`
              : 'Dashboard Server is Offline'}
          </span>
          {lastReportedTime && (
            <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
              • Last synced {lastReportedTime}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {serverStatus.running ? (
            <button className="btn sm" onClick={handleOpenDashboard} style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              Open in Browser ↗
            </button>
          ) : (
            <button
              className="btn sm"
              onClick={handleStartServer}
              disabled={serverActionLoading}
              style={{ background: 'rgba(99, 102, 241, 0.2)', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#c7d2fe' }}
            >
              {serverActionLoading ? 'Starting...' : 'Start Server'}
            </button>
          )}
        </div>
      </div>

      {/* Hero Circular Liquid Glass Battery Card */}
      <div className="hero-battery-card">
        <div>
          <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-dim)', fontWeight: 700 }}>
            Power & Battery Architecture
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 12 }}>
            <div className="battery-percent-num" style={{ color: battColor }}>
              {battPercent}%
            </div>

            <div
              className="battery-status-badge"
              style={{
                backgroundColor: `${battColor}22`,
                color: battColor,
                border: `1px solid ${battColor}44`
              }}
            >
              {isCharging ? (
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

          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>
            {stats?.time_remaining ? (
              <span>⏱️ Estimated Time: <strong style={{ color: 'var(--text-main)' }}>{stats.time_remaining}</strong></span>
            ) : (
              <span>⚡ Power source: {stats?.power_source}</span>
            )}
          </div>
        </div>

        {/* Circular SVG Progress Ring */}
        <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background track */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="10"
            />
            {/* Animated progress fill */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke={battColor}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.5s',
                filter: `drop-shadow(0 0 8px ${battColor}88)`
              }}
            />
          </svg>

          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: battColor }}>{battPercent}%</div>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-dim)', fontWeight: 700 }}>
              {isCharging ? 'Charge' : 'Remaining'}
            </div>
          </div>
        </div>
      </div>

      {/* Battery Health & Lifecycle Banner Card */}
      <div className="card" style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
              Battery Health: {stats?.battery_health}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              {stats?.cycle_count} cycles recorded • Apple design rated for 1,000 cycles
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-dim)', fontWeight: 700 }}>
            Thermal Pressure
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginTop: 2 }}>
            {stats?.thermal_state || 'Nominal • Cool'}
          </div>
        </div>
      </div>

      {/* 4-Card Hardware & Resource Grid */}
      <div className="stats-grid">
        {/* CPU */}
        <div className="stat-item-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">CPU Usage</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>{stats?.cpu_model || 'Apple M4'}</span>
          </div>
          <div className="stat-value">{stats?.cpu_usage}%</div>
          <div className="stat-bar">
            <div
              className="stat-bar-fill"
              style={{
                width: `${Math.min(100, stats?.cpu_usage || 0)}%`,
                backgroundColor: (stats?.cpu_usage || 0) > 80 ? 'var(--color-red)' : (stats?.cpu_usage || 0) > 50 ? 'var(--color-amber)' : '#818cf8'
              }}
            />
          </div>
        </div>

        {/* RAM */}
        <div className="stat-item-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Unified Memory</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>{stats?.ram_used_gb || ''} / {stats?.ram_total_gb || '16 GB'}</span>
          </div>
          <div className="stat-value">{stats?.ram_usage}%</div>
          <div className="stat-bar">
            <div
              className="stat-bar-fill"
              style={{
                width: `${Math.min(100, stats?.ram_usage || 0)}%`,
                backgroundColor: (stats?.ram_usage || 0) > 85 ? 'var(--color-red)' : (stats?.ram_usage || 0) > 70 ? 'var(--color-amber)' : '#06b6d4'
              }}
            />
          </div>
        </div>

        {/* Disk */}
        <div className="stat-item-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Macintosh HD</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>{stats?.disk_usage?.free || '60 GB'} free</span>
          </div>
          <div className="stat-value">{stats?.disk_usage?.percent || 18}%</div>
          <div className="stat-bar">
            <div
              className="stat-bar-fill"
              style={{
                width: `${Math.min(100, stats?.disk_usage?.percent || 18)}%`,
                backgroundColor: (stats?.disk_usage?.percent || 0) > 85 ? 'var(--color-red)' : '#10b981'
              }}
            />
          </div>
        </div>

        {/* Network & Platform */}
        <div className="stat-item-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Local Network</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>Wi-Fi</span>
          </div>
          <div className="stat-value" style={{ fontSize: 18, fontFamily: 'monospace', letterSpacing: 0 }}>
            {stats?.local_ip || '192.168.29.20'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            Subnet active • Ready for dashboard reporting
          </div>
        </div>
      </div>
    </div>
  )
}
