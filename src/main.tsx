import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { installViewportFix } from './platform/viewport'

registerSW({ immediate: true })
installViewportFix()

// Ask the browser not to evict our data under storage pressure. Safe to call repeatedly.
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
