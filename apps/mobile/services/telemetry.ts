import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TelemetryPayload {
  device_id: string;
  name: string;
  platform: string;
  model: string;
  battery_level: number;
  is_charging: boolean;
  power_source: string;
  // FIX 6: These are genuinely unavailable on mobile via Expo SDK.
  // We send null instead of fake values so the dashboard shows '--'.
  battery_health: string | null;
  cycle_count: number | null;
  temperature: number | null;
  cpu_usage: number | null;
  ram_usage: number | null;
}

export async function getTelemetry(deviceIdOverride?: string): Promise<TelemetryPayload> {
  // Battery info
  const batteryLevel = await Battery.getBatteryLevelAsync();
  const batteryState = await Battery.getBatteryStateAsync();
  
  const is_charging =
    batteryState === Battery.BatteryState.CHARGING ||
    batteryState === Battery.BatteryState.FULL;
  const power_source = is_charging ? 'AC Power' : 'Battery';
  
  // Device ID — persist across restarts
  let deviceId = deviceIdOverride;
  if (!deviceId) {
    try {
      deviceId = (await AsyncStorage.getItem('deviceId')) || undefined;
    } catch (e) {}
  }
  
  if (!deviceId) {
    deviceId = `${Device.osName || 'unknown'}-${Device.modelName || 'device'}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
    try {
      await AsyncStorage.setItem('deviceId', deviceId);
    } catch (e) {}
  }

  // FIX 6: Send null for metrics that are genuinely unavailable on mobile.
  // The server uses COALESCE so it won't overwrite previous values with null.
  // The dashboard renders null/missing fields as '--' instead of fake zeros.
  return {
    device_id: deviceId,
    name: Device.deviceName || `${Device.modelName || 'Mobile Device'}`,
    platform: Platform.OS, // 'ios' or 'android'
    model: Device.modelName || 'Unknown',
    battery_level: Math.round(batteryLevel * 100),
    is_charging,
    power_source,
    // Genuinely unavailable on iOS/Android without native modules:
    battery_health: null,  // iOS doesn't expose this to JS
    cycle_count: null,     // Not available via Expo SDK
    temperature: null,     // Not available on iOS at all; Android varies
    cpu_usage: null,       // Not available without native modules
    ram_usage: null,       // Not available without native modules
  };
}
