import React, { useEffect, useState } from 'react'

export default function Devices() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDevices = async () => {
    try {
      const config = await (window as any).api.getConfig()
      if (!config.dashboardUrl) {
        setError('Dashboard URL not configured')
        setLoading(false)
        return
      }
      
      const url = `${config.dashboardUrl.replace(/\/$/, '')}/api/devices${config.userId ? `?user_id=${config.userId}` : ''}`
      const res = await fetch(url)
      
      if (res.ok) {
        const data = await res.json()
        setDevices(data.devices || [])
        setError('')
      } else {
        setError('Failed to fetch devices')
      }
    } catch (e: any) {
      setError(e.message || 'Connection error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>My Devices</h1>
        <button className="btn" onClick={() => { setLoading(true); loadDevices() }}>Refresh</button>
      </div>

      {loading && devices.length === 0 && <div>Loading devices...</div>}
      
      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-red)' }}>
          <h3 style={{ color: 'var(--color-red)' }}>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && devices.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h3 style={{ marginBottom: 8 }}>No devices found</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Make sure your Dashboard URL and User ID are correct in Settings.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        {devices.map((device) => (
          <div key={device.id} className="card" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>{device.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {device.platform} • {device.model || 'Unknown model'}
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 'bold',
                color: device.battery_level < 20 && !device.is_charging ? 'var(--color-red)' : 'var(--color-green)'
              }}>
                {device.battery_level}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {device.is_charging ? '⚡ Charging' : device.power_source}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
