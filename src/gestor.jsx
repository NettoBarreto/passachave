import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, Database, Eraser, CheckCircle2, ChevronLeft, Download, ExternalLink, FileText, Fuel, IdCard, KeyRound, Plus, Printer, ShieldCheck, Wrench } from 'lucide-react'
import QRCode from 'qrcode'
import { db, hashSenha, restaurarDemonstracao, salvarConfig } from './db.js'
import { CampoFoto, Foto, Modal, PageHeader, Pill, Vazio, VeiculoImg, useDados } from './ui.jsx'
import { NIVEIS_COMBUSTIVEL, baixarCsv, hoje, calcularAlertas, consumo, data, dataHora, duracao, km, mesmoMes, reais } from './util.js'

const ICONES_ALERTA = { cnh: IdCard, documento: FileText, seguro: ShieldCheck, revisao: Wrench, agenda: CalendarClock, ocorrencia: AlertTriangle }

const nomeVeiculo = (veiculos, id) => { const v = veiculos.find(x => x.id === id); return v ? `${v.modelo} · ${v.placa}` : 'veículo removido' }
const nomeUsuario = (usuarios, id) => usuarios.find(x => x.id === id)?.nome || 'usuário removido'

export function contarPendentes({ usos, abastecimentos, ocorrencias }) {
  return usos.filter(u => u.status === 'finalizado' && u.aprovacao === 'pendente').length
    + abastecimentos.filter(a => a.aprovacao === 'pendente').length
    + ocorrencias.filter(o => o.aprovacao === 'pendente').length
}

