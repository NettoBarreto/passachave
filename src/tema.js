// Tema claro, escuro ou o mesmo do sistema operacional. A escolha fica salva no navegador.
const CHAVE = 'passachave:tema'
export const TEMAS = ['sistema', 'claro', 'escuro']

export function lerTema() {
  try { return TEMAS.includes(localStorage.getItem(CHAVE)) ? localStorage.getItem(CHAVE) : 'sistema' } catch { return 'sistema' }
}

export function aplicarTema(tema) {
  const raiz = document.documentElement
  if (tema === 'claro') raiz.dataset.theme = 'light'
  else if (tema === 'escuro') raiz.dataset.theme = 'dark'
  else delete raiz.dataset.theme
  const escuro = tema === 'escuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#0B131C' : '#16324F')
}

export function salvarTema(tema) {
  try { localStorage.setItem(CHAVE, tema) } catch { /* fica só nesta sessão */ }
  aplicarTema(tema)
}
