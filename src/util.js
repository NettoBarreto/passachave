export const SITUACOES = {
  disponivel: { rotulo: 'Disponível', classe: 'p-ok' },
  em_uso: { rotulo: 'Em uso', classe: 'p-use' },
  manutencao: { rotulo: 'Manutenção', classe: 'p-warn' },
  inativo: { rotulo: 'Inativo', classe: 'p-off' }
}

export const APROVACOES = {
  pendente: { rotulo: 'Em análise', classe: 'p-warn' },
  aprovado: { rotulo: 'Aprovado', classe: 'p-ok' },
  recusado: { rotulo: 'Recusado', classe: 'p-bad' },
  ciente: { rotulo: 'Ciente', classe: 'p-ok' },
  manutencao: { rotulo: 'Virou manutenção', classe: 'p-use' }
}

export const NIVEIS_COMBUSTIVEL = ['Reserva', '1/4', '1/2', '3/4', 'Cheio']

export const ITENS_CHECKLIST = ['Pneus e estepe', 'Faróis e setas', 'Lataria e vidros', 'Documento do veículo', 'Limpeza interna']

export const km = n => (n ?? 0).toLocaleString('pt-BR') + ' km'
export const reais = n => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const dataHora = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
export const data = iso => iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR') : ''

export function diasAte(isoData) {
  if (!isoData) return null
  const alvo = new Date(isoData + 'T12:00:00')
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return Math.round((alvo - hoje) / 86400000)
}

export function duracao(inicio, fim) {
  const min = Math.max(0, Math.round(((fim ? new Date(fim) : new Date()) - new Date(inicio)) / 60000))
  const h = Math.floor(min / 60)
  return h ? `${h}h ${String(min % 60).padStart(2, '0')}min` : `${min} min`
}

export function mesmoMes(iso, ref = new Date()) {
  const d = new Date(iso)
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear()
}

function textoPrazo(dias) {
  if (dias < 0) return `venceu há ${-dias} dia${dias === -1 ? '' : 's'}`
  if (dias === 0) return 'vence hoje'
  return `vence em ${dias} dia${dias === 1 ? '' : 's'}`
}

// Alertas automáticos: CNH, licenciamento, seguro, revisão por km ou data e ocorrências graves.
export function calcularAlertas({ usuarios, veiculos, ocorrencias, config }) {
  const alertas = []
  const limite = Number(config.diasAviso) || 15
  for (const u of usuarios) {
    if (!u.ativo) continue
    const d = diasAte(u.cnhValidade)
    if (d !== null && d <= limite) alertas.push({ grave: d < 0, icone: '🪪', titulo: d < 0 ? 'CNH vencida' : 'CNH vencendo', texto: `${u.nome} · ${textoPrazo(d)}` })
  }
  for (const v of veiculos) {
    if (v.situacao === 'inativo') continue
    const lic = diasAte(v.licenciamento)
    if (lic !== null && lic <= limite) alertas.push({ grave: lic < 0, icone: '📄', titulo: lic < 0 ? 'Licenciamento vencido' : 'Licenciamento a vencer', texto: `${v.modelo} ${v.placa} · ${textoPrazo(lic)}` })
    const seg = diasAte(v.seguro)
    if (seg !== null && seg <= limite) alertas.push({ grave: seg < 0, icone: '🛡️', titulo: seg < 0 ? 'Seguro vencido' : 'Seguro a vencer', texto: `${v.modelo} ${v.placa} · ${textoPrazo(seg)}` })
    if (v.revisaoKm) {
      const proxima = (v.ultimaRevisaoKm || 0) + Number(v.revisaoKm)
      const falta = proxima - v.hodometro
      if (falta <= 1000) alertas.push({ grave: falta <= 0, icone: '🛠️', titulo: 'Revisão por quilometragem', texto: `${v.modelo} ${v.placa} · ${falta <= 0 ? `passou ${km(-falta)} da revisão` : `faltam ${km(falta)} para ${km(proxima)}`}` })
    }
    if (v.revisaoMeses && v.ultimaRevisaoData) {
      const prox = new Date(v.ultimaRevisaoData + 'T12:00:00')
      prox.setMonth(prox.getMonth() + Number(v.revisaoMeses))
      const d = diasAte(prox.toISOString().slice(0, 10))
      if (d <= limite) alertas.push({ grave: d < 0, icone: '📅', titulo: 'Revisão por data', texto: `${v.modelo} ${v.placa} · ${textoPrazo(d)}` })
    }
  }
  for (const o of ocorrencias) {
    if (o.gravidade === 'Impede o uso' && o.aprovacao === 'pendente') {
      const v = veiculos.find(x => x.id === o.veiculoId)
      alertas.push({ grave: true, icone: '⚠️', titulo: 'Ocorrência que impede o uso', texto: `${v ? v.modelo + ' ' + v.placa : ''} · ${o.tipo}` })
    }
  }
  return alertas.sort((a, b) => Number(b.grave) - Number(a.grave))
}

// Consumo: km rodados nos usos finalizados dividido pelos litros abastecidos no mesmo período.
export function consumo(usos, abastecimentos) {
  const kmRodados = usos.filter(u => u.status === 'finalizado').reduce((s, u) => s + (u.kmFinal - u.kmInicial), 0)
  const litros = abastecimentos.reduce((s, a) => s + Number(a.litros || 0), 0)
  return litros > 0 && kmRodados > 0 ? kmRodados / litros : null
}

export function baixarCsv(nome, linhas) {
  const csv = linhas.map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  URL.revokeObjectURL(a.href)
}

export function hoje(deslocamentoDias = 0) {
  const d = new Date()
  d.setDate(d.getDate() + deslocamentoDias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
