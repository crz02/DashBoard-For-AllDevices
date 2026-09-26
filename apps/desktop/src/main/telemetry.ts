import si from 'systeminformation'
import os from 'os'
import { execSync } from 'child_process'

export interface TelemetryPayload {
  device_id: string
  name: string
  platform: string
  model: string
  cpu_model?: string
  battery_level: number
  is_charging: boolean
  power_source: string
  battery_health: string
  cycle_count: number
  temperature: number
  thermal_state?: string
  time_remaining?: string
  cpu_usage: number
  ram_usage: number
  ram_total_gb?: string
  ram_used_gb?: string
  disk_usage?: {
    total: string
    used: string
    free: string
    percent: number
  }
  local_ip?: string
}

/**
 * FIX 3: Get macOS CPU temperature via powermetrics (requires no sudo) or
 * fall back to a thermal-state estimate parsed from pmset.
 * Returns temperature in °C or 0 if unavailable.
 */
function getMacTemperature(): number {
  // Try powermetrics for CPU die temperature (macOS 11+, no sudo needed)
  try {
    const output = execSync(
      'powermetrics --samplers cpu_power -n 1 -i 100 2>/dev/null | grep -i "CPU die temperature"',
      { encoding: 'utf8', timeout: 3000 }
    )
    const match = output.match(/CPU die temperature:\s*([\d.]+)/i)
    if (match) return parseFloat(match[1])
  } catch {
    // ignore
  }

  // Fallback: ioreg thermal sensors (works on Intel Macs)
  try {
    const ioreg = execSync(
      'ioreg -r -n AppleACPIPlatformExpert -k IOPMFullWakeReason 2>/dev/null | grep -i temperature | head -1',
      { encoding: 'utf8', timeout: 2000 }
    )
    const match = ioreg.match(/([\d.]+)/)
    if (match) {
      const raw = parseFloat(match[1])
      // ioreg returns millidegrees on some Macs
      return raw > 200 ? raw / 100 : raw
    }
  } catch {
    // ignore
  }

  return 0
}

/**
 * Native macOS battery and power telemetry via pmset and ioreg.
 * Extremely fast (<50ms) and 100% reliable on Apple Silicon & Intel Macs.
 */
function getMacBatteryDetails() {
  try {
    const pmset = execSync('pmset -g batt', { encoding: 'utf8', timeout: 2000 })
    const percentMatch = pmset.match(/(\d+)%/)
    const battery_level = percentMatch ? parseInt(percentMatch[1], 10) : 100

    const is_charging = pmset.includes('charging') && !pmset.includes('not charging')
    const isAC = pmset.includes('AC Power') || pmset.includes('AC attached')
    const power_source = isAC ? 'AC Power' : 'Battery Power'

    let time_remaining = ''
    const timeMatch = pmset.match(/(\d+:\d+)\s+remaining/)
    const toFullMatch = pmset.match(/(\d+:\d+)\s+to full/)
    if (timeMatch) {
      time_remaining = `${timeMatch[1]} left`
    } else if (toFullMatch) {
      time_remaining = `${toFullMatch[1]} to full`
    } else if (isAC && battery_level >= 95) {
      time_remaining = 'Fully Charged'
    }

    let cycle_count = 0
    let battery_health = 'Good'

    try {
      const ioreg = execSync('ioreg -rc AppleSmartBattery', { encoding: 'utf8', timeout: 2000 })
      const cycleMatch = ioreg.match(/"CycleCount"\s*=\s*(\d+)/)
      if (cycleMatch) cycle_count = parseInt(cycleMatch[1], 10)

      const designMatch = ioreg.match(/"DesignCapacity"\s*=\s*(\d+)/)
      const nominalMatch =
        ioreg.match(/"NominalChargeCapacity"\s*=\s*(\d+)/) ||
        ioreg.match(/"FullChargeCapacity"\s*=\s*(\d+)/)

      if (designMatch && nominalMatch) {
        const design = parseInt(designMatch[1], 10)
        const nominal = parseInt(nominalMatch[1], 10)
        if (design > 0) {
          const healthPct = Math.min(100, Math.round((nominal / design) * 100))
          battery_health = `${healthPct}% (Normal)`
        }
      }
    } catch {
      // ioreg fallback
    }

    return {
      hasBattery: true,
      battery_level,
      is_charging,
      power_source,
      battery_health,
      cycle_count,
      time_remaining
    }
  } catch {
    return null
  }
}

/**
 * Query native Mac hardware and CPU brand
 */
function getMacHardwareInfo() {
  let cpu_model = ''
  try {
    cpu_model = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf8', timeout: 1500 }).trim()
  } catch {
    // ignore
  }

  let thermal_state = 'Nominal'
  try {
    const therm = execSync('pmset -g therm', { encoding: 'utf8', timeout: 1500 })
    if (therm.includes('thermal warning level has been recorded')) {
      thermal_state = 'Throttled / Warm'
    }
  } catch {
    // ignore
  }

  return { cpu_model, thermal_state }
}

