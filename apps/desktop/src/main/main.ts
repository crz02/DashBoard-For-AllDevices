import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { getTelemetry } from './telemetry'
import { reportTelemetry } from './reporter'

const store = new Store({
  defaults: {
    dashboardUrl: 'http://localhost:8080',
    userId: 'default',
    deviceId: require('os').hostname().toLowerCase(),
    intervalMin: 5,
    autoStart: false
  }
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let reportInterval: NodeJS.Timeout | null = null

function createWindow() {
  if (mainWindow) {
    mainWindow.show()
    return
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 500,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Set icon based on platform
  // const iconPath = join(__dirname, '../../resources/icon.png')
  // mainWindow.setIcon(iconPath)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    // Hide instead of close to keep running in background
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupTray() {
  // Try to use a default icon if resource doesn't exist yet
  // tray = new Tray(join(__dirname, '../../resources/icon.png'))
  // Using native image for now, later we can add the actual icon
  const { nativeImage } = require('electron')
  const icon = nativeImage.createEmpty() // Placeholder
  tray = new Tray(icon)
  tray.setToolTip('Statuser Agent')
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: createWindow },
    { label: 'Report Now', click: triggerReport },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      app.isQuitting = true
      app.quit()
    }}
  ])
  
  tray.setContextMenu(contextMenu)
  tray.on('double-click', createWindow)
}

async function triggerReport() {
  const url = store.get('dashboardUrl') as string
  const userId = store.get('userId') as string
  const deviceId = store.get('deviceId') as string
  
  try {
    const stats = await getTelemetry(deviceId)
    await reportTelemetry(url, userId, stats)
    return { success: true, stats }
  } catch (error: any) {
    console.error('Report failed:', error)
    return { success: false, error: error.message }
  }
}

function setupBackgroundTimer() {
  if (reportInterval) {
    clearInterval(reportInterval)
  }
  
  const intervalMin = store.get('intervalMin') as number
  if (intervalMin > 0) {
    reportInterval = setInterval(triggerReport, intervalMin * 60 * 1000)
    // Run once immediately
    triggerReport()
  }
}

function updateAutoStart() {
  const autoStart = store.get('autoStart') as boolean
  app.setLoginItemSettings({
    openAtLogin: autoStart,
    openAsHidden: true
  })
}

// App lifecycle
app.whenReady().then(() => {
  createWindow()
  setupTray()
  setupBackgroundTimer()
  updateAutoStart()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // We want it to keep running in background usually, but if no tray, we should quit
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
ipcMain.handle('get-telemetry', async () => await getTelemetry(store.get('deviceId') as string))
ipcMain.handle('trigger-report', async () => await triggerReport())
