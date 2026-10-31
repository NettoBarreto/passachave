import { db } from './db.js'
import { hoje } from './util.js'

// Gera cerca de dez semanas de uso fictício para demonstrar o sistema.
// O sorteio usa semente fixa, então os dados saem iguais toda vez.
function sorteador(semente) {
  let s = semente
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const FINALIDADES = [
  'Entrega de cestas básicas', 'Visitas domiciliares', 'Compra de mantimentos', 'Transporte de voluntários',
  'Retirada de doações', 'Levar crianças à oficina de música', 'Reunião na prefeitura', 'Entrega de agasalhos',
  'Apoio ao bazar beneficente', 'Consulta médica de assistido'
]
const BAIRROS = ['Jardim Ipê', 'Vila Hortência', 'Centro', 'Éden', 'Wanel Ville', 'Cajuru', 'Campolim', 'Vitória Régia']
const POSTOS = ['Posto Central', 'Auto Posto Itavuvu', 'Posto Campolim', 'Posto Santa Rosália']

export async function criarDadosSimulados() {
  const r = sorteador(20261030)
  const entre = (a, b) => a + Math.floor(r() * (b - a + 1))
  const um = lista => lista[entre(0, lista.length - 1)]
  const agora = new Date()
  const senha = (await db.usuarios.where('email').equals('marina@passachave.test').first()).senhaHash

  await db.usuarios.bulkAdd([
    { nome: 'João Pedro Martins', email: 'joao@passachave.test', perfil: 'condutor', vinculo: 'Voluntário', cnhCategoria: 'B', cnhValidade: hoje(420), ativo: true, senhaHash: senha },
    { nome: 'Carla Dias', email: 'carla@passachave.test', perfil: 'condutor', vinculo: 'Voluntária', cnhCategoria: 'B', cnhValidade: hoje(-20), ativo: false, senhaHash: senha }
  ])
  await db.veiculos.add({ placa: 'QWE-9D02', modelo: 'Chevrolet Spin', ano: 2019, combustivel: 'Flex', hodometro: 63870, situacao: 'manutencao', licenciamento: hoje(150), seguro: hoje(95), revisaoKm: 10000, revisaoMeses: 6, ultimaRevisaoKm: 55000, ultimaRevisaoData: hoje(-150) })

  const veiculos = await db.veiculos.toArray()
  const usuarios = await db.usuarios.toArray()
  const porPlaca = placa => veiculos.find(v => v.placa === placa)
  const porEmail = email => usuarios.find(u => u.email.startsWith(email))
  const condutores = usuarios.filter(u => u.perfil === 'condutor' && u.ativo)
  const gol = porPlaca('BRA-3C17'), spin = porPlaca('QWE-9D02')

  // 1. Planeja os usos dos últimos 70 dias (sem domingos)
  const planos = []
  for (let d = 70; d >= 1; d--) {
    const dia = new Date(agora)
    dia.setDate(dia.getDate() - d)
    if (dia.getDay() === 0) continue
    const usados = new Set()
    for (let i = 0; i < entre(1, 3); i++) {
      const v = um(veiculos)
      if (usados.has(v.id) || (v.id === spin.id && d < 6)) continue
      usados.add(v.id)
      const inicio = new Date(dia)
      inicio.setHours(entre(7, 14), entre(0, 59), 0, 0)
      const fim = new Date(inicio.getTime() + (entre(1, 4) * 60 + entre(0, 59)) * 60000)
      planos.push({ v, condutor: um(condutores), inicio, fim, km: entre(12, 110) })
    }
  }

  // 2. Hodômetro inicial de cada veículo, para terminar exatamente no valor atual
  const atual = Object.fromEntries(veiculos.map(v => [v.id, v.hodometro - planos.filter(p => p.v.id === v.id).reduce((s, p) => s + p.km, 0)]))
  const desdeAbastecimento = Object.fromEntries(veiculos.map(v => [v.id, entre(0, 200)]))

  // 3. Grava usos e abastecimentos em ordem de data
  for (const p of planos) {
    const kmInicial = atual[p.v.id]
    const kmFinal = kmInicial + p.km
    atual[p.v.id] = kmFinal
    const recente = agora - p.fim < 3 * 86400000
    const combSaida = entre(1, 4)
    const usoId = await db.usos.add({
      veiculoId: p.v.id, condutorId: p.condutor.id, inicio: p.inicio.toISOString(), fim: p.fim.toISOString(),
      kmInicial, kmFinal, finalidade: `${um(FINALIDADES)} · ${um(BAIRROS)}`, previsao: '', checklistSaida: null,
      combSaida, combRetorno: Math.max(0, combSaida - entre(0, 1)), mesmasCondicoes: true, chaveDevolvida: true, observacao: '',
      alertaKm: false, status: 'finalizado', aprovacao: recente ? 'pendente' : 'aprovado'
    })
    desdeAbastecimento[p.v.id] += p.km
    if (desdeAbastecimento[p.v.id] > 320) {
      const litros = Math.round((desdeAbastecimento[p.v.id] / (8 + r() * 2.5)) * 10) / 10
      const preco = 5.79 + Math.round(r() * 50) / 100
      await db.abastecimentos.add({
        veiculoId: p.v.id, condutorId: p.condutor.id, usoId, data: new Date((p.inicio.getTime() + p.fim.getTime()) / 2).toISOString(),
        litros, valor: Math.round(litros * preco * 100) / 100, km: kmInicial + Math.round(p.km / 2), posto: um(POSTOS),
        fotoKm: null, fotoNota: null, aprovacao: recente ? 'pendente' : 'aprovado'
      })
      desdeAbastecimento[p.v.id] = 0
    }
  }

  // 4. Um registro recusado para mostrar o retorno ao condutor
  const rafael = porEmail('rafael')
  const recusar = (await db.usos.where('condutorId').equals(rafael.id).toArray()).filter(u => agora - new Date(u.fim) > 3 * 86400000).pop()
  if (recusar) await db.usos.update(recusar.id, { aprovacao: 'recusado', motivo: 'A foto do hodômetro está borrada, não dá para ler o km. Pode refazer?' })

  // 5. Ocorrências e manutenções
  const dataHoras = (dias, hora) => { const d = new Date(agora); d.setDate(d.getDate() + dias); d.setHours(hora, 20, 0, 0); return d.toISOString() }
  const fiorino = porPlaca('FTR-2B41'), kombi = porPlaca('KMB-1A88'), strada = porPlaca('STR-7E55')
  await db.ocorrencias.bulkAdd([
    { veiculoId: fiorino.id, condutorId: rafael.id, usoId: null, data: dataHoras(-9, 10), tipo: 'Pneu', gravidade: 'Média', descricao: 'Pneu dianteiro esquerdo murchando. Calibrei no posto, mas precisa verificar.', foto: null, aprovacao: 'manutencao' },
    { veiculoId: kombi.id, condutorId: porEmail('paulo').id, usoId: null, data: dataHoras(-20, 15), tipo: 'Avaria', gravidade: 'Baixa', descricao: 'Risco na porta lateral ao manobrar no galpão.', foto: null, aprovacao: 'ciente' },
    { veiculoId: spin.id, condutorId: porEmail('joao').id, usoId: null, data: dataHoras(-5, 11), tipo: 'Mecânico', gravidade: 'Impede o uso', descricao: 'Barulho forte na suspensão dianteira e carro puxando para a direita.', foto: null, aprovacao: 'manutencao' },
    { veiculoId: strada.id, condutorId: porEmail('ana').id, usoId: null, data: dataHoras(-1, 9), tipo: 'Avaria na saída', gravidade: 'Baixa', descricao: 'Lataria e vidros: trinca pequena no canto do para-brisa.', foto: null, aprovacao: 'pendente' }
  ])
  await db.manutencoes.bulkAdd([
    { veiculoId: gol.id, servico: 'Troca de óleo e filtro', tipo: 'preventiva', data: hoje(-40), custo: 245, status: 'realizada', km: '' },
    { veiculoId: kombi.id, servico: 'Pastilhas de freio dianteiras', tipo: 'corretiva', data: hoje(-25), custo: 320, status: 'realizada', km: '' },
    { veiculoId: fiorino.id, servico: 'Pneu: conserto e balanceamento (ocorrência)', tipo: 'corretiva', data: hoje(-8), custo: 90, status: 'realizada', km: '' },
    { veiculoId: spin.id, servico: 'Suspensão dianteira (ocorrência)', tipo: 'corretiva', data: hoje(2), custo: null, status: 'prevista', km: '' },
    { veiculoId: strada.id, servico: 'Revisão dos 20.000 km', tipo: 'preventiva', data: hoje(10), custo: 480, status: 'prevista', km: '' }
  ])

  // 6. Gol está com a Ana agora
  const saida = new Date(agora)
  if (saida.getHours() >= 9) saida.setHours(8, 10, 0, 0)
  else saida.setTime(agora.getTime() - 40 * 60000)
  await db.usos.add({
    veiculoId: gol.id, condutorId: porEmail('ana').id, inicio: saida.toISOString(), kmInicial: gol.hodometro, fotoKmInicial: null,
    finalidade: 'Visitas domiciliares · Jardim Ipê', previsao: '13:00', checklistSaida: null, combSaida: 3, fotoCombSaida: null,
    alertaKm: false, status: 'aberto', aprovacao: null
  })
  await db.veiculos.update(gol.id, { situacao: 'em_uso' })
}
