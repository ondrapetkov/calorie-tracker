import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { installViewportFix } from './platform/viewport'
import { getSyncManager } from './sync'
import { SYNC_CONFIGURED } from './sync/config'

registerSW({ immediate: true })
installViewportFix()
if (SYNC_CONFIGURED) void getSyncManager().start()

// Ask the browser not to evict our data under storage pressure. Safe to call repeatedly.
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
