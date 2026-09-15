import React, { useEffect, useState } from 'react'

export default function Settings() {
  const [config, setConfig] = useState<any>({
    dashboardUrl: '',
    userId: '',
    deviceId: '',
    intervalMin: 5,
    autoStart: false
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(window as any).api.getConfig().then((c: any) => setConfig(c))
  }, [])

  const handleChange = (key: string, value: any) => {
    setConfig({ ...config, [key]: value })
    ;(window as any).api.setConfig(key, value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Settings</h1>
        {saved && <span style={{ color: 'var(--color-green)', fontSize: 13 }}>Saved ✓</span>}
      </div>

      <div className="card">
        <h2>Connection</h2>
        <div className="form-group">
          <label>Dashboard URL</label>
          <input 
            type="text" 
            className="form-control" 
            value={config.dashboardUrl}
            placeholder="http://localhost:8080"
            onChange={(e) => handleChange('dashboardUrl', e.target.value)} 
          />
          <small style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4, display: 'block' }}>
            The public or local URL of your Statuser server.
          </small>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label>User ID (Optional)</label>
          <input 
            type="text" 
            className="form-control" 
            value={config.userId}
            placeholder="default"
            onChange={(e) => handleChange('userId', e.target.value)} 
          />
        </div>
      </div>

      <div className="card">
        <h2>Agent Configuration</h2>
        <div className="form-group">
          <label>Device ID</label>
          <input 
            type="text" 
            className="form-control" 
            value={config.deviceId}
            onChange={(e) => handleChange('deviceId', e.target.value)} 
          />
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Reporting Interval (minutes)</label>
          <select 
            className="form-control"
            value={config.intervalMin}
            onChange={(e) => handleChange('intervalMin', parseInt(e.target.value))}
          >
            <option value={1}>1 minute</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={0}>Manual only</option>
          </select>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={config.autoStart}
              onChange={(e) => handleChange('autoStart', e.target.checked)} 
            />
            Start automatically at login
          </label>
        </div>
      </div>
    </div>
  )
}
