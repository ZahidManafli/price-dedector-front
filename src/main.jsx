import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n' // Initialize i18n
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { EbayDataProvider } from './context/EbayDataContext'

// After a deploy, a tab still running the previous build asks for chunk files
// (e.g. TrackingPage-<oldhash>.js) that no longer exist. Reload once to pick up
// the new index.html instead of leaving the page blank; the session flag stops
// a reload loop if the files are genuinely missing on the server.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const key = 'checkila.chunkReloadAt'
    const last = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - last < 30000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    // storage blocked — still try one reload
  }
  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <EbayDataProvider>
          <App />
        </EbayDataProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
