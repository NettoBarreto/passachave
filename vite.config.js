import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Caminhos relativos permitem publicar no GitHub Pages em /passachave/ sem configuração extra.
export default defineConfig({
  base: './',
  plugins: [react()]
})
