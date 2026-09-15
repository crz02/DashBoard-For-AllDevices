import React, { useEffect, useState } from 'react'

export default function Home() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadStats = async () => {
    try {
      const data = await (window as any).api.getTelemetry()
      setStats(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleReportNow = async () => {
    await (window as any).api.triggerReport()
    loadStats()
  }

  if (loading || !stats) {
    return <div>Loading device stats...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>{stats.name}</h1>
        <button className="btn primary" onClick={handleReportNow}>Report Now</button>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 64, fontWeight: 'bold', color: stats.battery_level < 20 && !stats.is_charging ? 'var(--color-red)' : 'var(--color-green)' }}>
          {stats.battery_level}%
        </div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 16 }}>
          {stats.is_charging ? '⚡ Charging' : stats.power_source}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>CPU Usage</h3>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.cpu_usage}%</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>RAM Usage</h3>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.ram_usage}%</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Battery Health</h3>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.battery_health}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Temperature</h3>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.temperature ? `${stats.temperature}°C` : 'N/A'}</div>
        </div>
      </div>
    </div>
  )
}
