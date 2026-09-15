import React, { useEffect, useState } from 'react'

interface DevicesProps {
  onToast: (type: 'success' | 'error', message: string) => void
}

export default function Devices({ onToast }: DevicesProps) {
  const [devices, setDevices] = useState<any[]>([])
  const [localDevice, setLocalDevice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isServerOffline, setIsServerOffline] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const loadDevices = async () => {
    try {
      // Always get the latest local machine telemetry
      const local = await window.api.getLocalDevice()
      setLocalDevice(local)

      const config = await window.api.getConfig()
      const url = config.dashboardUrl || 'http://localhost:8080'
      setServerUrl(url)

      // Fetch devices via native Electron network stack (no CORS restrictions)
      const res = await window.api.fetchDevices(url, config.userId)

      if (res.success && res.devices) {
        setDevices(res.devices)
        setIsServerOffline(false)
        setErrorMessage(null)
      } else {
        setIsServerOffline(true)
        setErrorMessage(res.message || `Could not connect to ${url}`)
      }
    } catch (e: any) {
      setIsServerOffline(true)
      setErrorMessage(e.message || 'Connection error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 6000)
    return () => clearInterval(interval)
  }, [])

  // Merge devices: if server returned devices, use that list (ensuring local device is marked)
  // If server is offline, display the local device so the screen is never blank!
  let allDevices = [...devices]

  if (allDevices.length === 0 && localDevice) {
    allDevices = [localDevice]
  } else if (localDevice) {
    // If local device isn't in server list yet, prepend it
    const exists = allDevices.some((d) => d.id === localDevice.id || d.name === localDevice.name)
    if (!exists) {
      allDevices = [localDevice, ...allDevices]
    }
  }

  const filteredDevices = allDevices.filter((d) =>
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
          <p className="page-subtitle">Real-time telemetry across your computers & phones</p>
        </div>

        <button
          className="btn"
          onClick={() => {
            setLoading(true)
            loadDevices()
            onToast('success', 'Checking device network...')
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

      {/* Server Offline / Status Notice */}
      {isServerOffline && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '18px',
            fontSize: '13px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fcd34d', fontWeight: 700 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Dashboard Server Offline ({serverUrl || 'http://localhost:8080'})
            </div>

            <button
              className="btn sm"
              onClick={() => {
                setLoading(true)
                loadDevices()
              }}
              style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fcd34d' }}
            >
              Retry Connection
            </button>
          </div>

          <p style={{ color: 'var(--text-muted)', lineHeight: 1.5, margin: '4px 0 8px 0' }}>
            To sync metrics between devices, run your central server in a terminal with:
            <code style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '2px 8px', borderRadius: 4, marginLeft: 6, color: '#fbbf24', fontFamily: 'monospace' }}>
              ./start_server.sh
            </code>
          </p>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Showing local telemetry for this Mac below.
          </div>
        </div>
      )}

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

      {/* Device Cards List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        {filteredDevices.map((device) => {
          const isThisMachine = device.is_local || (localDevice && device.id === localDevice.id)
          const isOnline = isThisMachine ? true : Date.now() - (device.last_seen || 0) * 1000 < 10 * 60 * 1000
          const battColor = device.is_charging
            ? '#06b6d4'
            : device.battery_level > 40
              ? '#10b981'
              : device.battery_level > 20
                ? '#f59e0b'
                : '#f43f5e'

          return (
            <div
              key={device.id || device.name}
              className="card"
              style={{
                marginBottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px',
                borderLeft: isThisMachine ? '3px solid #6366f1' : undefined
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: isThisMachine ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isThisMachine ? '#818cf8' : '#a5b4fc',
                    border: `1px solid ${isThisMachine ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`
                  }}
                >
                  {getPlatformIcon(device.platform)}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-main)' }}>
                      {device.name}
                    </span>

                    {isThisMachine && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.35)'
                        }}
                      >
                        This Mac
                      </span>
                    )}

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
                    {device.model || 'Unknown model'} • {device.platform}
                    {device.battery_health && ` • Health: ${device.battery_health}`}
                  </div>
                </div>
              </div>

              {/* Right Side: Battery level and specs */}
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 24 }}>
                {device.cpu_usage !== undefined && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>CPU</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{device.cpu_usage}%</div>
                  </div>
                )}

                {device.ram_usage !== undefined && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>RAM</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{device.ram_usage}%</div>
                  </div>
                )}

                <div style={{ minWidth: 70, textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: battColor, letterSpacing: -0.5 }}>
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