export function Painel({ ir }) {
  const d = useDados()
  const { veiculos, usuarios, usos, abastecimentos, ocorrencias } = d
  const alertas = calcularAlertas(d)
  const usosMes = usos.filter(u => mesmoMes(u.inicio))
  const abastMes = abastecimentos.filter(a => mesmoMes(a.data))
  const kml = consumo(usosMes, abastMes)
  const conta = s => veiculos.filter(v => v.situacao === s).length
  const recentes = [
    ...usos.map(u => ({ q: u.inicio, i: KeyRound, t: `${nomeUsuario(usuarios, u.condutorId).split(' ')[0]} retirou ${nomeVeiculo(veiculos, u.veiculoId)}` })),
    ...usos.filter(u => u.fim).map(u => ({ q: u.fim, i: CheckCircle2, t: `${nomeUsuario(usuarios, u.condutorId).split(' ')[0]} devolveu ${nomeVeiculo(veiculos, u.veiculoId)} · ${km(u.kmFinal - u.kmInicial)}` })),
    ...abastecimentos.map(a => ({ q: a.data, i: Fuel, t: `${nomeUsuario(usuarios, a.condutorId).split(' ')[0]} abasteceu ${a.litros} L · ${reais(a.valor)}` })),
    ...ocorrencias.map(o => ({ q: o.data, i: AlertTriangle, t: `Ocorrência: ${o.tipo} · ${nomeVeiculo(veiculos, o.veiculoId)}` }))
  ].sort((a, b) => b.q.localeCompare(a.q)).slice(0, 6)

  return (
    <div className="page">
      <div className="mtop"><div><h2>Painel da frota</h2><div className="muted">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div><button className="btn nav sm" onClick={() => ir('/veiculos/novo')}><Plus size={16} /> Novo veículo</button></div>
      <div className="kpis">
        <div className="kpi"><b style={{ color: 'var(--ok)' }}>{conta('disponivel')}</b><span>Disponíveis</span></div>
        <div className="kpi"><b style={{ color: 'var(--use)' }}>{conta('em_uso')}</b><span>Em uso agora · {conta('manutencao')} em manutenção</span></div>
        <button className="kpi" onClick={() => ir('/aprovar')}><b style={{ color: 'var(--warn)' }}>{contarPendentes(d)}</b><span>Registros para aprovar</span></button>
        <div className="kpi"><b>{kml ? kml.toFixed(1).replace('.', ',') + ' km/l' : 'sem dados'}</b><span>Consumo médio no mês</span></div>
        <div className="kpi"><b>{reais(abastMes.reduce((s, a) => s + a.valor, 0))}</b><span>Combustível no mês</span></div>
      </div>
      <div className="two">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Veículo</th><th>Situação</th><th>Com quem</th><th>Hodômetro</th></tr></thead>
          <tbody>
            {veiculos.length === 0 && <tr><td colSpan="4"><Vazio>Cadastre o primeiro veículo.</Vazio></td></tr>}
            {veiculos.map(v => {
              const uso = usos.find(u => u.veiculoId === v.id && u.status === 'aberto')
              return (
                <tr key={v.id} className="clicavel" onClick={() => ir('/veiculo/' + v.id)}>
                  <td><span className="veic-cel"><VeiculoImg veiculo={v} tamanho="mini" /><span><b>{v.modelo}</b> · {v.placa}</span></span></td>
                  <td><Pill tipo="situacao" valor={v.situacao} /></td>
                  <td>{uso ? `${nomeUsuario(usuarios, uso.condutorId)} · desde ${dataHora(uso.inicio)}` : <span className="muted">{v.situacao === 'manutencao' ? 'oficina' : 'pátio'}</span>}</td>
                  <td>{km(v.hodometro)}</td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
        <div className="col">
          <div className="panel"><h3>Alertas automáticos {alertas.length > 0 && <span className="pill p-bad">{alertas.length}</span>}</h3>
            {alertas.length === 0 && <Vazio>Nenhum vencimento ou revisão próxima.</Vazio>}
            {alertas.map((a, i) => { const Ico = ICONES_ALERTA[a.icone]; return <div key={i} className={'alert' + (a.grave ? ' bad' : '')}><Ico size={18} /><div><b>{a.titulo}</b><br /><span className="muted">{a.texto}</span></div></div> })}
          </div>
          <div className="panel"><h3>Últimos registros</h3><div className="feed">
            {recentes.length === 0 && <Vazio>Nenhum uso registrado ainda.</Vazio>}
            {recentes.map((r, i) => <div key={i}><r.i size={15} className="feed-ico" /><span>{r.t} <span className="muted">· {dataHora(r.q)}</span></span></div>)}
          </div></div>
        </div>
      </div>
    </div>
  )
}

export function Aprovar() {
  const { usos, abastecimentos, ocorrencias, veiculos, usuarios, recarregar } = useDados()
  const [filtro, setFiltro] = useState('todos')
  const [recusando, setRecusando] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [manut, setManut] = useState(null)

  const itens = [
    ...usos.filter(u => u.status === 'finalizado' && u.aprovacao === 'pendente').map(u => ({
      tipo: 'uso', tabela: 'usos', reg: u, quando: u.fim,
      titulo: `Uso · ${nomeVeiculo(veiculos, u.veiculoId)} · ${nomeUsuario(usuarios, u.condutorId)}`,
      texto: `${km(u.kmInicial)} → ${km(u.kmFinal)} · ${km(u.kmFinal - u.kmInicial)} em ${duracao(u.inicio, u.fim)} · combustível ${NIVEIS_COMBUSTIVEL[u.combSaida]} → ${NIVEIS_COMBUSTIVEL[u.combRetorno]}`,
      aviso: u.alertaKm ? 'Quilometragem fora do comum: confira as fotos.' : (u.combRetorno < u.combSaida ? 'Voltou com menos combustível do que saiu.' : ''),
      fotos: [[u.fotoKmInicial, 'km saída'], [u.fotoCombSaida, 'comb. saída'], [u.fotoKmFinal, 'km final'], [u.fotoCombRetorno, 'comb. final']]
    })),
    ...abastecimentos.filter(a => a.aprovacao === 'pendente').map(a => ({
      tipo: 'abastecimento', tabela: 'abastecimentos', reg: a, quando: a.data,
      titulo: `Abastecimento · ${nomeVeiculo(veiculos, a.veiculoId)} · ${nomeUsuario(usuarios, a.condutorId)}`,
      texto: `${a.litros} L · ${reais(a.valor)} · ${reais(a.valor / a.litros)}/L · ${km(a.km)}${a.posto ? ' · ' + a.posto : ''}`,
      aviso: a.valor / a.litros > 9 || a.valor / a.litros < 3 ? 'Preço por litro fora do comum.' : '',
      fotos: [[a.fotoKm, 'hodômetro'], [a.fotoNota, 'nota fiscal']]
    })),
    ...ocorrencias.filter(o => o.aprovacao === 'pendente').map(o => ({
      tipo: 'ocorrencia', tabela: 'ocorrencias', reg: o, quando: o.data,
      titulo: `Ocorrência · ${o.tipo} · ${nomeVeiculo(veiculos, o.veiculoId)}`,
      texto: `Gravidade ${o.gravidade} · "${o.descricao}" · ${nomeUsuario(usuarios, o.condutorId)}`,
      aviso: o.gravidade === 'Impede o uso' ? 'Impede o uso do veículo.' : '',
      fotos: [[o.foto, 'foto']]
    }))
  ].filter(i => filtro === 'todos' || i.tipo === filtro).sort((a, b) => a.quando.localeCompare(b.quando))

  async function decidir(item, aprovacao, extra = {}) {
    await db[item.tabela].update(item.reg.id, { aprovacao, decididoEm: new Date().toISOString(), ...extra })
    await recarregar()
  }

  async function confirmarRecusa() {
    if (!motivo.trim()) return
    await decidir(recusando, 'recusado', { motivo: motivo.trim() })
    setRecusando(null); setMotivo('')
  }

  return (
    <div className="page">
      <div className="mtop"><h2>Para aprovar · {itens.length}</h2>
        <div className="chips">{[['todos', 'Todos'], ['uso', 'Usos e hodômetro'], ['abastecimento', 'Abastecimentos'], ['ocorrencia', 'Ocorrências']].map(([k, r]) => <button key={k} className={'chip' + (filtro === k ? ' on' : '')} onClick={() => setFiltro(k)}>{r}</button>)}</div>
      </div>
      {itens.length === 0 && <Vazio>Nada aguardando aprovação.</Vazio>}
      {itens.map(item => (
        <div key={item.tabela + item.reg.id} className="apv">
          <div className="apv-fotos">{item.fotos.filter(([id]) => id !== undefined).map(([id, r], i) => <Foto key={i} id={id} rotulo={r} />)}</div>
          <div className="apv-txt">
            <b>{item.titulo}</b>
            <div className="muted">{dataHora(item.quando)} · {item.texto}</div>
            {item.reg.motivoAnterior && <div className="muted">Reenviado após recusa: "{item.reg.motivoAnterior}"</div>}
            {item.aviso && <div className="aviso"><AlertTriangle size={14} /> {item.aviso}</div>}
          </div>
          <div className="apv-acoes">
            {item.tipo === 'ocorrencia' ? (
              <>
                <button className="btn sm b-use" onClick={() => setManut(item)}>Virar manutenção</button>
                <button className="btn sm b-ok" onClick={() => decidir(item, 'ciente')}>Ciente</button>
              </>
            ) : (
              <>
                <button className="btn sm b-ok" onClick={() => decidir(item, 'aprovado')}>Aprovar</button>
                <button className="btn sm b-bad" onClick={() => setRecusando(item)}>Recusar</button>
              </>
            )}
          </div>
        </div>
      ))}
      {recusando && (
        <Modal titulo="Motivo da recusa" onFechar={() => setRecusando(null)}>
          <p className="muted">O condutor recebe este motivo no celular e pode reenviar a foto.</p>
          <textarea className="inp" rows="3" autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: a foto do hodômetro está borrada, não dá para ler o km" />
          <button className="btn b-bad" disabled={!motivo.trim()} onClick={confirmarRecusa}>Recusar registro</button>
        </Modal>
      )}
      {manut && <FormManutencao inicial={{ veiculoId: manut.reg.veiculoId, servico: `${manut.reg.tipo}: ${manut.reg.descricao}`, tipo: 'corretiva', ocorrenciaId: manut.reg.id }} onFechar={() => setManut(null)} aoSalvar={() => decidir(manut, 'manutencao')} />}
    </div>
  )
}

const VEICULO_VAZIO = { placa: '', modelo: '', ano: '', combustivel: 'Flex', hodometro: '', situacao: 'disponivel', licenciamento: '', seguro: '', revisaoKm: 10000, revisaoMeses: 6, ultimaRevisaoKm: '', ultimaRevisaoData: '' }

export function Veiculos({ ir, novo }) {
  const { veiculos, usos } = useDados()
  const [editando, setEditando] = useState(novo ? VEICULO_VAZIO : null)
  return (
    <div className="page">
      <div className="mtop"><h2>Veículos</h2><button className="btn nav sm" onClick={() => setEditando(VEICULO_VAZIO)}><Plus size={16} /> Novo veículo</button></div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Veículo</th><th>Situação</th><th>Hodômetro</th><th>Licenciamento</th><th>Seguro</th><th>Usos</th></tr></thead>
        <tbody>
          {veiculos.map(v => (
            <tr key={v.id} className="clicavel" onClick={() => ir('/veiculo/' + v.id)}>
              <td><span className="veic-cel"><VeiculoImg veiculo={v} tamanho="mini" /><span><b>{v.modelo}</b> · {v.placa}</span></span></td><td><Pill tipo="situacao" valor={v.situacao} /></td><td>{km(v.hodometro)}</td>
              <td>{data(v.licenciamento)}</td><td>{data(v.seguro)}</td><td>{usos.filter(u => u.veiculoId === v.id).length}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {veiculos.length === 0 && <Vazio>Nenhum veículo. Cadastre o primeiro.</Vazio>}
      {editando && <FormVeiculo inicial={editando} onFechar={() => { setEditando(null); if (novo) ir('/veiculos') }} />}
    </div>
  )
}

function FormVeiculo({ inicial, onFechar }) {
  const { recarregar, veiculos } = useDados()
  const [f, setF] = useState(inicial)
  const [erro, setErro] = useState('')
  const set = c => e => setF({ ...f, [c]: e.target.value })
  async function salvar() {
    const placa = f.placa.trim().toUpperCase()
    if (!placa || !f.modelo.trim()) return setErro('Placa e modelo são obrigatórios.')
    if (f.hodometro === '' || Number.isNaN(Number(f.hodometro))) return setErro('Informe o hodômetro atual.')
    if (veiculos.some(v => v.placa === placa && v.id !== f.id)) return setErro('Já existe um veículo com essa placa.')
    const reg = { ...f, placa, modelo: f.modelo.trim(), ano: Number(f.ano) || null, hodometro: Number(f.hodometro), revisaoKm: Number(f.revisaoKm) || null, revisaoMeses: Number(f.revisaoMeses) || null, ultimaRevisaoKm: f.ultimaRevisaoKm === '' ? Number(f.hodometro) : Number(f.ultimaRevisaoKm), ultimaRevisaoData: f.ultimaRevisaoData || hoje() }
    if (f.id) await db.veiculos.put(reg)
    else { delete reg.id; await db.veiculos.add(reg) }
    await recarregar()
    onFechar()
  }
  return (
    <Modal titulo={f.id ? 'Editar veículo' : 'Novo veículo'} onFechar={onFechar}>
      <div className="form">
        <label className="campo"><span className="lbl">Placa</span><input className="inp" value={f.placa} onChange={set('placa')} placeholder="ABC-1D23" /></label>
        <label className="campo"><span className="lbl">Modelo</span><input className="inp" value={f.modelo} onChange={set('modelo')} placeholder="Fiat Strada" /></label>
        <label className="campo"><span className="lbl">Ano</span><input className="inp" inputMode="numeric" value={f.ano ?? ''} onChange={set('ano')} /></label>
        <label className="campo"><span className="lbl">Hodômetro atual (km)</span><input className="inp" inputMode="numeric" value={f.hodometro} onChange={set('hodometro')} /></label>
        <label className="campo"><span className="lbl">Combustível</span><select className="inp" value={f.combustivel} onChange={set('combustivel')}>{['Flex', 'Gasolina', 'Etanol', 'Diesel', 'Elétrico'].map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="campo"><span className="lbl">Situação</span><select className="inp" value={f.situacao} onChange={set('situacao')} disabled={f.situacao === 'em_uso'}><option value="disponivel">Disponível</option><option value="manutencao">Manutenção</option><option value="inativo">Inativo</option>{f.situacao === 'em_uso' && <option value="em_uso">Em uso</option>}</select></label>
        <label className="campo"><span className="lbl">Vencimento do licenciamento</span><input className="inp" type="date" value={f.licenciamento} onChange={set('licenciamento')} /></label>
        <label className="campo"><span className="lbl">Vencimento do seguro</span><input className="inp" type="date" value={f.seguro} onChange={set('seguro')} /></label>
        <label className="campo"><span className="lbl">Revisão a cada (km)</span><input className="inp" inputMode="numeric" value={f.revisaoKm ?? ''} onChange={set('revisaoKm')} /></label>
        <label className="campo"><span className="lbl">ou a cada (meses)</span><input className="inp" inputMode="numeric" value={f.revisaoMeses ?? ''} onChange={set('revisaoMeses')} /></label>
        <label className="campo"><span className="lbl">Última revisão (km)</span><input className="inp" inputMode="numeric" value={f.ultimaRevisaoKm ?? ''} onChange={set('ultimaRevisaoKm')} placeholder="hodômetro atual" /></label>
        <label className="campo"><span className="lbl">Data da última revisão</span><input className="inp" type="date" value={f.ultimaRevisaoData ?? ''} onChange={set('ultimaRevisaoData')} /></label>
        <div style={{ gridColumn: '1 / -1' }}><CampoFoto rotulo="Foto do veículo (ajuda o condutor a escolher)" valor={f.foto || null} onChange={foto => setF({ ...f, foto })} /></div>
      </div>
      {erro && <div className="erro">{erro}</div>}
      <button className="btn pri" onClick={salvar}>Salvar veículo</button>
    </Modal>
  )
}

export function linkRetirada(id) {
  return `${location.origin}${location.pathname}#/retirar/${id}`
}

function QrChaveiro({ veiculo }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { QRCode.toDataURL(linkRetirada(veiculo.id), { width: 360, margin: 1 }).then(setUrl) }, [veiculo.id])
  function imprimir() {
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>QR ${veiculo.placa}</title></head><body style="font-family:sans-serif;text-align:center;padding:30px"><img src="${url}" style="width:220px"><h2 style="margin:6px 0">${veiculo.placa}</h2><div>${veiculo.modelo} · PassaChave</div><script>setTimeout(()=>print(),300)<\/script></body></html>`)
    w.document.close()
  }
  return (
    <div className="panel qr-panel">
      {url && <img src={url} alt="QR do chaveiro" />}
      <div><b>QR code do chaveiro</b><div className="muted">Imprima e prenda na chave. Ao escanear com a câmera, o condutor cai direto na retirada deste veículo.</div>
        <div className="chips" style={{ marginTop: 8 }}><button className="btn ghost sm" onClick={imprimir}><Printer size={15} /> Imprimir etiqueta</button><a className="btn ghost sm" href={'#/retirar/' + veiculo.id}><ExternalLink size={15} /> Abrir link</a></div></div>
    </div>
  )
}

export function FichaVeiculo({ id, ir }) {
  const { veiculos, usos, abastecimentos, ocorrencias, manutencoes, usuarios } = useDados()
  const v = veiculos.find(x => x.id === Number(id))
  const [editando, setEditando] = useState(false)
  if (!v) return <div className="page"><Vazio>Veículo não encontrado.</Vazio></div>
  const meusUsos = usos.filter(u => u.veiculoId === v.id)
  const meusAbast = abastecimentos.filter(a => a.veiculoId === v.id)
  const usosMes = meusUsos.filter(u => mesmoMes(u.inicio))
  const abastMes = meusAbast.filter(a => mesmoMes(a.data))
  const manutMes = manutencoes.filter(m => m.veiculoId === v.id && m.status === 'realizada' && mesmoMes(m.data))
  const kml = consumo(meusUsos, meusAbast)
  const custoMes = abastMes.reduce((s, a) => s + a.valor, 0) + manutMes.reduce((s, m) => s + Number(m.custo || 0), 0)
  const meses = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d })
  const litrosMes = meses.map(m => meusAbast.filter(a => mesmoMes(a.data, m)).reduce((s, a) => s + a.litros, 0))
  const maxL = Math.max(1, ...litrosMes)
  const linha = [
    ...meusUsos.map(u => ({ q: u.inicio, i: KeyRound, t: `${nomeUsuario(usuarios, u.condutorId)} · ${u.status === 'aberto' ? 'em uso' : km(u.kmFinal - u.kmInicial) + ' em ' + duracao(u.inicio, u.fim)} · ${u.finalidade}`, s: u.status === 'aberto' ? null : u.aprovacao })),
    ...meusAbast.map(a => ({ q: a.data, i: Fuel, t: `${a.litros} L · ${reais(a.valor)} · ${nomeUsuario(usuarios, a.condutorId)}`, s: a.aprovacao })),
    ...ocorrencias.filter(o => o.veiculoId === v.id).map(o => ({ q: o.data, i: AlertTriangle, t: `${o.tipo} · ${o.descricao}`, s: o.aprovacao })),
    ...manutencoes.filter(m => m.veiculoId === v.id).map(m => ({ q: m.data + 'T12:00:00', i: Wrench, t: `${m.servico} · ${m.custo ? reais(Number(m.custo)) : 'custo a definir'}`, s: null, rot: m.status === 'realizada' ? 'Realizada' : 'Prevista' }))
  ].sort((a, b) => b.q.localeCompare(a.q))

  return (
    <div className="page">
      <div className="mtop"><div><button className="link" onClick={() => ir('/veiculos')}><ChevronLeft size={15} /> Veículos</button><div className="veic-cel"><VeiculoImg veiculo={v} tamanho="grande" /><h2>{v.modelo} · {v.placa}</h2></div><div className="muted">{km(v.hodometro)} · licenciamento até {data(v.licenciamento) || '?'} · seguro até {data(v.seguro) || '?'}</div></div>
        <div className="chips"><Pill tipo="situacao" valor={v.situacao} /><button className="btn ghost sm" onClick={() => setEditando(true)}>Editar</button></div></div>
      <div className="kpis">
        <div className="kpi"><b>{kml ? kml.toFixed(1).replace('.', ',') + ' km/l' : 'sem dados'}</b><span>Consumo médio</span></div>
        <div className="kpi"><b>{reais(custoMes)}</b><span>Custo no mês (combustível + manutenção)</span></div>
        <div className="kpi"><b>{usosMes.length}</b><span>Usos no mês</span></div>
      </div>
      <div className="two">
        <div className="panel"><h3>Histórico do veículo</h3>
          <div className="tl">
            {linha.length === 0 && <Vazio>Nenhum registro ainda.</Vazio>}
            {linha.map((l, i) => <div key={i}><span className="muted">{dataHora(l.q)}</span><span className="tl-txt"><l.i size={15} className="feed-ico" />{l.t}</span>{l.s ? <Pill valor={l.s} /> : l.rot ? <span className="pill p-warn">{l.rot}</span> : <span />}</div>)}
          </div>
        </div>
        <div className="col">
          <div className="panel"><h3>Litros abastecidos por mês</h3>
            <div className="bars">{litrosMes.map((l, i) => <div key={i} className={i === 5 ? 'cur' : ''} style={{ height: Math.max(3, (l / maxL) * 100) + '%' }} title={l + ' L'} />)}</div>
            <div className="bars-l">{meses.map((m, i) => <span key={i}>{m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>)}</div>
          </div>
          <QrChaveiro veiculo={v} />
        </div>
      </div>
      {editando && <FormVeiculo inicial={{ ...VEICULO_VAZIO, ...v }} onFechar={() => setEditando(false)} />}
    </div>
  )
}

const USUARIO_VAZIO = { nome: '', email: '', senha: '', perfil: 'condutor', vinculo: 'Voluntário', cnhCategoria: 'B', cnhValidade: '', ativo: true }

export function Usuarios() {
  const { usuarios } = useDados()
  const [editando, setEditando] = useState(null)
  return (
    <div className="page">
      <div className="mtop"><h2>Usuários</h2><button className="btn nav sm" onClick={() => setEditando(USUARIO_VAZIO)}><Plus size={16} /> Novo usuário</button></div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Vínculo</th><th>Perfil</th><th>CNH</th><th>Situação</th></tr></thead>
        <tbody>
          {usuarios.map(u => {
            const venc = u.cnhValidade && new Date(u.cnhValidade) < new Date()
            return (
              <tr key={u.id} className="clicavel" onClick={() => setEditando({ ...USUARIO_VAZIO, ...u, senha: '' })}>
                <td><b>{u.nome}</b></td><td>{u.email}</td><td>{u.vinculo}</td><td>{u.perfil === 'responsavel' ? 'Responsável' : 'Condutor'}</td>
                <td style={venc ? { color: 'var(--bad)', fontWeight: 600 } : null}>{u.cnhCategoria} · {data(u.cnhValidade)}</td>
                <td>{u.ativo ? <span className="pill p-ok">Ativo</span> : <span className="pill p-bad">Bloqueado</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div className="muted">Só usuários ativos e com CNH válida retiram veículos. Bloquear não apaga o histórico.</div>
      {editando && <FormUsuario inicial={editando} onFechar={() => setEditando(null)} />}
    </div>
  )
}

function FormUsuario({ inicial, onFechar }) {
  const { recarregar, usuarios } = useDados()
  const [f, setF] = useState(inicial)
  const [erro, setErro] = useState('')
  const set = c => e => setF({ ...f, [c]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function salvar() {
    const email = f.email.trim().toLowerCase()
    if (!f.nome.trim() || !email) return setErro('Nome e e-mail são obrigatórios.')
    if (usuarios.some(u => u.email === email && u.id !== f.id)) return setErro('Já existe um usuário com esse e-mail.')
    if (!f.id && f.senha.length < 6) return setErro('A senha precisa de pelo menos 6 caracteres.')
    if (f.id && f.senha && f.senha.length < 6) return setErro('A nova senha precisa de pelo menos 6 caracteres.')
    const { senha, ...resto } = f
    const reg = { ...resto, nome: f.nome.trim(), email }
    if (senha) reg.senhaHash = await hashSenha(senha)
    if (f.id) await db.usuarios.put(reg)
    else { delete reg.id; await db.usuarios.add(reg) }
    await recarregar()
    onFechar()
  }
  return (
    <Modal titulo={f.id ? 'Editar usuário' : 'Novo usuário'} onFechar={onFechar}>
      <div className="form">
        <label className="campo"><span className="lbl">Nome</span><input className="inp" value={f.nome} onChange={set('nome')} /></label>
        <label className="campo"><span className="lbl">E-mail</span><input className="inp" type="email" value={f.email} onChange={set('email')} /></label>
        <label className="campo"><span className="lbl">{f.id ? 'Nova senha (deixe vazio para manter)' : 'Senha inicial'}</span><input className="inp" type="password" value={f.senha} onChange={set('senha')} /></label>
        <label className="campo"><span className="lbl">Perfil</span><select className="inp" value={f.perfil} onChange={set('perfil')}><option value="condutor">Condutor</option><option value="responsavel">Responsável</option></select></label>
        <label className="campo"><span className="lbl">Vínculo</span><select className="inp" value={f.vinculo} onChange={set('vinculo')}>{['Voluntário', 'Voluntária', 'Funcionário', 'Funcionária'].map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="campo"><span className="lbl">Categoria da CNH</span><select className="inp" value={f.cnhCategoria} onChange={set('cnhCategoria')}>{['A', 'B', 'AB', 'C', 'D', 'E'].map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="campo"><span className="lbl">Validade da CNH</span><input className="inp" type="date" value={f.cnhValidade} onChange={set('cnhValidade')} /></label>
        <label className="campo check"><input type="checkbox" checked={f.ativo} onChange={set('ativo')} /> Ativo (pode retirar veículos)</label>
      </div>
      {erro && <div className="erro">{erro}</div>}
      <button className="btn pri" onClick={salvar}>Salvar usuário</button>
    </Modal>
  )
}

function FormManutencao({ inicial, onFechar, aoSalvar }) {
  const { veiculos, recarregar } = useDados()
  const [f, setF] = useState({ veiculoId: veiculos[0]?.id, servico: '', tipo: 'preventiva', data: hoje(), custo: '', status: 'prevista', km: '', ...inicial })
  const [erro, setErro] = useState('')
  const set = c => e => setF({ ...f, [c]: e.target.value })
  async function salvar() {
    if (!f.veiculoId || !f.servico.trim()) return setErro('Escolha o veículo e descreva o serviço.')
    const reg = { ...f, veiculoId: Number(f.veiculoId), servico: f.servico.trim(), custo: f.custo === '' ? null : Number(String(f.custo).replace(',', '.')) }
    const v = veiculos.find(x => x.id === reg.veiculoId)
    if (reg.id) await db.manutencoes.put(reg)
    else { delete reg.id; await db.manutencoes.add(reg) }
    // Manutenção prevista tira o veículo de circulação; realizada devolve e, se preventiva, zera o contador de revisão.
    if (v && v.situacao !== 'em_uso') {
      if (reg.status === 'realizada') {
        const mud = { situacao: 'disponivel' }
        if (reg.tipo === 'preventiva') Object.assign(mud, { ultimaRevisaoKm: Number(reg.km) || v.hodometro, ultimaRevisaoData: reg.data })
        await db.veiculos.update(v.id, mud)
      } else if (reg.tipo === 'corretiva') await db.veiculos.update(v.id, { situacao: 'manutencao' })
    }
    if (aoSalvar) await aoSalvar()
    await recarregar()
    onFechar()
  }
  return (
    <Modal titulo={f.id ? 'Editar manutenção' : 'Registrar manutenção'} onFechar={onFechar}>
      <div className="form">
        <label className="campo"><span className="lbl">Veículo</span><select className="inp" value={f.veiculoId} onChange={set('veiculoId')}>{veiculos.map(v => <option key={v.id} value={v.id}>{v.modelo} · {v.placa}</option>)}</select></label>
        <label className="campo"><span className="lbl">Tipo</span><select className="inp" value={f.tipo} onChange={set('tipo')}><option value="preventiva">Preventiva (revisão)</option><option value="corretiva">Corretiva (conserto)</option></select></label>
        <label className="campo" style={{ gridColumn: '1 / -1' }}><span className="lbl">Serviço</span><input className="inp" value={f.servico} onChange={set('servico')} placeholder="Ex.: troca de óleo e filtro" /></label>
        <label className="campo"><span className="lbl">Data</span><input className="inp" type="date" value={f.data} onChange={set('data')} /></label>
        <label className="campo"><span className="lbl">Situação</span><select className="inp" value={f.status} onChange={set('status')}><option value="prevista">Prevista</option><option value="realizada">Realizada</option></select></label>
        <label className="campo"><span className="lbl">Custo (R$)</span><input className="inp" inputMode="decimal" value={f.custo ?? ''} onChange={set('custo')} /></label>
        <label className="campo"><span className="lbl">Hodômetro no serviço (km)</span><input className="inp" inputMode="numeric" value={f.km ?? ''} onChange={set('km')} /></label>
      </div>
      <div className="muted">Corretiva prevista deixa o veículo em manutenção. Ao marcar como realizada, ele volta a ficar disponível.</div>
      {erro && <div className="erro">{erro}</div>}
      <button className="btn pri" onClick={salvar}>Salvar</button>
    </Modal>
  )
}

export function Manutencao() {
  const { manutencoes, veiculos } = useDados()
  const [editando, setEditando] = useState(null)
  const lista = [...manutencoes].sort((a, b) => (a.status === b.status ? b.data.localeCompare(a.data) : a.status === 'prevista' ? -1 : 1))
  return (
    <div className="page">
      <div className="mtop"><h2>Manutenção</h2><button className="btn nav sm" onClick={() => setEditando({})}><Plus size={16} /> Registrar serviço</button></div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Veículo</th><th>Serviço</th><th>Tipo</th><th>Data</th><th>Custo</th><th>Situação</th></tr></thead>
        <tbody>
          {lista.map(m => (
            <tr key={m.id} className="clicavel" onClick={() => setEditando(m)}>
              <td>{nomeVeiculo(veiculos, m.veiculoId)}</td><td>{m.servico}</td><td>{m.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}</td><td>{data(m.data)}</td>
              <td>{m.custo ? reais(m.custo) : 'a definir'}</td><td><span className={'pill ' + (m.status === 'realizada' ? 'p-ok' : 'p-warn')}>{m.status === 'realizada' ? 'Realizada' : 'Prevista'}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {lista.length === 0 && <Vazio>Nenhuma manutenção registrada. Ocorrências aprovadas como "virar manutenção" também aparecem aqui.</Vazio>}
      {editando && <FormManutencao inicial={editando} onFechar={() => setEditando(null)} />}
    </div>
  )
}

export function Historico() {
  const { usos, abastecimentos, ocorrencias, veiculos, usuarios } = useDados()
  const [aba, setAba] = useState('usos')
  const [veiculo, setVeiculo] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [mes, setMes] = useState(hoje().slice(0, 7))
  const filtra = (lista, campoData) => lista.filter(r => (!veiculo || r.veiculoId === Number(veiculo)) && (!pessoa || r.condutorId === Number(pessoa)) && (!mes || (r[campoData] || '').startsWith(mes)))
  const fu = filtra(usos, 'inicio'), fa = filtra(abastecimentos, 'data'), fo = filtra(ocorrencias, 'data')
  const totalKm = fu.filter(u => u.status === 'finalizado').reduce((s, u) => s + u.kmFinal - u.kmInicial, 0)
  const totalR = fa.reduce((s, a) => s + a.valor, 0)
  const nv = id => nomeVeiculo(veiculos, id), nu = id => nomeUsuario(usuarios, id)

  function exportar() {
    if (aba === 'usos') baixarCsv(`passachave-usos-${mes || 'todos'}.csv`, [['Saída', 'Devolução', 'Veículo', 'Condutor', 'Finalidade', 'Km inicial', 'Km final', 'Km rodados', 'Combustível saída', 'Combustível retorno', 'Aprovação'], ...fu.map(u => [dataHora(u.inicio), dataHora(u.fim), nv(u.veiculoId), nu(u.condutorId), u.finalidade, u.kmInicial, u.kmFinal ?? '', u.kmFinal ? u.kmFinal - u.kmInicial : '', NIVEIS_COMBUSTIVEL[u.combSaida], NIVEIS_COMBUSTIVEL[u.combRetorno] ?? '', u.aprovacao ?? 'em uso'])])
    if (aba === 'abast') baixarCsv(`passachave-abastecimentos-${mes || 'todos'}.csv`, [['Data', 'Veículo', 'Condutor', 'Litros', 'Valor', 'Km', 'Posto', 'Aprovação'], ...fa.map(a => [dataHora(a.data), nv(a.veiculoId), nu(a.condutorId), String(a.litros).replace('.', ','), a.valor.toFixed(2).replace('.', ','), a.km, a.posto, a.aprovacao])])
    if (aba === 'ocor') baixarCsv(`passachave-ocorrencias-${mes || 'todos'}.csv`, [['Data', 'Veículo', 'Condutor', 'Tipo', 'Gravidade', 'Descrição', 'Situação'], ...fo.map(o => [dataHora(o.data), nv(o.veiculoId), nu(o.condutorId), o.tipo, o.gravidade, o.descricao, o.aprovacao])])
  }

  return (
    <div className="page">
      <div className="mtop"><h2>Histórico</h2><button className="btn ghost sm" onClick={exportar}><Download size={15} /> Exportar planilha</button></div>
      <div className="chips">
        <input className="inp sm" type="month" value={mes} onChange={e => setMes(e.target.value)} />
        <select className="inp sm" value={veiculo} onChange={e => setVeiculo(e.target.value)}><option value="">Todos os veículos</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.modelo} · {v.placa}</option>)}</select>
        <select className="inp sm" value={pessoa} onChange={e => setPessoa(e.target.value)}><option value="">Todos os condutores</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>
      </div>
      <div className="chips">{[['usos', `Usos (${fu.length})`], ['abast', `Abastecimentos (${fa.length})`], ['ocor', `Ocorrências (${fo.length})`]].map(([k, r]) => <button key={k} className={'chip' + (aba === k ? ' on' : '')} onClick={() => setAba(k)}>{r}</button>)}</div>
      <div className="tbl-wrap"><table className="tbl">
        {aba === 'usos' && <><thead><tr><th>Saída</th><th>Veículo</th><th>Condutor</th><th>Finalidade</th><th>Km</th><th>Situação</th></tr></thead>
          <tbody>{fu.sort((a, b) => b.inicio.localeCompare(a.inicio)).map(u => <tr key={u.id}><td>{dataHora(u.inicio)}</td><td>{nv(u.veiculoId)}</td><td>{nu(u.condutorId)}</td><td>{u.finalidade}</td><td>{u.kmFinal ? km(u.kmFinal - u.kmInicial) : 'em uso'}</td><td>{u.aprovacao ? <Pill valor={u.aprovacao} /> : <span className="pill p-use">Em uso</span>}</td></tr>)}</tbody></>}
        {aba === 'abast' && <><thead><tr><th>Data</th><th>Veículo</th><th>Condutor</th><th>Litros</th><th>Valor</th><th>Situação</th></tr></thead>
          <tbody>{fa.sort((a, b) => b.data.localeCompare(a.data)).map(a => <tr key={a.id}><td>{dataHora(a.data)}</td><td>{nv(a.veiculoId)}</td><td>{nu(a.condutorId)}</td><td>{a.litros} L</td><td>{reais(a.valor)}</td><td><Pill valor={a.aprovacao} /></td></tr>)}</tbody></>}
        {aba === 'ocor' && <><thead><tr><th>Data</th><th>Veículo</th><th>Tipo</th><th>Descrição</th><th>Gravidade</th><th>Situação</th></tr></thead>
          <tbody>{fo.sort((a, b) => b.data.localeCompare(a.data)).map(o => <tr key={o.id}><td>{dataHora(o.data)}</td><td>{nv(o.veiculoId)}</td><td>{o.tipo}</td><td>{o.descricao}</td><td>{o.gravidade}</td><td><Pill valor={o.aprovacao} /></td></tr>)}</tbody></>}
      </table></div>
      <div className="row"><span className="muted">No período: {km(totalKm)} rodados · {reais(totalR)} em combustível · {fo.length} ocorrência(s)</span><span className="muted">Pronto para prestação de contas</span></div>
    </div>
  )
}

export function Configuracoes() {
  const { config, recarregar } = useDados()
  async function mudar(chave, valor) { await salvarConfig(chave, valor); await recarregar() }
  const Tog = ({ chave }) => <button className={'tog' + (config[chave] ? '' : ' off')} onClick={() => mudar(chave, !config[chave])} aria-label={chave} />
  async function restaurar(tipo) {
    const texto = tipo === 'simulado' ? 'Substituir tudo por dados simulados de demonstração?' : 'Apagar todos os registros e começar do zero (ficam só as contas e os veículos de teste)?'
    if (!confirm(texto)) return
    await restaurarDemonstracao(tipo)
    location.reload()
  }
  return (
    <div className="page estreita">
      <div className="mtop"><h2>Configurações</h2></div>
      <div className="panel">
        <div className="lbl">Fotos obrigatórias</div>
        <div className="set"><span>Foto do hodômetro (retirada, abastecimento e devolução)</span><Tog chave="fotoHodometro" /></div>
        <div className="set"><span>Foto do marcador de combustível</span><Tog chave="fotoCombustivel" /></div>
        <div className="set"><span>Foto da nota fiscal no abastecimento</span><Tog chave="fotoNotaFiscal" /></div>
        <div className="set"><span>Foto em todo problema e ocorrência</span><Tog chave="fotoProblema" /></div>
        <div className="lbl" style={{ marginTop: 14 }}>Aprovação e alertas</div>
        <div className="set"><span>Exigir aprovação da responsável nos registros</span><Tog chave="exigirAprovacao" /></div>
        <div className="set"><span>Avisar vencimentos com antecedência de (dias)</span><input className="inp sm" style={{ width: 80 }} inputMode="numeric" value={config.diasAviso} onChange={e => mudar('diasAviso', Number(e.target.value.replace(/\D/g, '')) || 0)} /></div>
        <div className="set"><span>Bloquear retirada com CNH vencida</span><Tog chave="bloquearCnhVencida" /></div>
      </div>
      <div className="panel">
        <div className="lbl">Dados de demonstração</div>
        <p className="muted" style={{ margin: '6px 0 10px' }}>Nesta versão de teste os dados ficam guardados neste navegador. Cada pessoa que abre o link tem a própria cópia.</p>
        <div className="chips">
          <button className="btn pri sm" onClick={() => restaurar('simulado')}><Database size={15} /> Preencher com dados simulados</button>
          <button className="btn ghost sm" onClick={() => restaurar('zero')}><Eraser size={15} /> Começar do zero</button>
        </div>
      </div>
    </div>
  )
}
