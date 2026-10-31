import Dexie from 'dexie'
import { hoje } from './util.js'

export const db = new Dexie('passachave')

db.version(1).stores({
  usuarios: '++id, &email, perfil',
  veiculos: '++id, placa, situacao',
  usos: '++id, veiculoId, condutorId, status, aprovacao, inicio',
  abastecimentos: '++id, veiculoId, condutorId, usoId, aprovacao, data',
  ocorrencias: '++id, veiculoId, condutorId, usoId, aprovacao, data',
  manutencoes: '++id, veiculoId, status, data',
  fotos: '++id',
  config: 'chave'
})

// Fotos começam opcionais; cada organização liga o que quiser exigir em Configurações.
export const CONFIG_PADRAO = {
  fotoHodometro: false,
  fotoCombustivel: false,
  fotoNotaFiscal: false,
  fotoProblema: false,
  exigirAprovacao: true,
  diasAviso: 15,
  bloquearCnhVencida: true
}

export async function lerConfig() {
  const linhas = await db.config.toArray()
  const cfg = { ...CONFIG_PADRAO }
  for (const l of linhas) cfg[l.chave] = l.valor
  return cfg
}

export async function salvarConfig(chave, valor) {
  await db.config.put({ chave, valor })
}

export async function hashSenha(senha) {
  const dados = new TextEncoder().encode('passachave:' + senha)
  const buf = await crypto.subtle.digest('SHA-256', dados)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const diasAPartirDeHoje = hoje

export const USUARIOS_TESTE = [
  { nome: 'Marina Alves', email: 'marina@passachave.test', perfil: 'responsavel', vinculo: 'Funcionária', cnhCategoria: 'B', cnhValidade: 900, ativo: true },
  { nome: 'Rafael Lima', email: 'rafael@passachave.test', perfil: 'condutor', vinculo: 'Voluntário', cnhCategoria: 'B', cnhValidade: 1500, ativo: true },
  { nome: 'Ana Souza', email: 'ana@passachave.test', perfil: 'condutor', vinculo: 'Voluntária', cnhCategoria: 'AB', cnhValidade: 700, ativo: true },
  { nome: 'Paulo Reis', email: 'paulo@passachave.test', perfil: 'condutor', vinculo: 'Funcionário', cnhCategoria: 'B', cnhValidade: 10, ativo: true }
]

const VEICULOS_TESTE = [
  { placa: 'FTR-2B41', modelo: 'Fiat Fiorino', ano: 2021, combustivel: 'Flex', hodometro: 48210, situacao: 'disponivel', licenciamento: 240, seguro: 140, revisaoKm: 10000, revisaoMeses: 6, ultimaRevisaoKm: 39000, ultimaRevisaoData: -120 },
  { placa: 'BRA-3C17', modelo: 'VW Gol', ano: 2018, combustivel: 'Flex', hodometro: 91533, situacao: 'disponivel', licenciamento: -5, seguro: 200, revisaoKm: 10000, revisaoMeses: 6, ultimaRevisaoKm: 85000, ultimaRevisaoData: -60 },
  { placa: 'KMB-1A88', modelo: 'VW Kombi', ano: 2013, combustivel: 'Flex', hodometro: 152004, situacao: 'disponivel', licenciamento: 180, seguro: 7, revisaoKm: 10000, revisaoMeses: 6, ultimaRevisaoKm: 145000, ultimaRevisaoData: -90 },
  { placa: 'STR-7E55', modelo: 'Fiat Strada', ano: 2022, combustivel: 'Flex', hodometro: 22418, situacao: 'disponivel', licenciamento: 300, seguro: 260, revisaoKm: 10000, revisaoMeses: 6, ultimaRevisaoKm: 20000, ultimaRevisaoData: 0 }
]

// Contas e veículos de teste. As datas ficam relativas ao dia de hoje para os alertas sempre aparecerem.
export async function criarBase() {
  const senha = await hashSenha('teste123')
  await db.usuarios.bulkAdd(USUARIOS_TESTE.map(u => ({ ...u, cnhValidade: diasAPartirDeHoje(u.cnhValidade), senhaHash: senha })))
  await db.veiculos.bulkAdd(VEICULOS_TESTE.map(v => ({
    ...v, licenciamento: diasAPartirDeHoje(v.licenciamento), seguro: diasAPartirDeHoje(v.seguro), ultimaRevisaoData: diasAPartirDeHoje(v.ultimaRevisaoData)
  })))
}

// Na primeira abertura o app já vem com dados simulados para demonstração.
export async function criarDadosIniciais() {
  if ((await db.usuarios.count()) > 0) return
  const { criarDadosSimulados } = await import('./demo.js')
  await criarBase()
  await criarDadosSimulados()
}

// tipo 'simulado' preenche meses de uso; 'zero' deixa só as contas e os veículos.
export async function restaurarDemonstracao(tipo = 'simulado') {
  await db.delete()
  await db.open()
  await criarBase()
  if (tipo === 'simulado') {
    const { criarDadosSimulados } = await import('./demo.js')
    await criarDadosSimulados()
  }
}

// Reduz a foto antes de guardar, para caber no armazenamento do navegador.
export async function salvarFoto(arquivo) {
  const url = await new Promise((ok, erro) => {
    const leitor = new FileReader()
    leitor.onload = () => ok(leitor.result)
    leitor.onerror = erro
    leitor.readAsDataURL(arquivo)
  })
  const img = await new Promise((ok, erro) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = erro
    i.src = url
  })
  const max = 1024
  const escala = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  const dados = canvas.toDataURL('image/jpeg', 0.72)
  return db.fotos.add({ dados, criadaEm: new Date().toISOString() })
}
