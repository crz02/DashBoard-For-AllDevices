import { net } from 'electron'
import { TelemetryPayload } from './telemetry'

export async function reportTelemetry(baseUrl: string, userId: string, payload: TelemetryPayload): Promise<void> {
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
      if (userId && userId !== 'default') {
        request.setHeader('X-User-Id', userId)
      }

      request.on('response', (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve()
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
