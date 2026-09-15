import { contextBridge, ipcRenderer } from 'electron'

export interface Api {
  getConfig: () => Promise<any>
  setConfig: (key: string, value: any) => Promise<any>
  getTelemetry: () => Promise<any>
  triggerReport: () => Promise<{ success: boolean; stats?: any; error?: string; timestamp?: number }>
  testConnection: (url: string, userId?: string) => Promise<{ success: boolean; latencyMs?: number; message: string }>
  fetchDevices: (url: string, userId?: string) => Promise<{ success: boolean; isOffline?: boolean; devices?: any[]; message?: string }>
  getLocalDevice: () => Promise<any>
  getAppInfo: () => Promise<{ name: string; version: string; electron: string; node: string; platform: string; arch: string; osRelease: string }>
  on: (channel: string, callback: (...args: any[]) => void) => () => void
}

export const api: Api = {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (key: string, value: any) => ipcRenderer.invoke('set-config', key, value),
  getTelemetry: () => ipcRenderer.invoke('get-telemetry'),
  triggerReport: () => ipcRenderer.invoke('trigger-report'),
  testConnection: (url: string, userId?: string) => ipcRenderer.invoke('test-connection', url, userId),
  fetchDevices: (url: string, userId?: string) => ipcRenderer.invoke('fetch-devices', url, userId),
  getLocalDevice: () => ipcRenderer.invoke('get-local-device'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
}

contextBridge.exposeInMainWorld('api', api)
