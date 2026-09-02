import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n' // Initialize i18n
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { EbayDataProvider } from './context/EbayDataContext'

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
