import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import App from './index.jsx'

console.log('Starting application...')

const container = document.getElementById('root')
if (!container) {
  throw new Error('Failed to find root element')
}

const root = createRoot(container)
root.render(
  <StrictMode>
    <App />
  </StrictMode>
)
