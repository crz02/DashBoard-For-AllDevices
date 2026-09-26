import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, net, shell, clipboard, Notification } from 'electron'
import { join } from 'path'
import os from 'os'
import { spawn, ChildProcess } from 'child_process'
import Store from 'electron-store'
import { getTelemetry, TelemetryPayload } from './telemetry'
import { reportTelemetry } from './reporter'

const store = new Store({
  defaults: {
    dashboardUrl: 'http://localhost:8080',
    userId: 'default',
    deviceId: os.hostname().toLowerCase(),
    intervalMin: 5,
    autoStart: false,
    apiKey: ''   // FIX 4: API key for /api/report auth
  }
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let reportInterval: NodeJS.Timeout | null = null
let isQuitting = false
let lastTelemetry: TelemetryPayload | null = null
let lastReportTime: number | null = null
let lastReportStatus: { success: boolean; message: string; timestamp: number } | null = null
let serverProcess: ChildProcess | null = null
let hasNotifiedLowBattery = false

function setupApplicationMenu() {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Preferences...',
                accelerator: 'Command+,',
                click: () => {
                  createWindow()
                  mainWindow?.webContents.send('navigate-to', 'settings')
                }
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              {
                label: 'Quit Statuser',
                accelerator: 'Command+Q',
                click: () => {
                  isQuitting = true
                  app.quit()
                }
              }
            ]
          }
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const }
            ]
          : [{ role: 'close' as const }])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    return
  }

  const iconPath = join(__dirname, '../../resources/icon.png')
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'

  // Platform-specific window options
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 900,
    height: 670,
    minWidth: 520,
    minHeight: 540,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  }

  if (isMac) {
    // macOS: transparent + vibrancy for Liquid Glass effect
    windowOptions.transparent = true
    windowOptions.vibrancy = 'under-window'
    windowOptions.visualEffectState = 'active'
    windowOptions.backgroundColor = '#00000000'
    windowOptions.titleBarStyle = 'hiddenInset'
    windowOptions.trafficLightPosition = { x: 18, y: 18 }
  } else {
    // Windows / Linux: solid background, standard title bar
    windowOptions.backgroundColor = '#090d16'
    windowOptions.titleBarStyle = 'default'
    windowOptions.autoHideMenuBar = isWin
  }

  mainWindow = new BrowserWindow(windowOptions)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Send platform info to renderer once DOM is ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('platform-info', {
      platform: process.platform,
      isMac,
      isWin,
      isLinux: process.platform === 'linux'
    })
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function findServerScriptPath(): string | null {
  const fs = require('fs')
  const possiblePaths = [
    // Dev mode — relative from compiled output
    join(__dirname, '../../../../server/app.py'),
    join(__dirname, '../../../server/app.py'),
    join(__dirname, '../../server/app.py'),
    // Packaged app — server bundled inside resources
    join(process.resourcesPath || '', 'server', 'app.py'),
    // Fallback: next to the app executable
    join(app.getPath('exe'), '..', 'server', 'app.py'),
    // CWD (useful when running via npm run dev)
    join(process.cwd(), 'server/app.py'),
  ]
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return p
    } catch {
      // ignore permission errors
    }
  }
  return null
}

/** Get the python executable name for the current platform */
function getPythonCommand(): string {
  if (process.platform === 'win32') {
    // Windows: try 'python' first (py launcher also works)
    try {
      require('child_process').execSync('python --version', { stdio: 'ignore', timeout: 2000 })
      return 'python'
    } catch {
      try {
        require('child_process').execSync('python3 --version', { stdio: 'ignore', timeout: 2000 })
        return 'python3'
      } catch {
        return 'python'
      }
    }
  }
  return 'python3'
}

async function checkIsServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const request = net.request({
        method: 'GET',
        url: 'http://127.0.0.1:8080/api/devices'
      })
      const timer = setTimeout(() => {
        request.abort()
        resolve(false)
      }, 1000)
      request.on('response', (res) => {
        clearTimeout(timer)
        resolve(res.statusCode >= 200 && res.statusCode < 400)
      })
      request.on('error', () => {
        clearTimeout(timer)
        resolve(false)
      })
      request.end()
    } catch {
      resolve(false)
    }
  })
}

