import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Camera, CheckCircle2, ChevronLeft, Monitor, Moon, Sun, X } from 'lucide-react'
import { db, lerConfig, salvarFoto } from './db.js'
import { APROVACOES, SITUACOES } from './util.js'
import { TEMAS, lerTema, salvarTema } from './tema.js'

const DadosContext = createContext(null)

// Os volumes de uma organização pequena cabem em memória: carregamos tudo e recarregamos após cada gravação.
export function DadosProvider({ children }) {
  const [dados, setDados] = useState(null)
  const recarregar = useCallback(async () => {
    const [usuarios, veiculos, usos, abastecimentos, ocorrencias, manutencoes, config] = await Promise.all([
      db.usuarios.toArray(), db.veiculos.toArray(), db.usos.toArray(), db.abastecimentos.toArray(),
      db.ocorrencias.toArray(), db.manutencoes.toArray(), lerConfig()
    ])
    setDados({ usuarios, veiculos, usos, abastecimentos, ocorrencias, manutencoes, config })
  }, [])
  useEffect(() => { recarregar() }, [recarregar])
  if (!dados) return <div className="carregando">Carregando…</div>
  return <DadosContext.Provider value={{ ...dados, recarregar }}>{children}</DadosContext.Provider>
}

export const useDados = () => useContext(DadosContext)

export function PageHeader({ titulo, subtitulo, voltar, acoes, children }) {
  return (
    <header className="page-head">
      <div className="page-head-txt">
        {voltar && <button className="voltar" onClick={voltar} aria-label="Voltar"><ChevronLeft size={20} /></button>}
        <div>
          {subtitulo && <div className="page-sub">{subtitulo}</div>}
          <h1>{titulo}</h1>
        </div>
      </div>
      {(acoes || children) && <div className="page-acoes">{acoes}{children}</div>}
    </header>
  )
}

export function BotaoTema({ comTexto }) {
  const [tema, setTema] = useState(lerTema)
  const Icone = tema === 'claro' ? Sun : tema === 'escuro' ? Moon : Monitor
  const rotulo = { sistema: 'Tema do sistema', claro: 'Tema claro', escuro: 'Tema escuro' }[tema]
  function trocar() {
    const proximo = TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length]
    salvarTema(proximo)
    setTema(proximo)
  }
  return (
    <button className={comTexto ? 'menu-item' : 'icone-btn'} onClick={trocar} title={rotulo} aria-label={rotulo} data-tema={tema}>
      <Icone size={18} />{comTexto && <span>{rotulo}</span>}
    </button>
  )
}

export function Pill({ tipo, valor }) {
  const mapa = tipo === 'situacao' ? SITUACOES : APROVACOES
  const item = mapa[valor] || { rotulo: valor, classe: 'p-off' }
  return <span className={'pill ' + item.classe}>{item.rotulo}</span>
}

export function CampoFoto({ rotulo, obrigatoria, valor, onChange }) {
  const [enviando, setEnviando] = useState(false)
  async function escolher(e) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setEnviando(true)
    try { onChange(await salvarFoto(arquivo)) } finally { setEnviando(false); e.target.value = '' }
  }
  return (
    <label className="campo">
      <span className="lbl">{rotulo}{obrigatoria ? <span className="req">obrigatória</span> : <span className="opt">opcional</span>}</span>
      <span className={'photo' + (valor ? ' done' : '')}>
        {enviando ? 'Salvando foto…' : valor
          ? <><FotoMini id={valor} /><CheckCircle2 size={16} /> Foto anexada · toque para trocar</>
          : <><Camera size={18} /> Tirar foto ou escolher da galeria</>}
      </span>
      <input type="file" accept="image/*" capture="environment" onChange={escolher} hidden />
    </label>
  )
}

const cacheFotos = new Map()

export function useFoto(id) {
  const [url, setUrl] = useState(cacheFotos.get(id) || null)
  useEffect(() => {
    if (!id || cacheFotos.has(id)) { setUrl(cacheFotos.get(id) || null); return }
    db.fotos.get(id).then(f => { if (f) { cacheFotos.set(id, f.dados); setUrl(f.dados) } })
  }, [id])
  return url
}

export function FotoMini({ id }) {
  const url = useFoto(id)
  return url ? <img className="foto-mini" src={url} alt="" /> : null
}

export function Foto({ id, rotulo }) {
  const url = useFoto(id)
  const [aberta, setAberta] = useState(false)
  if (!id) return <div className="thumb vazio"><span>{rotulo}</span>sem foto</div>
  return (
    <>
      <button type="button" className="thumb" onClick={() => setAberta(true)} title={rotulo}>
        {url ? <img src={url} alt={rotulo} /> : '…'}
        {rotulo && <span>{rotulo}</span>}
      </button>
      {aberta && <div className="modal-fundo" onClick={() => setAberta(false)}><img className="foto-grande" src={url} alt={rotulo} /></div>}
    </>
  )
}

export function Modal({ titulo, onFechar, children }) {
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])
  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" role="dialog" aria-label={titulo} onClick={e => e.stopPropagation()}>
        <div className="row"><h3>{titulo}</h3><button className="icone-btn" onClick={onFechar} aria-label="Fechar"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}

export function Combustivel({ valor, onChange }) {
  return (
    <div className="fuel-sel">
      {[0, 1, 2, 3, 4].map(n => (
        <button type="button" key={n} className={valor !== null && n <= valor ? 'f' : ''} onClick={() => onChange(n)} aria-label={'Nível ' + n} />
      ))}
    </div>
  )
}

export function Vazio({ children }) {
  return <div className="vazio-txt">{children}</div>
}
