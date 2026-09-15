import React, { useEffect, useState } from 'react'

interface SettingsProps {
  onToast: (type: 'success' | 'error', message: string) => void
  onIntervalChange: (min: number) => void
}

export default function Settings({ onToast, onIntervalChange }: SettingsProps) {
  const [config, setConfig] = useState<any>({
    dashboardUrl: 'http://localhost:8080',
    userId: 'default',
    deviceId: '',
    intervalMin: 5,
    autoStart: false
  })

  const [initialConfig, setInitialConfig] = useState<any>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [appInfo, setAppInfo] = useState<any>(null)

  useEffect(() => {
    window.api.getConfig().then((c: any) => {
      setConfig(c)
      setInitialConfig(c)
    })

    window.api.getAppInfo().then(setAppInfo)
  }, [])

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await window.api.testConnection(config.dashboardUrl, config.userId)
      setTestResult(res)
      if (res.success) {
        onToast('success', res.message)
      } else {
        onToast('error', res.message)
      }
    } catch (e: any) {
      const errRes = { success: false, message: e.message || 'Test failed' }
      setTestResult(errRes)
      onToast('error', errRes.message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.setConfig('dashboardUrl', config.dashboardUrl.trim())
      await window.api.setConfig('userId', config.userId.trim() || 'default')
      await window.api.setConfig('deviceId', config.deviceId.trim())
      await window.api.setConfig('intervalMin', Number(config.intervalMin))
      await window.api.setConfig('autoStart', Boolean(config.autoStart))

      onIntervalChange(Number(config.intervalMin))
      setInitialConfig({ ...config })
      onToast('success', 'Settings saved successfully')
    } catch (err: any) {
      onToast('error', err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const hasUnsavedChanges = initialConfig && JSON.stringify(config) !== JSON.stringify(initialConfig)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure server connectivity and reporting frequency</p>
        </div>

        <button
          className="btn primary"
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
        >
          {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved ✓'}
        </button>
      </div>

      {/* Connection Card */}
      <div className="card">
        <h2 className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          Server Connection
        </h2>

        <div className="form-group">
          <label>Dashboard Server URL</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              className="form-control"
              value={config.dashboardUrl}
              placeholder="http://localhost:8080 or https://your-tunnel.trycloudflare.com"
              onChange={(e) => {
                setConfig({ ...config, dashboardUrl: e.target.value })
                setTestResult(null)
              }}
            />
            <button
              className="btn"
              onClick={handleTestConnection}
              disabled={testing || !config.dashboardUrl}
              style={{ whiteSpace: 'nowrap' }}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          <span className="form-helper">
            The HTTP or HTTPS URL where your Statuser dashboard server is listening.
          </span>

          {testResult && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                fontWeight: 600,
                color: testResult.success ? 'var(--color-green)' : 'var(--color-red)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{testResult.success ? '✓' : '✗'}</span>
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label>User ID (Optional for Multi-Tenant)</label>
          <input
            type="text"
            className="form-control"
            value={config.userId}
            placeholder="default"
            onChange={(e) => setConfig({ ...config, userId: e.target.value })}
          />
          <span className="form-helper">
            Scopes telemetry to this user account on the dashboard. Leave as "default" for personal setups.
          </span>
        </div>
      </div>

      {/* Agent Preferences Card */}
      <div className="card">
        <h2 className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Agent Behavior
        </h2>

        <div className="form-group">
          <label>Device Identifier</label>
          <input
            type="text"
            className="form-control"
            value={config.deviceId}
            placeholder="irfans-macbook-air"
            onChange={(e) => setConfig({ ...config, deviceId: e.target.value })}
          />
          <span className="form-helper">
            Unique name identifying this machine in your dashboard device grid.
          </span>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Background Reporting Interval</label>
          <select
            className="form-control"
            value={config.intervalMin}
            onChange={(e) => setConfig({ ...config, intervalMin: parseInt(e.target.value, 10) })}
          >
            <option value={1}>Every 1 minute (High Frequency)</option>
            <option value={5}>Every 5 minutes (Recommended)</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every 1 hour</option>
            <option value={0}>Manual sync only</option>
          </select>
          <span className="form-helper">
            How frequently Statuser reports battery and hardware metrics silently in the background.
          </span>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.autoStart}
              onChange={(e) => setConfig({ ...config, autoStart: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
            />
            <span>Launch Statuser automatically when I log into my Mac</span>
          </label>
          <span className="form-helper" style={{ marginLeft: 26 }}>
            Keeps telemetry continuously running in the macOS menu bar.
          </span>
        </div>
      </div>

      {/* Diagnostics / About Card */}
      <div className="card" style={{ background: 'rgba(15, 20, 30, 0.4)' }}>
        <h2 className="card-title" style={{ color: 'var(--text-muted)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          System & App Diagnostics
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 12 }}>
          <div>
            <div style={{ color: 'var(--text-dim)' }}>App Version</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{appInfo?.version || '1.0.0'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)' }}>Architecture</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{appInfo?.platform}-{appInfo?.arch}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)' }}>Electron Runtime</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>v{appInfo?.electron || '33'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
