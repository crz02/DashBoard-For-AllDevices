import si from 'systeminformation'
import os from 'os'

export interface TelemetryPayload {
  device_id: string
  name: string
  platform: string
  model: string
  battery_level: number
  is_charging: boolean
  power_source: string
  battery_health: string
  cycle_count: number
  temperature: number
  cpu_usage: number
  ram_usage: number
}

export async function getTelemetry(deviceId: string): Promise<TelemetryPayload> {
  const [battery, cpu, mem, osInfo, system] = await Promise.all([
    si.battery(),
    si.currentLoad(),
    si.mem(),
    si.osInfo(),
    si.system()
  ])

  // Get CPU temperature, some systems might not support this without root
  let temp = 0
  try {
    const cpuTemp = await si.cpuTemperature()
    temp = cpuTemp.main || 0
  } catch (e) {}

  let is_charging = false
  let power_source = 'AC Power'
  let battery_level = 100
  let battery_health = 'Good'
  let cycle_count = 0

  if (battery.hasBattery) {
    battery_level = battery.percent
    is_charging = battery.isCharging
    power_source = battery.acConnected ? 'AC Power' : 'Battery'
    
    // Calculate health if capacity info is available
    if (battery.maxcapacity && battery.designedcapacity) {
      const healthPct = Math.round((battery.maxcapacity / battery.designedcapacity) * 100)
      battery_health = `${healthPct}%`
    }
    
    cycle_count = battery.cyclecount || 0
  } else {
    // Desktop machine
    power_source = 'AC Power (Desktop)'
    battery_health = 'N/A (Desktop)'
  }

  // Calculate platform identifier expected by backend
  let platform = 'linux'
  if (os.platform() === 'darwin') platform = 'macos'
  if (os.platform() === 'win32') platform = 'windows'

  return {
    device_id: deviceId,
    name: os.hostname(),
    platform,
    model: system.model || osInfo.distro || 'Unknown Device',
    battery_level: Math.round(battery_level),
    is_charging,
    power_source,
    battery_health,
    cycle_count,
    temperature: temp,
    cpu_usage: Math.round(cpu.currentLoad * 10) / 10,
    ram_usage: Math.round((mem.active / mem.total) * 1000) / 10
  }
}
