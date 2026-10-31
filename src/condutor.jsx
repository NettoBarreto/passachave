import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronRight, Fuel, IdCard, KeyRound, QrCode } from 'lucide-react'
import { db } from './db.js'
import { CampoFoto, Combustivel, PageHeader, Pill, Vazio, VeiculoImg, useDados } from './ui.jsx'
import { ITENS_CHECKLIST, NIVEIS_COMBUSTIVEL, dataHora, diasAte, duracao, km, reais } from './util.js'

const aprovacaoInicial = config => (config.exigirAprovacao ? 'pendente' : 'aprovado')

function Erro({ msg }) {
  return msg ? <div className="erro" role="alert">{msg}</div> : null
}

export function usoAbertoDe(usos, usuarioId) {
  return usos.find(u => u.condutorId === usuarioId && u.status === 'aberto')
}

export function InicioCondutor({ usuario, ir }) {
  const { veiculos, usos, usuarios, config } = useDados()
  const aberto = usoAbertoDe(usos, usuario.id)
  const cnh = diasAte(usuario.cnhValidade)
  const ativos = veiculos.filter(v => v.situacao !== 'inativo')
  return (
    <div className="page estreita">
      <PageHeader titulo={aberto ? 'Você está com uma chave' : 'Para onde vamos hoje?'} subtitulo={'Olá, ' + usuario.nome.split(' ')[0]} />
      <div className="stack">
        {cnh !== null && cnh <= Number(config.diasAviso) && (
          <div className={'alert' + (cnh < 0 ? ' bad' : '')}><IdCard size={18} /><div><b>{cnh < 0 ? 'Sua CNH está vencida' : 'Sua CNH vence em ' + cnh + ' dias'}</b><div className="muted">{cnh < 0 && config.bloquearCnhVencida ? 'Retiradas bloqueadas até atualizar com a responsável.' : 'Avise a responsável quando renovar.'}</div></div></div>
        )}
        {aberto ? <CartaoEmUso uso={aberto} ir={ir} /> : (
          <div className="qr-chamada">
            <div className="qr-icone"><QrCode size={34} /></div>
            <div><b>Escaneie o QR do chaveiro</b><div className="muted">Use a câmera do celular na etiqueta da chave, ou escolha o veículo abaixo.</div></div>
          </div>
        )}
        <div className="secao">Veículos</div>
        {ativos.length === 0 && <Vazio>Nenhum veículo cadastrado ainda.</Vazio>}
        <div className="grid-veiculos">
          {ativos.map(v => {
            const uso = usos.find(u => u.veiculoId === v.id && u.status === 'aberto')
            const quem = uso && usuarios.find(x => x.id === uso.condutorId)
            const pode = v.situacao === 'disponivel' && !aberto
            return (
              <button key={v.id} className="card veh" disabled={!pode} onClick={() => ir('/retirar/' + v.id)}>
                <VeiculoImg veiculo={v} />
                <div className="veh-txt"><b>{v.modelo} · {v.placa}</b><small>{uso ? `com ${quem?.nome.split(' ')[0]} desde ${dataHora(uso.inicio)}` : km(v.hodometro)}</small></div>
                <Pill tipo="situacao" valor={v.situacao} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CartaoEmUso({ uso, ir }) {
  const { veiculos } = useDados()
  const v = veiculos.find(x => x.id === uso.veiculoId)
  return (
    <button className="card emuso" onClick={() => ir('/uso')}>
      <div className="car destaque"><KeyRound size={22} /></div>
      <div className="veh-txt"><span className="pill p-use">Em uso</span><b>{v?.modelo} · {v?.placa}</b><small>Saída {dataHora(uso.inicio)} · {duracao(uso.inicio)}</small></div>
      <ChevronRight size={20} />
    </button>
  )
}

export function Retirada({ usuario, veiculoId, ir }) {
  const { veiculos, usos, config, recarregar } = useDados()
  const v = veiculos.find(x => x.id === Number(veiculoId))
  const [passo, setPasso] = useState(1)
  const [kmInicial, setKmInicial] = useState(v?.hodometro ?? '')
  const [fotoKm, setFotoKm] = useState(null)
  const [finalidade, setFinalidade] = useState('')
  const [previsao, setPrevisao] = useState('')
  const [checklist, setChecklist] = useState(() => Object.fromEntries(ITENS_CHECKLIST.map(i => [i, { ok: true, descricao: '', foto: null }])))
  const [comb, setComb] = useState(null)
  const [fotoComb, setFotoComb] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const aberto = usoAbertoDe(usos, usuario.id)
  const cnh = diasAte(usuario.cnhValidade)
  let bloqueio = ''
  if (!v) bloqueio = 'Veículo não encontrado. O QR pode ser de outra organização ou o veículo foi removido.'
  else if (aberto) bloqueio = 'Você já está com um veículo. Devolva-o antes de retirar outro.'
  else if (v.situacao !== 'disponivel') bloqueio = `Este veículo não está disponível (${v.situacao === 'em_uso' ? 'em uso' : v.situacao}).`
  else if (!usuario.ativo) bloqueio = 'Seu cadastro está bloqueado. Fale com a responsável.'
  else if (config.bloquearCnhVencida && cnh !== null && cnh < 0) bloqueio = 'Sua CNH está vencida. Atualize o cadastro com a responsável para retirar veículos.'

  if (bloqueio) return (
    <div className="page estreita">
      <PageHeader titulo="Retirada" subtitulo={v ? v.modelo + ' · ' + v.placa : ''} voltar={() => ir('/inicio')} />
      <div className="stack"><Erro msg={bloqueio} /><button className="btn ghost" onClick={() => ir('/inicio')}>Voltar ao início</button></div>
    </div>
  )

  function avancar() {
    const n = Number(kmInicial)
    if (!kmInicial || Number.isNaN(n)) return setErro('Informe o hodômetro que aparece no painel do carro.')
    if (n < v.hodometro) return setErro(`O valor é menor que o último registrado (${km(v.hodometro)}). Confira o painel do carro.`)
    if (config.fotoHodometro && !fotoKm) return setErro('Tire a foto do hodômetro.')
    if (!finalidade.trim()) return setErro('Informe a finalidade do uso.')
    setErro(''); setPasso(2); window.scrollTo(0, 0)
  }

  async function confirmar() {
    const problemas = Object.entries(checklist).filter(([, c]) => !c.ok)
    for (const [item, c] of problemas) {
      if (!c.descricao.trim()) return setErro(`Descreva o problema em "${item}".`)
      if (config.fotoProblema && !c.foto) return setErro(`Tire a foto do problema em "${item}".`)
    }
    if (comb === null) return setErro('Marque o nível de combustível.')
    if (config.fotoCombustivel && !fotoComb) return setErro('Tire a foto do marcador de combustível.')
    setSalvando(true)
    const agora = new Date().toISOString()
    const n = Number(kmInicial)
    await db.transaction('rw', db.usos, db.veiculos, db.ocorrencias, async () => {
      const usoId = await db.usos.add({
        veiculoId: v.id, condutorId: usuario.id, inicio: agora, kmInicial: n, fotoKmInicial: fotoKm,
        finalidade: finalidade.trim(), previsao, checklistSaida: checklist, combSaida: comb, fotoCombSaida: fotoComb,
        alertaKm: n - v.hodometro > 1000, status: 'aberto', aprovacao: null
      })
      for (const [item, c] of problemas) {
        await db.ocorrencias.add({ veiculoId: v.id, condutorId: usuario.id, usoId, data: agora, tipo: 'Avaria na saída', gravidade: 'Baixa', descricao: `${item}: ${c.descricao.trim()}`, foto: c.foto, aprovacao: 'pendente' })
      }
      await db.veiculos.update(v.id, { situacao: 'em_uso', hodometro: n })
    })
    await recarregar()
    ir('/uso')
  }

  const marcar = (item, campo, valor) => setChecklist(c => ({ ...c, [item]: { ...c[item], [campo]: valor } }))

  return (
    <div className="page estreita">
      <PageHeader titulo={passo === 1 ? `Retirada · ${v.modelo}` : 'Verificação de saída'} subtitulo={`${v.placa} · passo ${passo} de 2`} voltar={() => (passo === 2 ? setPasso(1) : ir('/inicio'))} />
      <div className="passos"><i className="on" /><i className={passo === 2 ? 'on' : ''} /></div>
      {passo === 1 ? (
        <div className="stack">
          <div className="card row"><div><div className="lbl">Condutor</div><b>{usuario.nome}</b></div><div className="dir"><div className="lbl">Data e hora</div><b>{dataHora(new Date().toISOString())}</b></div></div>
          <div className="form">
            <label className="campo"><span className="lbl">Hodômetro inicial (km)</span><input className="inp big" inputMode="numeric" name="kmInicial" value={kmInicial} onChange={e => setKmInicial(e.target.value.replace(/\D/g, ''))} /><span className="muted">Último registrado: {km(v.hodometro)}</span></label>
            <CampoFoto rotulo="Foto do hodômetro" obrigatoria={config.fotoHodometro} valor={fotoKm} onChange={setFotoKm} />
            <label className="campo"><span className="lbl">Finalidade</span><input className="inp" name="finalidade" placeholder="Ex.: entrega de cestas no bairro X" value={finalidade} onChange={e => setFinalidade(e.target.value)} /></label>
            <label className="campo"><span className="lbl">Previsão de devolução<span className="opt">opcional</span></span><input className="inp" type="time" value={previsao} onChange={e => setPrevisao(e.target.value)} /></label>
          </div>
          <Erro msg={erro} />
          <button className="btn pri" onClick={avancar}>Continuar para a verificação</button>
        </div>
      ) : (
        <div className="stack">
          <div className="card lista-chk">
            {ITENS_CHECKLIST.map(item => (
              <div key={item} className="chk-bloco">
                <div className="chk">{item}
                  <div className="seg">
                    <button className={checklist[item].ok ? 'y' : ''} onClick={() => marcar(item, 'ok', true)}>OK</button>
                    <button className={!checklist[item].ok ? 'n' : ''} onClick={() => marcar(item, 'ok', false)}>Problema</button>
                  </div>
                </div>
                {!checklist[item].ok && (
                  <div className="chk-prob">
                    <input className="inp" placeholder="Descreva o problema" value={checklist[item].descricao} onChange={e => marcar(item, 'descricao', e.target.value)} />
                    <CampoFoto rotulo="Foto do problema" obrigatoria={config.fotoProblema} valor={checklist[item].foto} onChange={id => marcar(item, 'foto', id)} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="form">
            <div className="card"><div className="lbl">Combustível na saída</div><Combustivel valor={comb} onChange={setComb} /><div className="muted">{comb === null ? 'Toque no nível' : NIVEIS_COMBUSTIVEL[comb]}</div></div>
            <CampoFoto rotulo="Foto do marcador de combustível" obrigatoria={config.fotoCombustivel} valor={fotoComb} onChange={setFotoComb} />
          </div>
          <div className="muted">Problemas marcados aqui viram ocorrência e protegem você: ficam registrados como já existentes antes da saída.</div>
          <Erro msg={erro} />
          <button className="btn pri" disabled={salvando} onClick={confirmar}>{salvando ? 'Registrando…' : 'Confirmar saída'}</button>
        </div>
      )}
    </div>
  )
}

function useUsoAtual(usuario) {
  const { usos, veiculos } = useDados()
  const uso = usoAbertoDe(usos, usuario.id)
  const v = uso && veiculos.find(x => x.id === uso.veiculoId)
  return { uso, v }
}

export function EmUso({ usuario, ir }) {
  const { abastecimentos, ocorrencias } = useDados()
  const { uso, v } = useUsoAtual(usuario)
  const [, tique] = useState(0)
  useEffect(() => { const t = setInterval(() => tique(x => x + 1), 30000); return () => clearInterval(t) }, [])
  if (!uso) return <SemUso ir={ir} />
  const registros = [
    { quando: uso.inicio, texto: 'Saída · ' + km(uso.kmInicial), status: null },
    ...abastecimentos.filter(a => a.usoId === uso.id).map(a => ({ quando: a.data, texto: `Abastecimento ${a.litros} L · ${reais(a.valor)}`, status: a.aprovacao })),
    ...ocorrencias.filter(o => o.usoId === uso.id).map(o => ({ quando: o.data, texto: `Ocorrência · ${o.tipo}`, status: o.aprovacao }))
  ].sort((a, b) => a.quando.localeCompare(b.quando))
  return (
    <div className="page estreita">
      <PageHeader titulo={`${v.modelo} · ${v.placa}`} subtitulo="Você está com a chave" voltar={() => ir('/inicio')} />
      <div className="stack">
        <div className="card centro">
          <span className="pill p-use">Em uso</span>
          <div className="big-num">{duracao(uso.inicio)}</div>
          <div className="muted">Saída {dataHora(uso.inicio)} · {km(uso.kmInicial)}{uso.previsao ? ' · devolução prevista ' + uso.previsao : ''}</div>
          <div className="muted">{uso.finalidade}</div>
        </div>
        <div className="grid2">
          <button className="card acao" onClick={() => ir('/abastecer')}><Fuel size={24} /><b>Abastecer</b></button>
          <button className="card acao" onClick={() => ir('/ocorrencia')}><AlertTriangle size={24} /><b>Ocorrência</b></button>
        </div>
        <div className="card">
          <div className="lbl">Registros deste uso</div>
          {registros.map((r, i) => (
            <div key={i} className="row linha"><span className="muted">{dataHora(r.quando)} · {r.texto}</span>{r.status && <Pill valor={r.status} />}</div>
          ))}
        </div>
        <button className="btn nav" onClick={() => ir('/devolver')}><KeyRound size={18} /> Devolver veículo</button>
      </div>
    </div>
  )
}

function SemUso({ ir }) {
  return (
    <div className="page estreita">
      <PageHeader titulo="Nenhum veículo com você" voltar={() => ir('/inicio')} />
      <div className="stack"><Vazio>Você não está com nenhum veículo agora.</Vazio><button className="btn ghost" onClick={() => ir('/inicio')}>Voltar ao início</button></div>
    </div>
  )
}

export function Abastecer({ usuario, ir }) {
  const { config, recarregar } = useDados()
  const { uso, v } = useUsoAtual(usuario)
  const [f, setF] = useState({ litros: '', valor: '', km: '', posto: '' })
  const [fotoKm, setFotoKm] = useState(null)
  const [fotoNota, setFotoNota] = useState(null)
  const [erro, setErro] = useState('')
  if (!uso) return <SemUso ir={ir} />
  const set = c => e => setF({ ...f, [c]: e.target.value })
  const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'))
  const preco = num(f.litros) > 0 && num(f.valor) > 0 ? num(f.valor) / num(f.litros) : null

  async function salvar() {
    const litros = num(f.litros), valor = num(f.valor), kmAtual = Number(f.km)
    if (!(litros > 0)) return setErro('Informe os litros.')
    if (!(valor > 0)) return setErro('Informe o valor pago.')
    if (!kmAtual || kmAtual < uso.kmInicial) return setErro(`O hodômetro deve ser pelo menos ${km(uso.kmInicial)}, o valor da saída.`)
    if (config.fotoHodometro && !fotoKm) return setErro('Tire a foto do hodômetro.')
    if (config.fotoNotaFiscal && !fotoNota) return setErro('Tire a foto da nota fiscal.')
    await db.abastecimentos.add({ veiculoId: v.id, condutorId: usuario.id, usoId: uso.id, data: new Date().toISOString(), litros, valor, km: kmAtual, posto: f.posto.trim(), fotoKm, fotoNota, aprovacao: aprovacaoInicial(config) })
    if (kmAtual > v.hodometro) await db.veiculos.update(v.id, { hodometro: kmAtual })
    await recarregar()
    ir('/uso')
  }

  return (
    <div className="page estreita">
      <PageHeader titulo="Abastecimento" subtitulo={`${v.modelo} · ${v.placa}`} voltar={() => ir('/uso')} />
      <div className="stack">
        <div className="form">
          <label className="campo"><span className="lbl">Litros</span><input className="inp big" name="litros" inputMode="decimal" placeholder="0,0" value={f.litros} onChange={set('litros')} /></label>
          <label className="campo"><span className="lbl">Valor (R$)</span><input className="inp big" name="valor" inputMode="decimal" placeholder="0,00" value={f.valor} onChange={set('valor')} /></label>
          <label className="campo"><span className="lbl">Hodômetro no abastecimento (km)</span><input className="inp" name="km" inputMode="numeric" placeholder={String(uso.kmInicial)} value={f.km} onChange={e => setF({ ...f, km: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="campo"><span className="lbl">Posto<span className="opt">opcional</span></span><input className="inp" placeholder="Ex.: Posto Central" value={f.posto} onChange={set('posto')} /></label>
          <CampoFoto rotulo="Foto do hodômetro" obrigatoria={config.fotoHodometro} valor={fotoKm} onChange={setFotoKm} />
          <CampoFoto rotulo="Foto da nota fiscal" obrigatoria={config.fotoNotaFiscal} valor={fotoNota} onChange={setFotoNota} />
        </div>
        {preco && <div className="muted">{reais(preco)} por litro</div>}
        <Erro msg={erro} />
        <button className="btn pri" onClick={salvar}>Salvar abastecimento</button>
      </div>
    </div>
  )
}

const TIPOS = ['Avaria', 'Pneu', 'Mecânico', 'Elétrico', 'Multa', 'Outro']
const GRAVIDADES = ['Baixa', 'Média', 'Impede o uso']

export function NovaOcorrencia({ usuario, ir }) {
  const { config, recarregar } = useDados()
  const { uso, v } = useUsoAtual(usuario)
  const [tipo, setTipo] = useState('')
  const [gravidade, setGravidade] = useState('')
  const [descricao, setDescricao] = useState('')
  const [foto, setFoto] = useState(null)
  const [erro, setErro] = useState('')
  if (!uso) return <SemUso ir={ir} />

  async function salvar() {
    if (!tipo) return setErro('Escolha o tipo.')
    if (!gravidade) return setErro('Escolha a gravidade.')
    if (!descricao.trim()) return setErro('Descreva o que aconteceu.')
    if (config.fotoProblema && !foto) return setErro('Tire uma foto do problema.')
    await db.ocorrencias.add({ veiculoId: v.id, condutorId: usuario.id, usoId: uso.id, data: new Date().toISOString(), tipo, gravidade, descricao: descricao.trim(), foto, aprovacao: 'pendente' })
    await recarregar()
    ir('/uso')
  }

  return (
    <div className="page estreita">
      <PageHeader titulo="Nova ocorrência" subtitulo={`${v.modelo} · ${v.placa}`} voltar={() => ir('/uso')} />
      <div className="stack">
        <div className="campo"><span className="lbl">Tipo</span><div className="chips">{TIPOS.map(t => <button key={t} className={'chip' + (tipo === t ? ' on' : '')} onClick={() => setTipo(t)}>{t}</button>)}</div></div>
        <div className="campo"><span className="lbl">Gravidade</span><div className="chips">{GRAVIDADES.map(g => <button key={g} className={'chip' + (gravidade === g ? ' on' : '')} onClick={() => setGravidade(g)}>{g}</button>)}</div></div>
        <label className="campo"><span className="lbl">Descrição</span><textarea className="inp" name="descricao" rows="4" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="O que aconteceu, onde e quando" /></label>
        <CampoFoto rotulo="Fotografia" obrigatoria={config.fotoProblema} valor={foto} onChange={setFoto} />
        <div className="muted">A responsável é avisada no painel. Ocorrências que impedem o uso deixam o veículo em manutenção na devolução.</div>
        <Erro msg={erro} />
        <button className="btn pri" onClick={salvar}>Registrar ocorrência</button>
      </div>
    </div>
  )
}

export function Devolucao({ usuario, ir }) {
  const { config, abastecimentos, ocorrencias, recarregar } = useDados()
  const { uso, v } = useUsoAtual(usuario)
  const [kmFinal, setKmFinal] = useState('')
  const [comb, setComb] = useState(null)
  const [fotoKm, setFotoKm] = useState(null)
  const [fotoComb, setFotoComb] = useState(null)
  const [mesmas, setMesmas] = useState(true)
  const [chave, setChave] = useState(true)
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  if (!uso) return <SemUso ir={ir} />
  const kmMinimo = Math.max(uso.kmInicial, ...abastecimentos.filter(a => a.usoId === uso.id).map(a => a.km))
  const rodados = kmFinal ? Number(kmFinal) - uso.kmInicial : null

  async function finalizar() {
    const n = Number(kmFinal)
    if (!kmFinal || n < kmMinimo) return setErro(`O hodômetro final deve ser pelo menos ${km(kmMinimo)}.`)
    if (comb === null) return setErro('Marque o nível de combustível.')
    if (config.fotoHodometro && !fotoKm) return setErro('Tire a foto do hodômetro.')
    if (config.fotoCombustivel && !fotoComb) return setErro('Tire a foto do marcador de combustível.')
    if ((!mesmas || !chave) && !obs.trim()) return setErro('Explique na observação o que mudou ou o que não foi devolvido.')
    setSalvando(true)
    const agora = new Date().toISOString()
    const impede = ocorrencias.some(o => o.usoId === uso.id && o.gravidade === 'Impede o uso')
    await db.transaction('rw', db.usos, db.veiculos, db.ocorrencias, async () => {
      await db.usos.update(uso.id, {
        fim: agora, kmFinal: n, combRetorno: comb, fotoKmFinal: fotoKm, fotoCombRetorno: fotoComb,
        mesmasCondicoes: mesmas, chaveDevolvida: chave, observacao: obs.trim(),
        alertaKm: uso.alertaKm || n - uso.kmInicial > 800, status: 'finalizado', aprovacao: aprovacaoInicial(config)
      })
      if (!mesmas || !chave) {
        await db.ocorrencias.add({ veiculoId: v.id, condutorId: usuario.id, usoId: uso.id, data: agora, tipo: 'Devolução', gravidade: 'Média', descricao: obs.trim(), foto: null, aprovacao: 'pendente' })
      }
      await db.veiculos.update(v.id, { hodometro: n, situacao: impede ? 'manutencao' : 'disponivel' })
    })
    await recarregar()
    ir('/meus-usos')
  }

  return (
    <div className="page estreita">
      <PageHeader titulo="Devolução" subtitulo={`${v.modelo} · ${v.placa}`} voltar={() => ir('/uso')} />
      <div className="stack">
        <div className="form">
          <label className="campo"><span className="lbl">Hodômetro final (km)</span><input className="inp big" name="kmFinal" inputMode="numeric" placeholder={String(kmMinimo)} value={kmFinal} onChange={e => setKmFinal(e.target.value.replace(/\D/g, ''))} /></label>
          <div className="card"><div className="lbl">Combustível na devolução</div><Combustivel valor={comb} onChange={setComb} /><div className="muted">{comb === null ? 'Toque no nível' : NIVEIS_COMBUSTIVEL[comb]} · saída: {NIVEIS_COMBUSTIVEL[uso.combSaida]}</div></div>
        </div>
        {rodados !== null && rodados >= 0 && <div className="card row ok-box"><span>Rodados neste uso</span><b>{km(rodados)} · {duracao(uso.inicio)}</b></div>}
        <div className="form">
          <CampoFoto rotulo="Foto do hodômetro" obrigatoria={config.fotoHodometro} valor={fotoKm} onChange={setFotoKm} />
          <CampoFoto rotulo="Foto do marcador de combustível" obrigatoria={config.fotoCombustivel} valor={fotoComb} onChange={setFotoComb} />
        </div>
        <div className="card lista-chk">
          <div className="chk">Mesmas condições da saída?<div className="seg"><button className={mesmas ? 'y' : ''} onClick={() => setMesmas(true)}>Sim</button><button className={!mesmas ? 'n' : ''} onClick={() => setMesmas(false)}>Não</button></div></div>
          <div className="chk">Chave e documento devolvidos<div className="seg"><button className={chave ? 'y' : ''} onClick={() => setChave(true)}>Sim</button><button className={!chave ? 'n' : ''} onClick={() => setChave(false)}>Não</button></div></div>
        </div>
        <label className="campo"><span className="lbl">Observação{mesmas && chave ? <span className="opt">opcional</span> : <span className="req">obrigatória</span>}</span><input className="inp" placeholder="Algo que o próximo condutor deva saber" value={obs} onChange={e => setObs(e.target.value)} /></label>
        <Erro msg={erro} />
        <button className="btn nav" disabled={salvando} onClick={finalizar}>{salvando ? 'Finalizando…' : 'Finalizar devolução'}</button>
      </div>
    </div>
  )
}

export function MeusUsos({ usuario, ir }) {
  const { usos, abastecimentos, ocorrencias, veiculos, recarregar } = useDados()
  const nomeV = id => { const v = veiculos.find(x => x.id === id); return v ? v.modelo.split(' ').slice(-1)[0] : '' }
  const itens = [
    ...usos.filter(u => u.condutorId === usuario.id).map(u => ({ tabela: 'usos', campoFoto: 'fotoKmFinal', reg: u, quando: u.inicio, titulo: u.status === 'aberto' ? `${nomeV(u.veiculoId)} · em uso` : `Devolução · ${nomeV(u.veiculoId)} · ${km(u.kmFinal - u.kmInicial)}`, sub: `${dataHora(u.inicio)}${u.fim ? ' a ' + dataHora(u.fim) : ''} · ${u.finalidade}`, status: u.status === 'aberto' ? null : u.aprovacao })),
    ...abastecimentos.filter(a => a.condutorId === usuario.id).map(a => ({ tabela: 'abastecimentos', campoFoto: 'fotoKm', reg: a, quando: a.data, titulo: `Abastecimento ${a.litros} L · ${nomeV(a.veiculoId)}`, sub: `${dataHora(a.data)} · ${reais(a.valor)}`, status: a.aprovacao })),
    ...ocorrencias.filter(o => o.condutorId === usuario.id).map(o => ({ tabela: 'ocorrencias', campoFoto: 'foto', reg: o, quando: o.data, titulo: `Ocorrência · ${o.tipo} · ${nomeV(o.veiculoId)}`, sub: `${dataHora(o.data)} · ${o.descricao}`, status: o.aprovacao }))
  ].sort((a, b) => b.quando.localeCompare(a.quando))

  async function reenviar(item, foto) {
    await db[item.tabela].update(item.reg.id, { [item.campoFoto]: foto, aprovacao: 'pendente', motivoAnterior: item.reg.motivo, motivo: null })
    await recarregar()
  }

  return (
    <div className="page estreita">
      <PageHeader titulo="Meus usos" subtitulo={usuario.nome} />
      <div className="stack">
        {itens.length === 0 && <Vazio>Seus usos, abastecimentos e ocorrências aparecem aqui.</Vazio>}
        {itens.map(item => (
          <div key={item.tabela + item.reg.id} className={'card' + (item.status === 'recusado' ? ' recusado' : '')}>
            <div className="row"><b>{item.titulo}</b>{item.status ? <Pill valor={item.status} /> : <button className="link" onClick={() => ir('/uso')}>abrir</button>}</div>
            <div className="muted">{item.sub}</div>
            {item.status === 'recusado' && (
              <>
                <div className="motivo">Responsável: "{item.reg.motivo}"</div>
                <CampoFoto rotulo="Enviar nova foto e reenviar para análise" obrigatoria valor={null} onChange={foto => reenviar(item, foto)} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
