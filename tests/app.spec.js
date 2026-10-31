import { test, expect } from '@playwright/test'

// Imagem PNG mínima usada no lugar da foto da câmera.
const FOTO = {
  name: 'foto.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
}

async function entrar(page, email) {
  await page.goto('/')
  await page.locator('input[name=email]').fill(email)
  await page.locator('input[name=senha]').fill('teste123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

async function sair(page) {
  await page.getByRole('button', { name: 'Sair' }).locator('visible=true').first().click()
  await expect(page.locator('input[name=email]')).toBeVisible()
}

async function anexarFoto(page, indice) {
  await page.locator('input[type=file]').nth(indice).setInputFiles(FOTO)
  await expect(page.locator('.photo').nth(indice)).toHaveClass(/done/)
}

test('fluxo completo: retirada, abastecimento, ocorrência, devolução e aprovação', async ({ page }) => {
  await entrar(page, 'rafael@passachave.test')
  await expect(page.getByRole('heading', { name: 'Para onde vamos hoje?' })).toBeVisible()

  // Retirada com foto do hodômetro e verificação de saída
  await page.getByRole('button', { name: /Fiat Fiorino/ }).click()
  await page.locator('input[name=finalidade]').fill('Entrega de cestas')
  await page.getByRole('button', { name: 'Continuar para a verificação' }).click()
  await expect(page.getByRole('alert')).toContainText('foto do hodômetro')
  await anexarFoto(page, 0)
  await page.getByRole('button', { name: 'Continuar para a verificação' }).click()
  await page.getByRole('button', { name: 'Nível 3' }).click()
  await anexarFoto(page, 0)
  await page.getByRole('button', { name: 'Confirmar saída' }).click()
  await expect(page.getByText('Você está com a chave')).toBeVisible()

  // Abastecimento
  await page.getByRole('button', { name: 'Abastecer' }).click()
  await page.locator('input[name=litros]').fill('32,5')
  await page.locator('input[name=valor]').fill('198,25')
  await page.locator('input[name=km]').fill('48274')
  await anexarFoto(page, 0)
  await page.getByRole('button', { name: 'Salvar abastecimento' }).click()
  await expect(page.getByText(/Abastecimento 32.5 L/)).toBeVisible()

  // Ocorrência
  await page.getByRole('button', { name: 'Ocorrência' }).click()
  await page.getByRole('button', { name: 'Pneu' }).click()
  await page.getByRole('button', { name: 'Média' }).click()
  await page.locator('textarea[name=descricao]').fill('Pneu dianteiro murchando')
  await anexarFoto(page, 0)
  await page.getByRole('button', { name: 'Registrar ocorrência' }).click()
  await expect(page.getByText(/Ocorrência · Pneu/)).toBeVisible()

  // Devolução: hodômetro menor que o do abastecimento é recusado
  await page.getByRole('button', { name: 'Devolver veículo' }).click()
  await page.locator('input[name=kmFinal]').fill('48250')
  await page.getByRole('button', { name: 'Finalizar devolução' }).click()
  await expect(page.getByRole('alert')).toContainText('pelo menos')
  await page.locator('input[name=kmFinal]').fill('48302')
  await expect(page.getByText(/92 km/)).toBeVisible()
  await page.getByRole('button', { name: 'Nível 4' }).click()
  await anexarFoto(page, 0)
  await anexarFoto(page, 1)
  await page.getByRole('button', { name: 'Finalizar devolução' }).click()
  await expect(page.getByRole('heading', { name: 'Meus usos' })).toBeVisible()
  await sair(page)

  // Responsável aprova o abastecimento, recusa a devolução e manda a ocorrência para manutenção
  await entrar(page, 'marina@passachave.test')
  await expect(page.getByRole('heading', { name: 'Painel da frota' })).toBeVisible()
  await page.goto('/#/aprovar')
  await expect(page.getByRole('heading', { name: 'Para aprovar · 3' })).toBeVisible()
  await page.locator('.apv', { hasText: 'Abastecimento' }).getByRole('button', { name: 'Aprovar' }).click()
  await page.locator('.apv', { hasText: 'Uso ·' }).getByRole('button', { name: 'Recusar' }).click()
  await page.getByRole('dialog').locator('textarea').fill('Foto do hodômetro ilegível')
  await page.getByRole('button', { name: 'Recusar registro' }).click()
  await page.locator('.apv', { hasText: 'Ocorrência' }).getByRole('button', { name: 'Virar manutenção' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Nada aguardando aprovação.')).toBeVisible()

  // Ficha do veículo mostra a manutenção e o QR do chaveiro
  await page.goto('/#/veiculo/1')
  await expect(page.locator('.page-acoes, .mtop').getByText('Manutenção').first()).toBeVisible()
  await expect(page.locator('.qr-panel img')).toBeVisible()
  await sair(page)

  // Condutor vê a recusa com o motivo
  await entrar(page, 'rafael@passachave.test')
  await page.goto('/#/meus-usos')
  await expect(page.getByText(/Foto do hodômetro ilegível/)).toBeVisible()
})

test('cadastros e configurações da responsável', async ({ page }) => {
  await entrar(page, 'marina@passachave.test')
  await page.goto('/#/veiculos')
  await page.getByRole('button', { name: 'Novo veículo' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByPlaceholder('ABC-1D23').fill('TST-1A23')
  await dialogo.getByPlaceholder('Fiat Strada').fill('Renault Kangoo')
  await dialogo.locator('input').nth(3).fill('10500')
  await dialogo.getByRole('button', { name: 'Salvar veículo' }).click()
  await expect(page.getByText('TST-1A23')).toBeVisible()

  await page.goto('/#/usuarios')
  await page.getByRole('button', { name: 'Novo usuário' }).click()
  const form = page.getByRole('dialog')
  await form.locator('input').nth(0).fill('Carla Dias')
  await form.locator('input[type=email]').fill('carla@passachave.test')
  await form.locator('input[type=password]').fill('senha123')
  await form.getByRole('button', { name: 'Salvar usuário' }).click()
  await expect(page.getByText('carla@passachave.test')).toBeVisible()

  await page.goto('/#/config')
  await page.getByRole('button', { name: 'fotoHodometro' }).click()
  await expect(page.getByRole('button', { name: 'fotoHodometro' })).toHaveClass(/off/)
})

const ROTAS = ['/', '/#/painel', '/#/aprovar', '/#/veiculos', '/#/veiculo/1', '/#/usuarios', '/#/manutencao', '/#/historico', '/#/config', '/#/inicio', '/#/retirar/2', '/#/meus-usos']

for (const tema of ['claro', 'escuro']) {
  test(`todas as telas cabem na tela no tema ${tema}`, async ({ page }, info) => {
    await page.addInitScript(t => localStorage.setItem('passachave:tema', t), tema)
    await page.addInitScript(() => { if (location.hash) localStorage.setItem('passachave:sessao', '1'); else localStorage.removeItem('passachave:sessao') })
    for (const rota of ROTAS) {
      await page.goto('about:blank')
      await page.goto(rota)
      await expect(page.locator(rota === '/' ? '.login' : '.shell')).toBeVisible()
      if (rota !== '/') await expect(page).toHaveURL(new RegExp(rota.replace('/#', '#').replace(/\//g, '\/') + '$'))
      await page.waitForTimeout(150)

      // Nenhuma tela pode ter rolagem horizontal (conteúdo cortado)
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(sobra, `rolagem horizontal em ${rota}`).toBeLessThanOrEqual(0)

      // O fundo precisa seguir o tema escolhido
      const fundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      const [r, g, b] = fundo.match(/\d+/g).map(Number)
      expect((r + g + b) / 3 > 128, `tema errado em ${rota}`).toBe(tema === 'claro')

      if (rota !== '/') {
        const celular = info.project.name === 'celular'
        await expect(page.locator('.sidebar')).toBeVisible({ visible: !celular })
        await expect(page.locator('.tabbar')).toBeVisible({ visible: celular })
      }
      const nome = rota === '/' ? 'login' : rota.replace('/#/', '').replace('/', '-')
      await page.screenshot({ path: `test-results/telas/${info.project.name}-${tema}-${nome}.png`, fullPage: true })
    }
  })
}

test('o tema pode ser trocado pelo botão', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('iniciado')) { localStorage.setItem('passachave:tema', 'claro'); sessionStorage.setItem('iniciado', '1') } })
  await page.goto('/')
  const botao = page.locator('[data-tema]').locator('visible=true').first()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await botao.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
