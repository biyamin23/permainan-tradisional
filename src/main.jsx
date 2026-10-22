import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { installAudioUnlock } from './audio/engine'
import './styles/global.css'

installAudioUnlock()

// ?debug opens straight into the kampung and exposes helpers for screenshots
if (new URLSearchParams(window.location.search).has('debug')) {
  import('./debug').then((m) => m.installDebug())
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
