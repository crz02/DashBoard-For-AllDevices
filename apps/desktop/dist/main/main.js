"use strict";
const electron = require("electron");
const path = require("path");
const Store = require("electron-store");
const si = require("systeminformation");
const os = require("os");
async function getTelemetry(deviceId) {
  const [battery, cpu, mem, osInfo, system] = await Promise.all([
    si.battery(),
    si.currentLoad(),
    si.mem(),
    si.osInfo(),
    si.system()
  ]);
  let temp = 0;
  try {
    const cpuTemp = await si.cpuTemperature();
    temp = cpuTemp.main || 0;
  } catch (e) {
  }
  let is_charging = false;
  let power_source = "AC Power";
  let battery_level = 100;
  let battery_health = "Good";
  let cycle_count = 0;
  if (battery.hasBattery) {
    battery_level = battery.percent;
    is_charging = battery.isCharging;
    power_source = battery.acConnected ? "AC Power" : "Battery";
    if (battery.maxcapacity && battery.designedcapacity) {
      const healthPct = Math.round(battery.maxcapacity / battery.designedcapacity * 100);
      battery_health = `${healthPct}%`;
    }
    cycle_count = battery.cyclecount || 0;
  } else {
    power_source = "AC Power (Desktop)";
    battery_health = "N/A (Desktop)";
  }
  let platform = "linux";
  if (os.platform() === "darwin") platform = "macos";
  if (os.platform() === "win32") platform = "windows";
  return {
    device_id: deviceId,
    name: os.hostname(),
    platform,
    model: system.model || osInfo.distro || "Unknown Device",
    battery_level: Math.round(battery_level),
    is_charging,
    power_source,
    battery_health,
    cycle_count,
    temperature: temp,
    cpu_usage: Math.round(cpu.currentLoad * 10) / 10,
    ram_usage: Math.round(mem.active / mem.total * 1e3) / 10
  };
}
async function reportTelemetry(baseUrl, userId, payload) {
  if (!baseUrl) {
    throw new Error("Dashboard URL is not configured");
  }
  const url = `${baseUrl.replace(/\/$/, "")}/api/report`;
  return new Promise((resolve, reject) => {
    try {
      const request = electron.net.request({
        method: "POST",
        url
      });
      request.setHeader("Content-Type", "application/json");
      if (userId && userId !== "default") {
        request.setHeader("X-User-Id", userId);
      }
      request.on("response", (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Server returned status code: ${response.statusCode}`));
        }
      });
      request.on("error", (error) => {
        reject(error);
      });
      request.write(JSON.stringify(payload));
      request.end();
    } catch (e) {
      reject(e);
    }
  });
}
const store = new Store({
  defaults: {
    dashboardUrl: "http://localhost:8080",
    userId: "default",
    deviceId: require("os").hostname().toLowerCase(),
    intervalMin: 5,
    autoStart: false
  }
});
let mainWindow = null;
let tray = null;
let reportInterval = null;
function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    return;
  }
  mainWindow = new electron.BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 500,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.on("close", (event) => {
    if (!electron.app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function setupTray() {
  const { nativeImage } = require("electron");
  const icon = nativeImage.createEmpty();
  tray = new electron.Tray(icon);
  tray.setToolTip("Statuser Agent");
  const contextMenu = electron.Menu.buildFromTemplate([
    { label: "Open Dashboard", click: createWindow },
    { label: "Report Now", click: triggerReport },
    { type: "separator" },
    { label: "Quit", click: () => {
      electron.app.isQuitting = true;
      electron.app.quit();
    } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("double-click", createWindow);
}
async function triggerReport() {
  const url = store.get("dashboardUrl");
  const userId = store.get("userId");
  const deviceId = store.get("deviceId");
  try {
    const stats = await getTelemetry(deviceId);
    await reportTelemetry(url, userId, stats);
    return { success: true, stats };
  } catch (error) {
    console.error("Report failed:", error);
    return { success: false, error: error.message };
  }
}
function setupBackgroundTimer() {
  if (reportInterval) {
    clearInterval(reportInterval);
  }
  const intervalMin = store.get("intervalMin");
  if (intervalMin > 0) {
    reportInterval = setInterval(triggerReport, intervalMin * 60 * 1e3);
    triggerReport();
  }
}
function updateAutoStart() {
  const autoStart = store.get("autoStart");
  electron.app.setLoginItemSettings({
    openAtLogin: autoStart,
    openAsHidden: true
  });
}
electron.app.whenReady().then(() => {
  createWindow();
  setupTray();
  setupBackgroundTimer();
  updateAutoStart();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (!tray) electron.app.quit();
  }
});
electron.ipcMain.handle("get-config", () => store.store);
electron.ipcMain.handle("set-config", (_, key, value) => {
  store.set(key, value);
  if (key === "intervalMin") setupBackgroundTimer();
  if (key === "autoStart") updateAutoStart();
  return store.store;
});
electron.ipcMain.handle("get-telemetry", async () => await getTelemetry(store.get("deviceId")));
electron.ipcMain.handle("trigger-report", async () => await triggerReport());
