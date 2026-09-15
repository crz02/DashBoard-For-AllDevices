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
  battery_health: string;
  cycle_count: number;
  temperature: number;
  cpu_usage: number;
  ram_usage: number;
}

export async function getTelemetry(deviceIdOverride?: string): Promise<TelemetryPayload> {
  // Battery info
  const batteryLevel = await Battery.getBatteryLevelAsync();
  const batteryState = await Battery.getBatteryStateAsync();
  
  const is_charging = batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;
  const power_source = is_charging ? 'AC Power' : 'Battery';
  
  // Storage config
  let deviceId = deviceIdOverride;
  if (!deviceId) {
    try {
      deviceId = await AsyncStorage.getItem('deviceId') || undefined;
    } catch (e) {}
  }
  
  if (!deviceId) {
    deviceId = `${Device.osName || 'unknown'}-${Device.modelName || 'device'}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  // Mobile platforms don't typically expose deep metrics to normal apps without native modules
  // So we provide what we can
  
  return {
    device_id: deviceId,
    name: Device.deviceName || 'Mobile Device',
    platform: Platform.OS, // 'ios' or 'android'
    model: Device.modelName || 'Unknown',
    battery_level: Math.round(batteryLevel * 100),
    is_charging,
    power_source,
    battery_health: 'Good', // Hard to get on mobile without native modules
    cycle_count: 0,
    temperature: 0,
    cpu_usage: 0, 
    ram_usage: 0
  };
}
