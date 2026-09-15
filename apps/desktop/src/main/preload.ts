import { contextBridge, ipcRenderer } from 'electron'

export const api = {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (key: string, value: any) => ipcRenderer.invoke('set-config', key, value),
  getTelemetry: () => ipcRenderer.invoke('get-telemetry'),
  triggerReport: () => ipcRenderer.invoke('trigger-report'),
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
}

contextBridge.exposeInMainWorld('api', api)
