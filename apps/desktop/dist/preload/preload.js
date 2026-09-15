"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const api = {
  getConfig: () => electron.ipcRenderer.invoke("get-config"),
  setConfig: (key, value) => electron.ipcRenderer.invoke("set-config", key, value),
  getTelemetry: () => electron.ipcRenderer.invoke("get-telemetry"),
  triggerReport: () => electron.ipcRenderer.invoke("trigger-report"),
  on: (channel, callback) => {
    const subscription = (_event, ...args) => callback(...args);
    electron.ipcRenderer.on(channel, subscription);
    return () => electron.ipcRenderer.removeListener(channel, subscription);
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
exports.api = api;
