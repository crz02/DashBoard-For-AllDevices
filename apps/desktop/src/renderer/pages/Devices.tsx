import React, { useEffect, useState } from 'react'

interface DevicesProps {
  onToast: (type: 'success' | 'error', message: string) => void
}

export default function Devices({ onToast }: DevicesProps) {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const loadDevices = async () => {
    try {
      const config = await window.api.getConfig()
      if (!config.dashboardUrl) {
        setError('Dashboard URL is not configured. Please visit Settings.')
        setLoading(false)
        return
      }

      const url = `${config.dashboardUrl.replace(/\/$/, '')}/api/devices${config.userId && config.userId !== 'default' ? `?user_id=${encodeURIComponent(config.userId)}` : ''}`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })

      if (res.ok) {
        const data = await res.json()
        setDevices(data.devices || [])
        setError(null)
      } else {
        setError(`Server returned HTTP ${res.status}`)
      }
    } catch (e: any) {
      setError(e.message || 'Cannot connect to dashboard server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 8000)
    return () => clearInterval(interval)
  }, [])

  const filteredDevices = devices.filter((d) =>
    (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.model || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.platform || '').toLowerCase().includes(search.toLowerCase())
  )

  const getPlatformIcon = (platform: string) => {
    const p = (platform || '').toLowerCase()
    if (p.includes('mac') || p.includes('darwin')) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.66 1.38-.56.65-1.06 1.71-.93 2.74 1.04.08 2.06-.5 2.67-1.25z" />
        </svg>
      )
    }
    if (p.includes('win')) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 5.555L10.474 4.5v6.953H3V5.555zM3 12.5h7.474v6.953L3 18.445V12.5zm8.526-8.152L21 3v8.453h-9.474V4.348zm9.474 8.152V21l-9.474-1.348V12.5H21z" />
        </svg>
      )
    }
    if (p.includes('ios') || p.includes('iphone') || p.includes('ipad')) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      )
    }
    if (p.includes('android')) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v6c0 .83.67 1.5 1.5 1.5S5 16.33 5 15.5v-6C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-6c0-.83-.67-1.5-1.5-1.5zm-4.97-4.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 2.23 12.95 2 12 2s-1.85.23-2.64.63L7.88 1.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3C6.91 4.26 6 5.76 6 7.5h12c0-1.74-.91-3.24-2.47-4.34zM9 5.5c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zm6 0c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
        </svg>
      )
    }
    // Default linux / server
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Connected Devices</h1>
          <p className="page-subtitle">Real-time telemetry from all your machines & phones</p>
        </div>

        <button
          className="btn"
          onClick={() => {
            setLoading(true)
            loadDevices()
            onToast('success', 'Refreshing devices...')
          }}
          disabled={loading}
        >
          <svg className={loading ? 'spin' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Search Filter */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="form-control"
          placeholder="Filter devices by name, platform, or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '16px',
            color: '#fda4af',
            fontSize: '13px'
          }}
        >
          <strong>Connection Error:</strong> {error}
        </div>
      )}

      {!loading && !error && filteredDevices.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <h3 style={{ color: 'var(--text-main)', fontSize: 16, marginBottom: 6 }}>No Devices Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 400, margin: '0 auto' }}>
            Ensure your dashboard server is running and devices are configured with the correct Dashboard URL.
          </p>
        </div>
      )}

      {/* Device Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        {filteredDevices.map((device) => {
          const isOnline = Date.now() - (device.last_seen || 0) * 1000 < 10 * 60 * 1000
          const battColor = device.is_charging
            ? '#06b6d4'
            : device.battery_level > 40
              ? '#10b981'
              : device.battery_level > 20
                ? '#f59e0b'
                : '#f43f5e'

          return (
            <div
              key={device.id}
              className="card"
              style={{
                marginBottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a5b4fc',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  {getPlatformIcon(device.platform)}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>
                      {device.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: isOnline ? 'var(--color-green)' : 'var(--text-muted)'
                      }}
                    >
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                    {device.model || 'Unknown hardware'} • {device.platform}
                  </div>
                </div>
              </div>

              {/* Right Side Battery & Specs */}
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 20 }}>
                {device.cpu_usage !== undefined && (
                  <div style={{ textAlign: 'right', display: 'none' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>CPU</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{device.cpu_usage}%</div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: battColor, letterSpacing: -0.5 }}>
                    {device.battery_level}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {device.is_charging ? '⚡ Charging' : device.power_source || 'Battery'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
