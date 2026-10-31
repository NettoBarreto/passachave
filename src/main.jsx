import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { criarDadosIniciais } from './db.js'
import { aplicarTema, lerTema } from './tema.js'
import App from './App.jsx'
import './styles.css'

aplicarTema(lerTema())
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(lerTema()))

criarDadosIniciais().finally(() => {
  createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
