import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

const root = createRoot(document.getElementById('root'))
root.render(<App />)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      window.__swRegistration = registration

      const notifyUpdateReady = () => window.dispatchEvent(new Event('sw-ready'))

      if (registration.waiting) notifyUpdateReady()

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUpdateReady()
          }
        })
      })

      await registration.update()
    } catch (err) {
      console.warn('Service worker registration failed', err)
    }
  })
}
