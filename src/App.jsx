import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Clock, Gauge, History, Home, KeyRound, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, Wrench, Car, X } from 'lucide-react'
import { db, hashSenha } from './db.js'
import { BotaoTema, DadosProvider, useDados } from './ui.jsx'
import { Abastecer, Devolucao, EmUso, InicioCondutor, MeusUsos, NovaOcorrencia, Retirada } from './condutor.jsx'
import { Aprovar, Configuracoes, FichaVeiculo, Historico, Manutencao, Painel, Usuarios, Veiculos, contarPendentes } from './gestor.jsx'

const CHAVE_SESSAO = 'passachave:sessao'
const lerSessao = () => { try { return Number(localStorage.getItem(CHAVE_SESSAO)) || null } catch { return null } }
const gravarSessao = id => { try { id ? localStorage.setItem(CHAVE_SESSAO, String(id)) : localStorage.removeItem(CHAVE_SESSAO) } catch { /* sessão só na memória */ } }

function useRota() {
  const ler = () => (location.hash.replace(/^#/, '') || '/')
  const [rota, setRota] = useState(ler)
  useEffect(() => {
    const f = () => { setRota(ler()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return [rota, r => { location.hash = r }]
}

export default function App() {
  const [usuarioId, setUsuarioId] = useState(lerSessao)
  const sair = () => { gravarSessao(null); setUsuarioId(null) }
  return (
    <DadosProvider>
      {usuarioId ? <Area usuarioId={usuarioId} sair={sair} /> : <Login entrar={id => { gravarSessao(id); setUsuarioId(id) }} />}
    </DadosProvider>
  )
}

function Marca() {
  return <div className="marca"><span className="marca-ico"><KeyRound size={18} /></span>PassaChave</div>
}

function Login({ entrar }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  async function enviar(e) {
    e?.preventDefault()
    const u = await db.usuarios.where('email').equals(email.trim().toLowerCase()).first()
    if (!u || u.senhaHash !== (await hashSenha(senha))) return setErro('E-mail ou senha incorretos.')
    if (!u.ativo) return setErro('Seu acesso está bloqueado. Fale com a responsável.')
    entrar(u.id)
  }
  const preencher = (e, s) => { setEmail(e); setSenha(s); setErro('') }
  return (
    <div className="login">
      <section className="login-lado">
        <Marca />
        <div className="login-chamada">
          <h1>Quem pegou, como devolveu, quanto rodou.</h1>
          <p>Retirada e devolução de veículos compartilhados para organizações sociais, direto do celular.</p>
          <ul>
            <li><ClipboardCheck size={18} /> Checklist e fotos na saída e na volta</li>
            <li><ShieldCheck size={18} /> Aprovação dos registros pela responsável</li>
            <li><Gauge size={18} /> Consumo, custos e alertas de vencimento</li>
          </ul>
        </div>
        <span className="login-rodape">Projeto UPX V · Facens</span>
      </section>
      <section className="login-form">
        <div className="login-topo"><BotaoTema /></div>
        <form onSubmit={enviar}>
          <h2>Entrar</h2>
          <p className="muted">Use a conta cadastrada pela sua organização.</p>
          <label className="campo"><span className="lbl">E-mail</span><input className="inp" name="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="campo"><span className="lbl">Senha</span><input className="inp" name="senha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} /></label>
          {erro && <div className="erro" role="alert">{erro}</div>}
          <button className="btn nav" type="submit">Entrar</button>
          <div className="teste">
            <span><b>Versão de teste</b> · toque para preencher (senha <code>teste123</code>)</span>
            <div className="chips">
              <button type="button" className="chip" onClick={() => preencher('marina@passachave.test', 'teste123')}>Marina · responsável</button>
              <button type="button" className="chip" onClick={() => preencher('rafael@passachave.test', 'teste123')}>Rafael · condutor</button>
              <button type="button" className="chip" onClick={() => preencher('ana@passachave.test', 'teste123')}>Ana · condutora</button>
              <button type="button" className="chip" onClick={() => preencher('paulo@passachave.test', 'teste123')}>Paulo · CNH vencendo</button>
            </div>
          </div>
          <p className="muted centro">No celular, use "Adicionar à tela inicial" para instalar como aplicativo.</p>
        </form>
      </section>
    </div>
  )
}

const MENU_RESPONSAVEL = [
  { rota: 'painel', rotulo: 'Painel', icone: LayoutDashboard },
  { rota: 'aprovar', rotulo: 'Para aprovar', curto: 'Aprovar', icone: CheckCircle2, contador: true },
  { rota: 'veiculos', rotulo: 'Veículos', icone: Car },
  { rota: 'usuarios', rotulo: 'Usuários', icone: Users },
  { rota: 'manutencao', rotulo: 'Manutenção', icone: Wrench },
  { rota: 'historico', rotulo: 'Histórico', icone: History },
  { rota: 'config', rotulo: 'Configurações', icone: Settings },
  { rota: 'inicio', rotulo: 'Retirar veículo', curto: 'Retirar', icone: KeyRound }
]

const MENU_CONDUTOR = [
  { rota: 'inicio', rotulo: 'Início', icone: Home },
  { rota: 'meus-usos', rotulo: 'Meus usos', icone: Clock }
]

// Rotas do condutor que pertencem ao fluxo "Retirar veículo" no menu da responsável.
const FLUXO_RETIRADA = ['inicio', 'retirar', 'uso', 'abastecer', 'ocorrencia', 'devolver', 'meus-usos']

function Area({ usuarioId, sair }) {
  const dados = useDados()
  const [rota, ir] = useRota()
  const [maisAberto, setMaisAberto] = useState(false)
  const usuario = dados.usuarios.find(u => u.id === usuarioId)
  useEffect(() => { if (usuario && rota === '/') ir(usuario.perfil === 'responsavel' ? '/painel' : '/inicio') }, [usuario, rota])
  useEffect(() => { if (!usuario || !usuario.ativo) sair() }, [usuario])
  useEffect(() => setMaisAberto(false), [rota])
  // No celular as tabelas viram cartões; cada célula recebe o nome da sua coluna.
  useEffect(() => {
    document.querySelectorAll('.tbl').forEach(tabela => {
      const titulos = [...tabela.querySelectorAll('thead th')].map(th => th.textContent)
      tabela.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (titulos[i]) td.dataset.label = titulos[i] }))
    })
  })
  if (!usuario || !usuario.ativo) return null

  const partes = rota.split('/').filter(Boolean)
  const responsavel = usuario.perfil === 'responsavel'
  const p = { usuario, ir }
  const telas = {
    inicio: () => <InicioCondutor {...p} />,
    retirar: () => <Retirada {...p} veiculoId={partes[1]} />,
    uso: () => <EmUso {...p} />,
    abastecer: () => <Abastecer {...p} />,
    ocorrencia: () => <NovaOcorrencia {...p} />,
    devolver: () => <Devolucao {...p} />,
    'meus-usos': () => <MeusUsos {...p} />,
    ...(responsavel && {
      painel: () => <Painel ir={ir} />,
      aprovar: () => <Aprovar />,
      veiculos: () => <Veiculos ir={ir} novo={partes[1] === 'novo'} />,
      veiculo: () => <FichaVeiculo id={partes[1]} ir={ir} />,
      usuarios: () => <Usuarios />,
      manutencao: () => <Manutencao />,
      historico: () => <Historico />,
      config: () => <Configuracoes />
    })
  }
  const tela = telas[partes[0]] || (responsavel ? telas.painel : telas.inicio)

  const menu = responsavel ? MENU_RESPONSAVEL : MENU_CONDUTOR
  const pendentes = responsavel ? contarPendentes(dados) : 0
  let ativo = partes[0] === 'veiculo' ? 'veiculos' : partes[0]
  if (responsavel && FLUXO_RETIRADA.includes(ativo)) ativo = 'inicio'

  // No celular a barra inferior mostra até 4 atalhos; o restante fica em "Mais".
  const atalhos = responsavel ? menu.filter(m => ['painel', 'aprovar', 'veiculos', 'inicio'].includes(m.rota)) : menu
  const extras = responsavel ? menu.filter(m => !atalhos.includes(m)) : []

  return (
    <div className="shell">
      <aside className="sidebar">
        <Marca />
        <nav className="sb-nav">
          {menu.map(m => (
            <button key={m.rota} className={'sb-item' + (ativo === m.rota ? ' on' : '')} onClick={() => ir('/' + m.rota)}>
              <m.icone size={18} /><span>{m.rotulo}</span>{m.contador && pendentes > 0 && <span className="contador">{pendentes}</span>}
            </button>
          ))}
        </nav>
        <div className="sb-rodape">
          <div className="sb-usuario"><span className="avatar">{usuario.nome[0]}</span><div><b>{usuario.nome}</b><span>{responsavel ? 'Responsável' : 'Condutor'}</span></div></div>
          <div className="sb-acoes"><BotaoTema comTexto /><button className="menu-item" onClick={sair}><LogOut size={18} /><span>Sair</span></button></div>
        </div>
      </aside>

      <header className="topbar">
        <Marca />
        <div className="topbar-acoes"><BotaoTema /><button className="icone-btn" onClick={sair} aria-label="Sair"><LogOut size={18} /></button></div>
      </header>

      <main className="conteudo">{tela()}</main>

      <nav className="tabbar">
        {atalhos.map(m => (
          <button key={m.rota} className={ativo === m.rota ? 'on' : ''} onClick={() => ir('/' + m.rota)}>
            <span className="tab-ico"><m.icone size={21} />{m.contador && pendentes > 0 && <span className="contador mini">{pendentes}</span>}</span>{m.curto || m.rotulo}
          </button>
        ))}
        {extras.length > 0 && (
          <button className={extras.some(m => m.rota === ativo) ? 'on' : ''} onClick={() => setMaisAberto(true)}><span className="tab-ico"><Menu size={21} /></span>Mais</button>
        )}
      </nav>

      {maisAberto && (
        <div className="modal-fundo folha-fundo" onClick={() => setMaisAberto(false)}>
          <div className="folha" onClick={e => e.stopPropagation()}>
            <div className="row"><b>Mais opções</b><button className="icone-btn" onClick={() => setMaisAberto(false)} aria-label="Fechar"><X size={18} /></button></div>
            {extras.map(m => <button key={m.rota} className={'menu-item' + (ativo === m.rota ? ' on' : '')} onClick={() => ir('/' + m.rota)}><m.icone size={18} /><span>{m.rotulo}</span></button>)}
            <BotaoTema comTexto />
            <button className="menu-item" onClick={sair}><LogOut size={18} /><span>Sair</span></button>
          </div>
        </div>
      )}
    </div>
  )
}
