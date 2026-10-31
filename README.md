# PassaChave

PWA para organizações sociais registrarem a retirada e a devolução de veículos compartilhados, com lista de verificação, hodômetro, abastecimentos, ocorrências, manutenção e histórico de responsáveis, sem rastreador instalado no veículo.

Projeto da disciplina UPX V (Usina de Projetos Experimentais) da Facens, grupo EletroSet.

## Problema

Em organizações sociais, os veículos são usados por funcionários e voluntários que mudam com frequência. O controle costuma ficar em caderno, planilha ou grupo de mensagens. Quando aparece uma avaria, uma multa ou um gasto fora do comum, é difícil saber quem usou o veículo, em que estado ele saiu e quanto rodou.

## Como funciona

1. Cada chave recebe uma etiqueta com QR code. O condutor escaneia com a câmera do celular e abre a retirada daquele veículo.
2. Na retirada, informa o hodômetro, a finalidade e faz a verificação de saída, com fotos quando a organização exigir.
3. Durante o uso, registra abastecimentos e ocorrências.
4. Na devolução, informa o hodômetro final, o combustível e as condições do veículo.
5. A responsável confere os registros com as fotos, aprova ou recusa com motivo, acompanha alertas de vencimento e consulta o histórico para a prestação de contas.

## Funcionalidades

| ID | Funcionalidade | Onde está |
|---|---|---|
| RF01 | Acesso com perfil de responsável ou condutor | `src/App.jsx` (Login) |
| RF02 | Cadastro de veículos com situação, hodômetro, vencimentos e QR do chaveiro | `src/gestor.jsx` (Veiculos, FichaVeiculo) |
| RF03 | Cadastro de funcionários e voluntários, com CNH e bloqueio | `src/gestor.jsx` (Usuarios) |
| RF04 | Retirada do veículo com condutor, data, hora e hodômetro inicial | `src/condutor.jsx` (Retirada) |
| RF05 | Verificação de saída com checklist, combustível e fotos | `src/condutor.jsx` (Retirada, passo 2) |
| RF06 | Devolução com hodômetro final, combustível e condições | `src/condutor.jsx` (Devolucao) |
| RF07 | Abastecimento com litros, valor, hodômetro e comprovante | `src/condutor.jsx` (Abastecer) |
| RF08 | Ocorrências com tipo, gravidade, descrição e foto | `src/condutor.jsx` (NovaOcorrencia) |
| RF09 | Manutenção prevista e realizada por veículo | `src/gestor.jsx` (Manutencao) |
| RF10 | Histórico com filtros e exportação para planilha | `src/gestor.jsx` (Historico, FichaVeiculo) |

Complementos: fotos obrigatórias ou opcionais por configuração, aprovação dos registros pela responsável, alertas automáticos (CNH, licenciamento, seguro e revisão por km ou data), consumo médio em km/l e custos por veículo.

Fora da primeira versão: reconhecimento facial, rastreamento contínuo, integração com equipamentos do veículo e previsão de falhas.

## Testar

Versão publicada: https://nettobarreto.github.io/passachave/

Contas de teste (senha `teste123`):

| Conta | Perfil |
|---|---|
| marina@passachave.test | Responsável |
| rafael@passachave.test | Condutor |
| ana@passachave.test | Condutora |
| paulo@passachave.test | Condutor com CNH perto de vencer |

Nesta versão de teste os dados ficam guardados no navegador de quem usa (IndexedDB). Cada aparelho tem a própria cópia, e o botão "Restaurar dados de demonstração", em Configurações, volta ao estado inicial. Para usar o mesmo navegador como responsável e como condutor, basta sair e entrar com a outra conta.

## Tecnologias

- React 18 e Vite 6
- Dexie (IndexedDB) para guardar os dados e as fotos no aparelho
- PWA: manifesto e service worker para instalar no celular e abrir sem internet
- qrcode para gerar as etiquetas dos chaveiros
- GitHub Actions e GitHub Pages para publicar

## Estrutura do código

```
passachave/
├── index.html                 página base da PWA
├── public/
│   ├── manifest.webmanifest   nome, cores e ícones para instalar no celular
│   ├── sw.js                  service worker (funciona sem internet)
│   └── icone*.png/svg         ícones
├── src/
│   ├── main.jsx               inicialização e registro do service worker
│   ├── App.jsx                login, rotas e layouts (celular e computador)
│   ├── db.js                  banco local, contas de teste, configurações e fotos
│   ├── util.js                formatação, alertas automáticos e cálculo de consumo
│   ├── ui.jsx                 componentes compartilhados (foto, modal, etiquetas)
│   ├── condutor.jsx           telas do condutor: retirada, uso, abastecimento, ocorrência, devolução
│   ├── gestor.jsx             telas da responsável: painel, aprovação, veículos, usuários, manutenção, histórico
│   └── styles.css             estilos
└── .github/workflows/pages.yml  publicação automática no GitHub Pages
```

## Rodar localmente

```bash
npm install
npm run dev
```

Para gerar a versão de produção: `npm run build` (saída em `dist/`).

## Equipe

- Eduardo Henrique dos Santos
- Isabela Araujo dos Santos
- Jorge Martesi Júnior
- José Barreto Netto
- Luiz Eduardo Dionizio da Silva Camargo
- Régis de Camargo Oliveira
