import { useEffect, useState } from 'react'
import { db, hashSenha } from './db.js'
import { DadosProvider, useDados } from './ui.jsx'
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
    <div className="app-m">
      <div className="login-hero"><div className="logo">🔑</div><div className="marca">PassaChave</div><div className="slogan">Quem pegou, como devolveu, quanto rodou</div></div>
      <form className="body" onSubmit={enviar}>
        <label className="campo"><span className="lbl">E-mail</span><input className="inp" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="campo"><span className="lbl">Senha</span><input className="inp" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} /></label>
        {erro && <div className="erro">{erro}</div>}
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
        <div className="muted centro">No celular, use "Adicionar à tela inicial" para instalar como aplicativo.</div>
      </form>
    </div>
  )
}

function Area({ usuarioId, sair }) {
  const dados = useDados()
  const [rota, ir] = useRota()
  const usuario = dados.usuarios.find(u => u.id === usuarioId)
  useEffect(() => { if (usuario && rota === '/') ir(usuario.perfil === 'responsavel' ? '/painel' : '/inicio') }, [usuario, rota])
  useEffect(() => { if (!usuario || !usuario.ativo) sair() }, [usuario])
  if (!usuario || !usuario.ativo) return null
  const partes = rota.split('/').filter(Boolean)
  const p = { usuario, ir }

  const telasCondutor = {
    inicio: () => <InicioCondutor {...p} />,
    retirar: () => <Retirada {...p} veiculoId={partes[1]} />,
    uso: () => <EmUso {...p} />,
    abastecer: () => <Abastecer {...p} />,
    ocorrencia: () => <NovaOcorrencia {...p} />,
    devolver: () => <Devolucao {...p} />,
    'meus-usos': () => <MeusUsos {...p} />
  }
  const responsavel = usuario.perfil === 'responsavel'
  const telasGestor = {
    painel: () => <Painel ir={ir} />,
    aprovar: () => <Aprovar />,
    veiculos: () => <Veiculos ir={ir} novo={partes[1] === 'novo'} />,
    veiculo: () => <FichaVeiculo id={partes[1]} ir={ir} />,
    usuarios: () => <Usuarios />,
    manutencao: () => <Manutencao />,
    historico: () => <Historico />,
    config: () => <Configuracoes />
  }

  if (telasCondutor[partes[0]] || !responsavel) {
    const tela = telasCondutor[partes[0]] || telasCondutor.inicio
    return (
      <div className="app-m">
        <div className="tela">{tela()}</div>
        <nav className="bnav">
          {responsavel && <button onClick={() => ir('/painel')}><span className="ico">📊</span>Painel</button>}
          <button className={partes[0] === 'inicio' ? 'on' : ''} onClick={() => ir('/inicio')}><span className="ico">🏠</span>Início</button>
          <button className={partes[0] === 'meus-usos' ? 'on' : ''} onClick={() => ir('/meus-usos')}><span className="ico">🕘</span>Meus usos</button>
          <button onClick={sair}><span className="ico">🚪</span>Sair</button>
        </nav>
      </div>
    )
  }

  const tela = telasGestor[partes[0]] || telasGestor.painel
  const pend = contarPendentes(dados)
  const menu = [['painel', '📊 Painel'], ['aprovar', '✅ Para aprovar', pend], ['veiculos', '🚐 Veículos'], ['usuarios', '👥 Usuários'], ['manutencao', '🛠️ Manutenção'], ['historico', '🕘 Histórico'], ['config', '⚙️ Configurações'], ['inicio', '🔑 Retirar veículo']]
  const ativo = partes[0] === 'veiculo' ? 'veiculos' : partes[0]
  return (
    <div className="app-d">
      <aside className="side">
        <div className="brand"><span>🔑</span>PassaChave</div>
        {menu.map(([k, r, n]) => <button key={k} className={ativo === k ? 'on' : ''} onClick={() => ir('/' + k)}>{r}{n ? <span className="pill p-warn">{n}</span> : null}</button>)}
        <div className="user">{usuario.nome}<br /><span>Responsável</span><button className="link claro" onClick={sair}>Sair</button></div>
      </aside>
      <div className="conteudo">{tela()}</div>
    </div>
  )
}
