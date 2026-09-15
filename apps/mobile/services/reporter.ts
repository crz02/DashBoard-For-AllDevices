import { TelemetryPayload } from './telemetry';

export async function reportTelemetry(baseUrl: string, userId: string | null, payload: TelemetryPayload): Promise<void> {
  if (!baseUrl) {
    throw new Error('Dashboard URL is not configured');
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/report`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (userId && userId !== 'default') {
    headers['X-User-Id'] = userId;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Server returned status code: ${response.status}`);
  }
}
