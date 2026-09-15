import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, net } from 'electron'
import { join } from 'path'
import os from 'os'
import Store from 'electron-store'
import { getTelemetry, TelemetryPayload } from './telemetry'
import { reportTelemetry } from './reporter'

const store = new Store({
  defaults: {
    dashboardUrl: 'http://localhost:8080',
    userId: 'default',
    deviceId: os.hostname().toLowerCase(),
    intervalMin: 5,
    autoStart: false
  }
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let reportInterval: NodeJS.Timeout | null = null
let isQuitting = false
let lastTelemetry: TelemetryPayload | null = null
let lastReportTime: number | null = null
let lastReportStatus: { success: boolean; message: string; timestamp: number } | null = null

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

  mainWindow = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 500,
    minHeight: 520,
    show: false,
    backgroundColor: '#090d16',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

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

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function updateTrayMenu() {
  if (!tray) return

  const batteryText = lastTelemetry
    ? `${lastTelemetry.battery_level}% • ${lastTelemetry.is_charging ? '⚡ Charging' : lastTelemetry.power_source}`
    : 'Connecting...'

  const lastSyncText = lastReportTime
    ? `Last sync: ${new Date(lastReportTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Not synced yet'

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Statuser Telemetry Agent', enabled: false },
    { label: batteryText, enabled: false },
    { label: lastSyncText, enabled: false },
    { type: 'separator' },
    {
      label: 'Open Dashboard App',
      click: () => {
        createWindow()
      }
    },
    {
      label: 'Report Now',
      click: async () => {
        await triggerReport()
      }
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      click: () => {
        createWindow()
        mainWindow?.webContents.send('navigate-to', 'settings')
      }
    },
    { type: 'separator' },
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

  // On macOS menu bar, update title with battery %
  if (process.platform === 'darwin' && lastTelemetry) {
    tray.setTitle(` ${lastTelemetry.battery_level}%`)
  }
}

function setupTray() {
  const trayIconPath = join(__dirname, '../../resources/trayTemplate.png')
  let icon = nativeImage.createFromPath(trayIconPath)

  if (icon.isEmpty()) {
    // Fallback if image not found on disk
    icon = nativeImage.createEmpty()
  } else {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)
  tray.setToolTip('Statuser Agent — Telemetry Monitor')
  updateTrayMenu()

  tray.on('click', () => {
    createWindow()
  })

  tray.on('double-click', () => {
    createWindow()
  })
}

async function triggerReport() {
  const url = store.get('dashboardUrl') as string
  const userId = store.get('userId') as string
  const deviceId = store.get('deviceId') as string

  try {
    const stats = await getTelemetry(deviceId)
    lastTelemetry = stats

    await reportTelemetry(url, userId, stats)
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
    // Run initial report after 1 second so window can finish bootstrapping
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
    cpu_usage: stats.cpu_usage,
    ram_usage: stats.ram_usage,
    last_seen: Math.floor(Date.now() / 1000),
    is_online: true,
    is_local: true
  }
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