async function startServer(): Promise<{ success: boolean; message: string }> {
  const isRunning = await checkIsServerRunning()
  if (isRunning) {
    return { success: true, message: 'Server is already running on http://localhost:8080' }
  }

  const scriptPath = findServerScriptPath()
  if (!scriptPath) {
    return { success: false, message: 'Could not locate server/app.py on this machine' }
  }

  try {
    const pythonCmd = getPythonCommand()
    serverProcess = spawn(pythonCmd, [scriptPath], {
      detached: false,
      stdio: 'ignore',
      // On Windows, use shell to resolve python from PATH
      shell: process.platform === 'win32'
    })

    // Poll for port 8080 to become active (up to 3 seconds)
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500))
      if (await checkIsServerRunning()) {
        updateTrayMenu()
        return { success: true, message: 'Dashboard server started on http://localhost:8080' }
      }
    }
    return { success: false, message: 'Server launched, but not yet responding on port 8080' }
  } catch (e: any) {
    return { success: false, message: e.message || 'Failed to start server process' }
  }
}

async function stopServer(): Promise<{ success: boolean; message: string }> {
  if (serverProcess) {
    try {
      if (process.platform === 'win32') {
        // Windows: use taskkill to terminate the process tree
        require('child_process').execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: 'ignore' })
      } else {
        serverProcess.kill('SIGTERM')
      }
    } catch {
      // ignore kill errors
    }
    serverProcess = null
  }
  try {
    if (process.platform === 'win32') {
      require('child_process').execSync('taskkill /F /IM python.exe /FI "WINDOWTITLE eq server*" 2>nul', { stdio: 'ignore' })
    } else {
      require('child_process').execSync('pkill -f "python3 server/app.py" || true', { stdio: 'ignore' })
    }
  } catch {
    // ignore
  }
  updateTrayMenu()
  return { success: true, message: 'Dashboard server stopped' }
}

