import { TelemetryPayload } from './telemetry';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * FIX 5: Reporter now reads and sends REPORT_API_KEY from AsyncStorage
 * when configured, matching the server's auth requirements.
 */
export async function reportTelemetry(
  baseUrl: string,
  userId: string | null,
  payload: TelemetryPayload
): Promise<void> {
  if (!baseUrl) {
    throw new Error('Dashboard URL is not configured');
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/report`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Send user ID if set
  if (userId && userId !== 'default') {
    headers['X-User-Id'] = userId;
  }

  // FIX 5: Read and send API key if configured
  try {
    const apiKey = await AsyncStorage.getItem('reportApiKey');
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      headers['X-Api-Key'] = apiKey.trim();
    }
  } catch (_) {
    // Ignore AsyncStorage read errors
  }

  // Strip null values from payload so COALESCE on server preserves existing data
  const cleanPayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== null && v !== undefined) {
      cleanPayload[k] = v;
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(cleanPayload),
  });

  if (response.status === 401) {
    throw new Error('Unauthorized: check your API key in Settings');
  }

  if (!response.ok) {
    throw new Error(`Server returned status code: ${response.status}`);
  }
}
