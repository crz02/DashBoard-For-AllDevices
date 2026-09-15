import { Api } from '../main/preload'

declare global {
  interface Window {
    api: Api
  }
}