async function updateTrayMenu() {
  if (!tray) return

  const isServerActive = await checkIsServerRunning()

  const batteryText = lastTelemetry
    ? `Battery: ${lastTelemetry.battery_level}% (${lastTelemetry.power_source}${lastTelemetry.time_remaining ? ` • ${lastTelemetry.time_remaining}` : ''})`
    : 'Connecting...'

  const cpuRamText = lastTelemetry
    ? `CPU: ${lastTelemetry.cpu_usage}%  •  RAM: ${lastTelemetry.ram_usage}%`
    : ''

  const diskText = lastTelemetry?.disk_usage
    ? `Disk: ${lastTelemetry.disk_usage.used} / ${lastTelemetry.disk_usage.total} (${lastTelemetry.disk_usage.percent}%)`
    : ''

  const contextMenu = Menu.buildFromTemplate([
    { label: lastTelemetry?.model || 'Statuser Agent', enabled: false },
    { label: batteryText, enabled: false },
    ...(cpuRamText ? [{ label: cpuRamText, enabled: false }] : []),
    ...(diskText ? [{ label: diskText, enabled: false }] : []),
    { type: 'separator' },
    {
      label: 'Open Dashboard App',
      click: createWindow
    },
    {
      label: 'Report Telemetry Now',
      click: async () => {
        await triggerReport()
      }
    },
    {
      label: 'Open Web Dashboard in Browser',
      click: () => {
        const url = store.get('dashboardUrl') as string
        shell.openExternal(url || 'http://localhost:8080')
      }
    },
    { type: 'separator' },
    {
      label: isServerActive ? 'Local Server: 🟢 Running (:8080)' : 'Local Server: ⚪ Offline',
      click: async () => {
        if (isServerActive) {
          await stopServer()
        } else {
          await startServer()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      accelerator: 'Command+,',
      click: () => {
        createWindow()
        mainWindow?.webContents.send('navigate-to', 'settings')
      }
    },
    {
      label: 'Quit Statuser',
      accelerator: 'CommandOrControl+Q',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // On macOS menu bar, update title with battery % and charging bolt
  if (process.platform === 'darwin' && lastTelemetry) {
    const symbol = lastTelemetry.is_charging ? '⚡' : ''
    tray.setTitle(` ${symbol}${lastTelemetry.battery_level}%`)
  }
}

function setupTray() {
  const isMac = process.platform === 'darwin'
  const trayIconPath = isMac
    ? join(__dirname, '../../resources/trayTemplate.png')
    : join(__dirname, '../../resources/icon.png')
  let icon = nativeImage.createFromPath(trayIconPath)

  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty()
  } else if (isMac) {
    // Template images are macOS-only (auto-adapt to dark/light menu bar)
    icon.setTemplateImage(true)
  } else {
    // Windows/Linux: resize icon to appropriate tray size (16x16 or 32x32)
    icon = icon.resize({ width: 16, height: 16 })
  }

  tray = new Tray(icon)
  tray.setToolTip('Statuser Agent — Telemetry Monitor')
  updateTrayMenu()

  tray.on('click', () => {
    // On Windows, single click should toggle window visibility
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      createWindow()
    }
  })

  tray.on('double-click', () => {
    createWindow()
  })
}

function checkLowBatteryAlert(stats: TelemetryPayload) {
  if (!stats.is_charging && stats.battery_level <= 20) {
    if (!hasNotifiedLowBattery && Notification.isSupported()) {
      const platformName = process.platform === 'darwin' ? 'Mac' : process.platform === 'win32' ? 'PC' : 'device'
      new Notification({
        title: 'Statuser — Low Battery',
        body: `Your battery is at ${stats.battery_level}%. Connect your ${platformName} to power.`,
        icon: join(__dirname, '../../resources/icon.png')
      }).show()
      hasNotifiedLowBattery = true
    }
  } else if (stats.is_charging || stats.battery_level > 25) {
    hasNotifiedLowBattery = false
  }
}

async function triggerReport() {
  const url = store.get('dashboardUrl') as string
  const userId = store.get('userId') as string
  const deviceId = store.get('deviceId') as string
  const apiKey = store.get('apiKey') as string   // FIX 4

  try {
    const stats = await getTelemetry(deviceId)
    lastTelemetry = stats
    checkLowBatteryAlert(stats)

    await reportTelemetry(url, userId, stats, apiKey)  // FIX 4: pass apiKey
    lastReportTime = Date.now()
    lastReportStatus = {
      success: true,
      message: `Reported successfully to ${url}`,
      timestamp: lastReportTime
    }

    updateTrayMenu()

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('report-status', lastReportStatus)
      mainWindow.webContents.send('telemetry-updated', stats)
    }

    return { success: true, stats, timestamp: lastReportTime }
  } catch (error: any) {
    lastReportStatus = {
      success: false,
      message: error.message || 'Connection failed',
      timestamp: Date.now()
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('report-status', lastReportStatus)
    }

    return { success: false, error: error.message }
  }
}

function setupBackgroundTimer() {
  if (reportInterval) {
    clearInterval(reportInterval)
    reportInterval = null
  }

  const intervalMin = (store.get('intervalMin') as number) ?? 5
  if (intervalMin > 0) {
    reportInterval = setInterval(triggerReport, intervalMin * 60 * 1000)
    setTimeout(triggerReport, 1000)
  }
}

function updateAutoStart() {
  const autoStart = store.get('autoStart') as boolean
  try {
    app.setLoginItemSettings({
      openAtLogin: !!autoStart,
      openAsHidden: true
    })
  } catch (err: any) {
    console.warn('Unable to configure auto start item:', err.message)
  }
}

async function testConnection(baseUrl: string, userId?: string): Promise<{ success: boolean; latencyMs?: number; message: string }> {
  if (!baseUrl) {
    return { success: false, message: 'URL is required' }
  }

  const startTime = Date.now()
  const cleanUrl = `${baseUrl.replace(/\/$/, '')}/api/devices${userId && userId !== 'default' ? `?user_id=${encodeURIComponent(userId)}` : ''}`

  return new Promise((resolve) => {
    try {
      const request = net.request({
        method: 'GET',
        url: cleanUrl
      })

      const timer = setTimeout(() => {
        request.abort()
        resolve({ success: false, message: 'Connection timed out after 5 seconds' })
      }, 5000)

      request.on('response', (response) => {
        clearTimeout(timer)
        const latencyMs = Date.now() - startTime
        if (response.statusCode >= 200 && response.statusCode < 400) {
          resolve({ success: true, latencyMs, message: `Connected (${latencyMs}ms)` })
        } else {
          resolve({
            success: false,
            latencyMs,
            message: `Server returned HTTP ${response.statusCode}`
          })
        }
      })

      request.on('error', (err) => {
        clearTimeout(timer)
        resolve({ success: false, message: err.message || 'Cannot reach server' })
      })

      request.end()
    } catch (e: any) {
      resolve({ success: false, message: e.message || 'Invalid URL' })
    }
  })
}

async function fetchDevices(
  baseUrl: string,
  userId?: string
): Promise<{ success: boolean; isOffline?: boolean; devices?: any[]; message?: string }> {
  if (!baseUrl) {
    return { success: false, message: 'Dashboard URL is not configured' }
  }

  const cleanUrl = `${baseUrl.replace(/\/$/, '')}/api/devices${userId && userId !== 'default' ? `?user_id=${encodeURIComponent(userId)}` : ''}`

  return new Promise((resolve) => {
    try {
      const request = net.request({
        method: 'GET',
        url: cleanUrl
      })

      const timer = setTimeout(() => {
        request.abort()
        resolve({
          success: false,
          isOffline: true,
          message: `Connection timed out after 5s connecting to ${baseUrl}`
        })
      }, 5000)

      let body = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          body += chunk.toString()
        })
        response.on('end', () => {
          clearTimeout(timer)
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              const data = JSON.parse(body)
              resolve({ success: true, devices: data.devices || [] })
            } catch {
              resolve({ success: false, message: 'Invalid JSON response from server' })
            }
          } else {
            resolve({
              success: false,
              message: `Server returned HTTP status ${response.statusCode}`
            })
          }
        })
      })

      request.on('error', () => {
        clearTimeout(timer)
        resolve({
          success: false,
          isOffline: true,
          message: `Dashboard server is offline at ${baseUrl}`
        })
      })

      request.end()
    } catch (e: any) {
      resolve({ success: false, message: e.message || 'Invalid server URL' })
    }
  })
}

