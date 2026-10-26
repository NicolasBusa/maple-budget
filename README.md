# Maple

Aplicativo pessoal de orçamento para o intercâmbio em Toronto, otimizado para iPhone 14 (390 × 844 CSS px). PWA em português, com autenticação e sincronização no Supabase.

## Plano inicial

- Viagem: 7/12/2026 a 7/3/2027. A data de retorno é o limite exclusivo; gastos até 6/3.
- Orçamento: CAD 6.328,00. Hospedagem, curso, passagem e seguro já pagos.
- Limites mensais editáveis: alimentação 650, academia 80, passeios 250, transporte 180, celular/internet 60, compras 250, imprevistos 130.
- Total mensal: CAD 1.600; total dos três meses: CAD 4.800; sobra planejada: CAD 1.528.
- Esses valores são propostas de alocação, não preços pesquisados ou garantidos.

## Funcionalidades

Categorias personalizadas e limites independentes para cada mês; registro, edição e exclusão de gastos; gráficos por categoria e evolução acumulada; simulação de economia; cotação CAD/BRL automática e manual; HST opcional de 13%, gorjeta sobre preço antes do imposto e custo cambial informado; OCR de notas com sugestão de total, data e categoria e conferência antes de salvar; recorrências mensais com registro manual de pagamento; CSV e backup JSON; cache offline e sincronização com proteção de conflitos.

A leitura de nota registra o total da compra em uma categoria. Não divide automaticamente cada item de uma nota mista. A precisão depende da foto. Fotos não são enviadas ao Supabase ou a uma API de IA.

## Arquitetura e custo

React + Vite, hospedagem estática na Vercel Hobby, Supabase Free para autenticação e Postgres, Tesseract.js no navegador, Frankfurter para câmbio. Nenhuma chave privada de serviço fica no frontend. A chave publishable em src/config.js identifica o projeto; RLS restringe cada conta aos próprios dados.

A aplicação não depende de API paga de IA. Grok tem preços de API por uso; Gemini tem cotas gratuitas e condições específicas de uso dos dados. Tesseract foi escolhido para evitar cobrança por foto e transmissão da nota a um provedor de IA. Categorias são sugeridas por palavras reconhecidas, não por um modelo de linguagem.

O uso gratuito depende das cotas e políticas dos provedores. Supabase Free pode pausar projetos após uma semana sem atividade; antes da viagem, verifique que o projeto está ativo. Backup JSON é complementar: sincronização de registros não equivale a backup histórico automático de banco.

### Dados e projeções

Valores CAD são inteiros em centavos. Datas são strings ISO sem conversão por fuso; o dia atual usa America/Toronto. Três períodos mensais são ancorados à chegada, inclusive no fim de mês e em ano bissexto.

Economia por limites = orçamento − gastos registrados − soma do saldo não negativo de cada categoria nos períodos ainda não encerrados. Estouro de uma categoria não apaga o limite das demais. Economia por ritmo = orçamento − média diária dos dias completos × duração da viagem; é uma estimativa sensível a gastos pontuais e registros ausentes. Gastos datados no futuro já comprometem o saldo, mas só entram na curva acumulada quando a data chega.

A sincronização usa uma linha JSONB por usuário, controle de versão e uma função SQL com SECURITY INVOKER. Uma alteração antiga não sobrescreve silenciosamente dados mais novos de outro aparelho. Em conflito, exporte a cópia local e carregue a nuvem para reconciliar. Registros offline ficam no armazenamento deste navegador até a sincronização.

## Desenvolvimento

Requisitos: Node.js 22.12+ ou 24 e npm.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

O build copia os workers e os runtimes WASM do Tesseract instalados para public/ocr (ignorado no Git), gera os arquivos estáticos e cria o service worker versionado. O modelo de idioma inglês é baixado no primeiro uso e cacheado pelo Tesseract.

Configuração do Supabase: src/config.js contém apenas URL e chave pública. Em um novo projeto, aplique database/schema.sql uma vez. A política de acesso deve continuar habilitada. Nunca coloque service_role no código frontend.

Em Authentication → URL Configuration, configure Site URL e Redirect URLs com a URL de produção. O envio de confirmação/recuperação depende das configurações de e-mail do Supabase. O provedor padrão restringe destinatários; para outros usuários, configure SMTP. Não desabilite validações silenciosamente.

## Testes

- npm test: calendário, dinheiro, projeção e interpretação de recibos.
- tests/browser.mjs: fluxo real com conta QA, persistência, offline, categoria, câmbio, OCR e WebKit. Use uma conta de teste dedicada; o teste cria registros. Informe MAPLE_QA_EMAIL e MAPLE_QA_PASSWORD (ou o arquivo local de QA fora do repositório durante desenvolvimento). Instale os navegadores Playwright antes.
- A segurança foi verificada com duas contas temporárias: leitura/gravação própria, bloqueio anônimo, isolamento entre contas, rejeição de troca de proprietário e conflito de versão.
- WebKit emulado não substitui teste da câmera física no seu iPhone. Fotos reais devem ser conferidas.

## Fontes consultadas em 26/10/2026

- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Supabase Free](https://supabase.com/pricing)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [xAI: preços](https://docs.x.ai/developers/pricing)
- [Gemini: preços e uso de dados](https://ai.google.dev/gemini-api/docs/pricing)
- [Frankfurter](https://frankfurter.dev/)
- [CRA: GST/HST e alimentos básicos](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html)

## Instalar no iPhone

Abra a URL de produção no Safari → Compartilhar → Adicionar à Tela de Início. Crie sua conta e revise os limites. Use Ajustes para exportar um backup adicional periodicamente.