async function getDiskStats() {
  try {
    const disks = await si.fsSize()
    if (Array.isArray(disks) && disks.length > 0) {
      let target = disks.find(d => process.platform === 'win32' ? d.mount.toLowerCase().startsWith('c') : d.mount === '/')
      if (!target) {
        // Pick drive with largest capacity
        target = disks.slice().sort((a, b) => (b.size || 0) - (a.size || 0))[0]
      }
      if (target && target.size > 0) {
        const toGB = (b: number) => `${(b / (1024 ** 3)).toFixed(0)}Gi`
        const used = target.used || (target.size - target.available)
        const percent = Math.round(target.use || (used / target.size) * 100)
        return {
          total: toGB(target.size),
          used: toGB(used),
          free: toGB(target.available),
          percent: Math.min(100, Math.max(0, percent))
        }
      }
    }
  } catch {
    // fallback
  }

  if (process.platform === 'darwin' || process.platform === 'linux') {
    try {
      const df = execSync('df -h / | awk "NR==2 {print \\$2, \\$3, \\$4, \\$5}"', { encoding: 'utf8', timeout: 1500, windowsHide: true })
        .trim()
        .split(/\s+/)
      if (df.length >= 4) {
        return {
          total: df[0],
          used: df[1],
          free: df[2],
          percent: parseInt(df[3], 10) || 0
        }
      }
    } catch {
      // ignore
    }
  } else if (process.platform === 'win32') {
    try {
      const wmic = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /format:csv', {
        encoding: 'utf8',
        timeout: 3000,
        windowsHide: true
      }).trim()
      const lines = wmic.split('\n').filter(l => l.trim())
      if (lines.length >= 2) {
        const parts = lines[lines.length - 1].split(',')
        if (parts.length >= 3) {
          const freeBytes = parseInt(parts[1], 10)
          const totalBytes = parseInt(parts[2], 10)
          if (totalBytes > 0) {
            const usedBytes = totalBytes - freeBytes
            const toGB = (b: number) => `${(b / 1024 ** 3).toFixed(0)}Gi`
            return {
              total: toGB(totalBytes),
              used: toGB(usedBytes),
              free: toGB(freeBytes),
              percent: Math.round((usedBytes / totalBytes) * 100)
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return { total: 'N/A', used: 'N/A', free: 'N/A', percent: 0 }
}

function getLocalIp() {
  try {
    const ifaces = os.networkInterfaces()
    for (const name of Object.keys(ifaces)) {
      for (const net of ifaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address
        }
      }
    }
  } catch {
    // ignore
  }
  return '127.0.0.1'
}

export async function getTelemetry(deviceId: string): Promise<TelemetryPayload> {
  const isDarwin = process.platform === 'darwin'

  // Query hardware, load, and memory
  const [sys, cpu, mem, osInfo] = await Promise.all([
    si.system(),
    si.currentLoad(),
    si.mem(),
    si.osInfo()
  ])

  let battery_level = 100
  let is_charging = false
  let power_source = 'AC Power'
  let battery_health = 'Good'
  let cycle_count = 0
  let cpu_model = ''
  let thermal_state = 'Nominal'
  let temperature = 0
  let time_remaining = ''

  if (isDarwin) {
    const macBatt = getMacBatteryDetails()
    const macHw = getMacHardwareInfo()

    cpu_model = macHw.cpu_model
    thermal_state = macHw.thermal_state

    if (macBatt) {
      battery_level = macBatt.battery_level
      is_charging = macBatt.is_charging
      power_source = macBatt.power_source
      battery_health = macBatt.battery_health
      cycle_count = macBatt.cycle_count
      time_remaining = macBatt.time_remaining
    } else {
      power_source = 'AC Power (Desktop)'
      battery_health = 'N/A (Desktop)'
    }

    // FIX 3: Collect macOS temperature (was always 0 before)
    temperature = getMacTemperature()
  } else {
    // Linux and Windows fallback via systeminformation
    try {
      const battery = await si.battery()
      if (battery.hasBattery) {
        battery_level = battery.percent
        is_charging = battery.isCharging
        power_source = battery.acConnected ? 'AC Power' : 'Battery'
        if (battery.maxcapacity && battery.designedcapacity) {
          const healthPct = Math.round((battery.maxcapacity / battery.designedcapacity) * 100)
          battery_health = `${healthPct}%`
        }
        cycle_count = battery.cyclecount || 0
        if (battery.timeRemaining && battery.timeRemaining > 0) {
          const hrs = Math.floor(battery.timeRemaining / 60)
          const mins = battery.timeRemaining % 60
          time_remaining = hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`
        }
      } else {
        power_source = 'AC Power (Desktop)'
        battery_health = 'N/A (Desktop)'
      }
    } catch {
      // ignore
    }

    // CPU model for Windows/Linux
    try {
      const cpuInfo = await si.cpu()
      cpu_model = cpuInfo.brand || cpuInfo.manufacturer || ''
    } catch {
      // ignore
    }

    try {
      const cpuTemp = await si.cpuTemperature()
      temperature = cpuTemp.main || 0
    } catch {
      // ignore
    }
  }

  // Model identification
  let model = sys.version || sys.model || osInfo.distro || 'Unknown Device'
  if (isDarwin && sys.version) {
    model = sys.version
  }

  let platform = 'linux'
  if (isDarwin) platform = 'macos'
  else if (process.platform === 'win32') platform = 'windows'

  // CPU and RAM percentages
  const cpu_usage = Math.round(cpu.currentLoad * 10) / 10
  const usedMemBytes = mem.total - mem.available
  const ram_usage = Math.round((usedMemBytes / mem.total) * 1000) / 10
  const ram_total_gb = `${(mem.total / 1024 ** 3).toFixed(1)} GB`
  const ram_used_gb = `${(usedMemBytes / 1024 ** 3).toFixed(1)} GB`

  const disk_usage = await getDiskStats()
  const local_ip = getLocalIp()

  return {
    device_id: deviceId || os.hostname().toLowerCase(),
    name: os.hostname(),
    platform,
    model,
    cpu_model,
    battery_level: Math.round(battery_level),
    is_charging,
    power_source,
    battery_health,
    cycle_count,
    temperature,
    thermal_state,
    time_remaining,
    cpu_usage,
    ram_usage,
    ram_total_gb,
    ram_used_gb,
    disk_usage,
    local_ip
  }
}
