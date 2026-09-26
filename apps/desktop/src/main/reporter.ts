import { net } from 'electron'
import { TelemetryPayload } from './telemetry'

/**
 * FIX 4: Reporter now sends REPORT_API_KEY in Authorization header when configured.
 * The apiKey is read from electron-store config and passed in by the caller.
 */
export async function reportTelemetry(
  baseUrl: string,
  userId: string,
  payload: TelemetryPayload,
  apiKey?: string
): Promise<void> {
  if (!baseUrl) {
    throw new Error('Dashboard URL is not configured')
  }

  // Ensure url has no trailing slash
  const url = `${baseUrl.replace(/\/$/, '')}/api/report`

  return new Promise((resolve, reject) => {
    try {
      const request = net.request({
        method: 'POST',
        url: url
      })

      request.setHeader('Content-Type', 'application/json')

      // Send user ID header
      if (userId && userId !== 'default') {
        request.setHeader('X-User-Id', userId)
      }

      // FIX 4: Send API key if configured (supports both header styles)
      if (apiKey && apiKey.trim()) {
        request.setHeader('Authorization', `Bearer ${apiKey.trim()}`)
        request.setHeader('X-Api-Key', apiKey.trim())
      }

      request.on('response', (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve()
        } else if (response.statusCode === 401) {
          reject(new Error('Unauthorized: check your API key in Settings'))
        } else {
          reject(new Error(`Server returned status code: ${response.statusCode}`))
        }
      })

      request.on('error', (error) => {
        reject(error)
      })

      request.write(JSON.stringify(payload))
      request.end()
    } catch (e: any) {
      reject(e)
    }
  })
}
