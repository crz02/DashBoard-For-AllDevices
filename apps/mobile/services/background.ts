import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTelemetry } from './telemetry';
import { reportTelemetry } from './reporter';

const BACKGROUND_FETCH_TASK = 'background-telemetry-fetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const url = await AsyncStorage.getItem('dashboardUrl');
    const userId = await AsyncStorage.getItem('userId');
    const bgEnabled = await AsyncStorage.getItem('autoStart');

    if (!url || bgEnabled !== 'true') {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const payload = await getTelemetry();
    await reportTelemetry(url, userId, payload);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background fetch failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundFetchAsync(intervalMin: number) {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: intervalMin * 60, // in seconds
    stopOnTerminate: false, // android only,
    startOnBoot: true, // android only
  });
}

export async function unregisterBackgroundFetchAsync() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  if (isRegistered) {
    return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  }
}