// App lifecycle
app.on('before-quit', () => {
  isQuitting = true
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
    serverProcess = null
  }
})

app.whenReady().then(() => {
  setupApplicationMenu()
  createWindow()
  setupTray()
  setupBackgroundTimer()
  updateAutoStart()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!tray) app.quit()
  }
})

// IPC Handlers
ipcMain.handle('get-config', () => store.store)
ipcMain.handle('set-config', (_, key, value) => {
  store.set(key, value)

  if (key === 'intervalMin') setupBackgroundTimer()
  if (key === 'autoStart') updateAutoStart()

  return store.store
})

ipcMain.handle('get-telemetry', async () => {
  const stats = await getTelemetry(store.get('deviceId') as string)
  lastTelemetry = stats
  updateTrayMenu()
  return stats
})

ipcMain.handle('trigger-report', async () => await triggerReport())
ipcMain.handle('test-connection', async (_, url: string, userId?: string) => await testConnection(url, userId))
ipcMain.handle('fetch-devices', async (_, url: string, userId?: string) => await fetchDevices(url, userId))
ipcMain.handle('get-local-device', async () => {
  const stats = await getTelemetry(store.get('deviceId') as string)
  return {
    id: stats.device_id,
    name: stats.name,
    platform: stats.platform,
    model: stats.model,
    battery_level: stats.battery_level,
    is_charging: stats.is_charging,
    power_source: stats.power_source,
    battery_health: stats.battery_health,
    cycle_count: stats.cycle_count,
    time_remaining: stats.time_remaining,
    cpu_usage: stats.cpu_usage,
    ram_usage: stats.ram_usage,
    disk_usage: stats.disk_usage,
    local_ip: stats.local_ip,
    last_seen: Math.floor(Date.now() / 1000),
    is_online: true,
    is_local: true
  }
})

ipcMain.handle('get-server-status', async () => {
  const running = await checkIsServerRunning()
  return {
    running,
    port: 8080,
    url: 'http://localhost:8080',
    canManage: !!findServerScriptPath()
  }
})
ipcMain.handle('start-server', async () => await startServer())
ipcMain.handle('stop-server', async () => await stopServer())

ipcMain.handle('open-external', (_, url: string) => {
  if (url) shell.openExternal(url)
})

ipcMain.handle('copy-clipboard', (_, text: string) => {
  if (text) clipboard.writeText(text)
})

ipcMain.handle('get-app-info', () => ({
  name: 'Statuser',
  version: app.getVersion(),
  electron: process.versions.electron,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  osRelease: os.release()
}))
