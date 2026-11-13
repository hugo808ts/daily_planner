# Plano — Menu lateral + Painel Financeiro (2026-11-09)

## Primary goal
No celular, o Hugo abre o menu ☰, toca em **Financeiro** e vê o retrato atual do seu dinheiro: patrimônio, mês, categorias, cartões, contas fixas, investimentos e últimas movimentações. O painel se atualiza sozinho segundos depois que o Agente Finanças registra algo no PC. Os valores podem ser escondidos com o olho.

Rascunhos aprovados (fonte visual, copiar classes e estrutura):
- Menu: `docs/superpowers/mockups/nav-lateral-2026-11.html`
- Painel: `docs/superpowers/mockups/financeiro-2026-11.html`

Decisões fixas:
- O painel **só lê** os dados. Quem grava continua sendo só o agente, no `financas.db` do PC.
- **Sem linha de teto mensal** no gráfico do mês, porque esse dado não existe no banco. O gráfico mostra a linha acumulada e a projeção.
- **Contas fixas:** mostram "HOJE", "AMANHÃ" ou "N DIAS" para as que ainda vão vencer no mês, e "dia N" em cinza para as que já passaram. **Não** dizer "PAGO", porque o banco não liga a conta fixa ao pagamento.
- **Ícones:** os das movimentações vêm por categoria, do `Icon.tsx` (lucide). Nunca emoji.
- **Olho:** a escolha fica no `localStorage` (conveniência de cada aparelho), dentro de try/catch.
- **Barra de abas de baixo:** sai do celular. O menu é um `<dialog>` lateral com `showModal`.
- **Ideias:** entra no menu.
- **Configurações e Ajuda:** aparecem desativadas, com "em breve".
- **Computador:** o mesmo botão ☰ no cabeçalho abre o mesmo menu. Financeiro ocupa a área da direita, no lugar de Ideias, enquanto estiver selecionado.

---

## Phase 0 — Levantamento (feito)
> **How this serves the primary goal:** garante que o plano usa só APIs e padrões que existem, sem inventar o caminho do dado PC → nuvem → tela.

### Allowed APIs / padrões (com fonte)
**App (Agenda)**
- **Navegação:** hash + estado em `src/App.tsx`.
  - `type Tab` está em :15, `TABS` em :17-20, `tabFromHash` em :22 (está fixo em 2 valores) e `useHashTab` em :25-36.
  - Barra de abas: `<nav aria-label="Seções">` em :146-171 (só no celular).
  - Layout largo: :95-131. O cabeçalho tem 52px e o grid é `380px | 1fr`.
  - `useWide` está em `src/lib/useWide.ts:15`.
- **Diálogos:** padrão `<dialog>` + `showModal()` num effect, com `onCancel` que chama preventDefault e onClose.
  - Exemplos: `src/screens/Report.tsx:28-31,87` e `MedalReveal.tsx:125`.
  - `styles.css` já tem `html:has(dialog[open]){overflow:hidden}`.
- **Barras fixas:** `--tabbar-h: 57px` e `--fixed-bars-h` em `styles.css:41-42`, zeradas em ≥1024px (:59-63).
  - Quem usa essas variáveis: `CaptureBar.tsx:119`, `IdeaList.tsx:189`, `Toast.tsx:65`, `Ideas.tsx:28`, `Today.tsx:37`, `pb-fixed-bars` e `scroll-padding-bottom`.
- **Worker:** `worker/index.ts`.
  - `Env` está em :8-16 e o `app` em Hono em :18.
  - Ordem dos middlewares: `sameOrigin` e depois `accessGuard` (:20-21).
  - Rotas montadas em :32-35.
- **Auth:** `worker/auth.ts`.
  - `accessGuard` (:19) lê `Cf-Access-Jwt-Assertion` e chama `jwtVerify(token, jwks, {issuer, audience: ACCESS_AUD, algorithms:["RS256"]})` (:29).
  - Não confere e-mail.
  - Libera em DEV só em localhost (`http.ts:11`).
  - `sameOrigin` (:43-65) não bloqueia POST de script que venha sem `Origin`.
- **Corpo da requisição:** `readBody` em `worker/http.ts:28-43`.
  - Exige `Content-Type: application/json`.
  - **Teto de 64 KiB** (`MAX_BODY_BYTES` → 413). A sincronização vai precisar de um leitor próprio com teto maior.
  - Formato de erro: `badRequest` em `http.ts:24`.
- **Rota modelo com Zod 4:** `worker/routes/ideas.ts:72-157` (`z.string({error})`, `readBody`, resposta 201). Rota GET simples: `worker/routes/report.ts:10-28`.
- **D1:** `prepare().bind().first/all/run`, `DB.batch([...])` atômico, tipos de linha em snake_case convertidos por `rowToX` (`worker/db.ts:15-50`).
  - Migrações em `migrations/NNNN_nome.sql`. A próxima é a `0003`.
- **Cliente:** `src/lib/api.ts`.
  - `ApiError` em :4-14 e `request` em :103-133 (401 recarrega a página).
  - O objeto `api` (:137-173) é onde entra o `finance`.
- **Hook modelo:** `src/lib/useWeek.ts:18-45` (data, error, ref de "atual", recarrega no `visibilitychange`).
- **UI:** a fonte única de ícones é `src/components/ui/Icon.tsx`. Para adicionar um, importa do lucide e exporta via `make()` (:58-73).
  - Botão de ícone: `IconButton({label, icon, size})` em `Button.tsx:87-112`, com alvo de 44px.
  - Classes já prontas: `.glass`, `.glass-quiet`, `.fill-neon`, `.fill-brand`, `.text-neon`, `.text-neon-danger`, `.eyebrow` (`styles.css:264-307`).
- **Testes:**
  - Worker: `vitest.config.ts`, com migrações aplicadas sozinhas por `tests/worker/apply-migrations.ts`. Helper `call` está em `tests/worker/ideas.test.ts:1-18`. Teste de JWT com jose: `tests/worker/auth.test.ts:44-60`.
  - E2E: `scripts/e2e-server.mjs` liga DEV e AI_MOCK em 127.0.0.1.
  - Seletores que dependem da barra de abas:
    - `ideas.spec.ts:23,102,188`
    - `layout.spec.ts:135,234-242,259-260,275`
    - Formato usado: `getByRole("navigation",{name:"Seções"}).getByRole("button",{name:"Ideias"|"Hoje"})`.
    - O nav "Dias da semana" é outro elemento. Não usar esse nome no menu.

**Agente Finanças** (`C:\Users\hugov\OneDrive\Desktop\CLAUDE CODE\AGENTES_IA`, repositório git público, `dados/` fica fora do git pelo `.gitignore:13`)
- `agentes/AGENTE_FINANCAS/db.py`:
  - `conectar()` (:22-28) usa `nolock` por causa do OneDrive e devolve `row_factory=Row`.
  - `DADOS` (:17) vem da env `AGENTES_DADOS_FINANCAS`, com padrão `dados/financas`.
- Valores em **centavos** (INTEGER). Datas em `YYYY-MM-DD`.
- Views em `schema.sql`:
  - `v_saldo_contas` (:125)
  - `v_limite_cartoes` (:157)
  - `v_faturas` (:176)
  - `v_posicao_invest` (:185)
  - `v_gastos_mes_categoria` (:198)
- Tabelas `contas_fixas` (:85) e `movimentacoes` (:41). Tipos de movimentação: gasto, receita, transferencia, aporte, resgate, pagamento_fatura, estorno, ajuste.
- `relatorios/exportar_dashboard.py` é o modelo de leitura:
  - Recebe as cotações por argumento, no formato `{"TICKER":[preço,"data"]}`.
  - Faz as consultas de contas (:18), investimentos (:21-25), cartões e fatura atual (:27-34) e movimentações (:36-42).
- Python: `python` e `python3` caem no stub da Microsoft Store, mas **`py` funciona (3.14)**. Usar só a biblioteca padrão.
- Regras do agente que precisam ser respeitadas:
  - Ele é o único que grava no banco (CLAUDE.md:4) e faz backup antes de gravar (:16).
  - Pede o OK do usuário antes de gravar (:51).
  - Mudar o próprio CLAUDE.md exige autorização do usuário (:73-78).
  - Hoje **não existe nenhum fluxo que mande dados para fora**. Este é o primeiro, e foi pedido pelo Hugo.
- O segredo fica em `dados/financas/sync.json` (pasta ignorada pelo git), seguindo o precedente de `dados/github/token.txt`. Nunca mostrar o conteúdo no chat.

**Cloudflare Access** (developers.cloudflare.com: service-tokens, policies, application-token, workers limits, d1 limits)
- A chave de serviço gera um Client ID e um Client Secret (o secret só aparece uma vez). A política precisa ter ação **Service Auth** e pode ficar na **mesma aplicação**, ao lado do Allow por e-mail. Service Auth é avaliada primeiro.
- O cliente envia `CF-Access-Client-Id` e `CF-Access-Client-Secret`.
- O Worker recebe o `Cf-Access-Jwt-Assertion`. **A documentação só deixa implícito que esse cabeçalho chega nas requisições de serviço; testar e registrar a carga do JWT na primeira vez.**
- Conteúdo do JWT de serviço: `common_name` = Client ID, `sub` = "" e sem `email`. **`type` não identifica chave de serviço.**
- No workers.dev, o Browser Integrity Check bloqueia clientes sem User-Agent (erro 1010). O script precisa mandar um User-Agent próprio.
- Limites do plano grátis:
  - Workers: 10 ms de CPU por requisição.
  - D1: 100 parâmetros por consulta, linha de até 2 MB, 100 mil linhas gravadas por dia, e `batch` conta como 1 consulta.

### Anti-padrões (não fazer)
- Não usar `payload.type` para detectar a chave de serviço. Não inventar claims como `service_token_id`, que não vão no JWT.
- Não ativar o "strict service token authentication" da organização, porque ele quebra o login pelo navegador.
- Não reaproveitar `readBody` (teto de 64 KiB) na rota de sincronização.
- Não gravar uma linha por movimentação a cada sincronização, porque gasta a cota diária de gravações. Gravar o retrato inteiro numa linha só.
- Não importar ícones direto de `lucide-react`. Não usar emoji.
- Não chamar `python` nem `python3` no Windows. Usar `py`.
- Não escrever o Client Secret em nenhum arquivo rastreado pelo git nem no chat.

---

## Phase 1 — Dados e API no Worker (pode rodar em paralelo com a Phase 3)
> **How this serves the primary goal:** cria o lugar na nuvem que guarda o retrato vindo do PC e a API que o painel do celular lê.

**O que implementar**
1. `migrations/0003_finance.sql`: tabela `finance_snapshot (id INTEGER PRIMARY KEY CHECK (id = 1), generated_at TEXT NOT NULL, received_at TEXT NOT NULL, data TEXT NOT NULL)`. Uma linha só, substituída a cada envio com `INSERT ... ON CONFLICT(id) DO UPDATE`.
2. `shared/finance.ts` (puro, testável):
   - **Tipos e schema Zod `FinanceSnapshot`.** Valores em centavos (inteiros) e datas ISO.
     - `generatedAt`
     - `contas[] {nome, instituicao, tipo, saldo}`: exclui as do tipo `corretora`, como em `exportar_dashboard.py:18`.
     - `cartoes[] {nome, limite, usado, disponivel, meta|null, faturaAtual, faturaMes|null, fechamento, vencimento}`
     - `contasFixas[] {descricao, valor, dia, forma, ativa}`
     - `investimentos[] {codigo, classe, onde, quantidade, custo, rendimentos, cotacao|null, dataCotacao|null}`
     - `movimentacoes[] {id, data, descricao, valor, tipo, categoria, onde, parcelaNum|null, parcelaTotal|null}`: só os **últimos 13 meses**.
   - **Funções de cálculo, a partir do retrato + o mês pedido + a data de hoje:**
     - `patrimonio`: contas + investimentos. Investimento usa cotação × quantidade quando há cotação, senão o custo.
     - `resumoMes`: entrou (receitas), saiu (gastos), sobra, e a série acumulada de gastos por dia com projeção linear até o fim do mês.
     - `categoriasMes`: total por categoria, porcentagem, e variação em relação ao mês anterior.
     - `cartoesView`, `contasFixasView`: status relativo a hoje, "HOJE", "AMANHÃ", "N DIAS" ou "passou".
     - `alocacaoInvest`: participação por classe.
     - `ultimasMov(n)`
     - `mesesDisponiveis`
3. Rotas novas em `worker/routes/finance.ts`, seguindo o modelo de `report.ts` e `ideas.ts`, montadas em `worker/index.ts` depois da linha 35:
   - `POST /api/finance/sync`
     - Leitor próprio com teto de 2 MB que exige JSON.
     - Valida o corpo com o schema `FinanceSnapshot`. Se falhar, responde 400 com `fields`.
     - Faz o upsert do retrato e responde `{ok:true, generatedAt, receivedAt}`.
   - `GET /api/finance?month=YYYY-MM`
     - Usa o mês atual quando o parâmetro não vem. Se o formato for inválido, responde 400.
     - Responde `{empty:true}` quando ainda não houve sincronização.
     - Se houver, responde com tudo já calculado e `generatedAt`.
4. **Auth (`worker/auth.ts`):**
   - Depois do `jwtVerify`, decidir se o JWT é de serviço: `typeof payload.email !== "string" && payload.sub === "" && typeof payload.common_name === "string"`.
     - **Serviço:** só aceitar se `common_name === env.SYNC_CLIENT_ID` **e** a requisição for `POST /api/finance/sync`. Caso contrário, 403.
     - **Usuário:** continua como hoje. Na rota de sync, o usuário recebe 403, porque o único que grava é o agente.
   - Em DEV no localhost, a rota de sync aceita sem JWT, como o resto (necessário para os testes).
   - Adicionar `SYNC_CLIENT_ID?: string` ao `Env` (`worker/index.ts:8-16`).
5. **Testes:**
   - `tests/unit/finance.test.ts`: cada função de cálculo, incluindo mês sem dados, virada de mês e mês anterior inexistente.
   - `tests/worker/finance.test.ts`:
     - sync válido seguido de GET;
     - 400 com campos;
     - 413 acima de 2 MB;
     - GET vazio.
   - Em `tests/worker/auth.test.ts`, copiar o padrão de :44-60 com JWTs de serviço:
     - common_name certo na rota certa: 200;
     - na rota errada: 403;
     - common_name errado: 403;
     - JWT de usuário no sync: 403.

**Verificação:** `npx.cmd vitest run --maxWorkers=2` e `npm.cmd run typecheck` passando. Um `grep -n "readBody" worker/routes/finance.ts` não pode encontrar nada.

---

## Phase 2 — Script de sincronização no PC (depois da Phase 1)
> **How this serves the primary goal:** é a ponte que leva os dados do `financas.db` para a nuvem logo depois de cada registro.

**O que implementar** (no repositório AGENTES_IA, usando só a biblioteca padrão)
1. `agentes/AGENTE_FINANCAS/relatorios/sincronizar_app.py`. Copiar a leitura de `exportar_dashboard.py:12-42` e manter os valores em centavos.
   - Lê via `db.conectar()` e monta o `FinanceSnapshot` da Phase 1. As movimentações ficam limitadas aos últimos 13 meses, com `data >= date('now','-13 months')`.
   - **Cotações:** recebe por argumento opcional, no mesmo formato do exportador. Mescla com o cache em `dados/financas/cotacoes.json` e grava o cache de volta. Assim, um envio sem argumento reaproveita a última cotação pesquisada.
   - **Configuração:** lê `dados/financas/sync.json` = `{url, client_id, client_secret}`. Faz POST com `urllib.request`, os cabeçalhos `CF-Access-Client-Id` e `CF-Access-Client-Secret`, `Content-Type: application/json` e `User-Agent: agenda-sync/1.0`. O timeout é de 20 s.
   - **Saída:** uma linha `ok <generatedAt>`, ou `erro <status> <mensagem>`. Nunca imprime o segredo.
   - Se o `sync.json` não existir, sai com o código 0 e a mensagem "sincronização não configurada". O agente não pode quebrar por causa disso.
2. `dados_exemplo/financas/sync.exemplo.json` (rastreado), com placeholders `<URL>`, `<CLIENT_ID>` e `<CLIENT_SECRET>`.
3. **Teste local:**
   - Subir `node scripts/e2e-server.mjs 5331` no projeto Agenda (DEV ligado em 127.0.0.1).
   - Apontar um `sync.json` temporário para `http://127.0.0.1:5331/api/finance/sync`, rodar `py ...\sincronizar_app.py` e fazer GET em `/api/finance`.
   - Para não mexer nos dados reais, usar uma cópia do banco via `AGENTES_DADOS_FINANCAS`, com um backup copiado para a pasta de rascunho.

**Verificação:** o script devolve `ok`, o GET traz patrimônio e categorias que batem com uma consulta direta ao banco de teste, e `git -C AGENTES_IA check-ignore dados/financas/sync.json` confirma que o arquivo está ignorado.

**Anti-padrões:** não escrever no banco, não copiar o `.db` enquanto ele está aberto (ler sempre por `conectar()`), não usar `requests`.

---

## Phase 3 — Menu lateral (pode rodar em paralelo com a Phase 1)
> **How this serves the primary goal:** é o caminho até o Financeiro e substitui a barra de abas, como foi aprovado.

**O que implementar** (copiar estrutura e CSS de `nav-lateral-2026-11.html`)
1. `src/components/NavDrawer.tsx`: `<dialog>` lateral à esquerda, com o padrão `showModal` de `Report.tsx:28-31`.
   - `aria-label="Menu"`.
   - Cabeçalho com marca e botão de fechar.
   - Cartão com o brasão, o nível e o XP (`Medal` + `useProgress`).
   - Grupos com `.eyebrow`:
     - "Rotina": Tarefas do dia (com "N/M"), Quadro da semana (abre o `Report` da semana atual), Ideias.
     - "Painéis": Financeiro, com o selo NOVO até a primeira visita, guardado no localStorage.
   - Rodapé: Configurações e Ajuda desativados ("em breve") e a linha de sincronização, vinda do `generatedAt` do GET `/api/finance`.
   - Item ativo com `aria-current="page"`.
   - Fecha ao escolher um item, com Esc ou ao tocar fora.
   - Animação de entrada pela esquerda, desligada com reduced-motion.
2. **`App.tsx`:**
   - `Tab` passa a ter `"finance"` e o hash `#financeiro`. `tabFromHash` passa a usar um mapa, sem valores fixos no código.
   - Remover o `<nav aria-label="Seções">` do celular.
   - Botão ☰ (`IconButton label="Abrir menu"`) no topo das telas Hoje, Ideias e Financeiro no celular, e no cabeçalho do computador.
   - No computador, Financeiro substitui `<Ideas wide>` na área da direita.
   - A `CaptureBar` aparece só em Hoje e Ideias.
3. **CSS:** `--tabbar-h: 0px` também no celular. Conferir quem usa a variável (lista da Phase 0) e o espaçamento final da captura e do Toast.
4. **Ícones:** adicionar `MenuIcon`, `WalletIcon`, `SettingsIcon`, `HelpIcon` e `ShieldIcon` ao `Icon.tsx`, mais os ícones das categorias usados na Phase 4.
5. **Testes:**
   - Trocar os seletores listados na Phase 0 por um helper `openSection(page, "Ideias")`: abre o menu (`button "Abrir menu"`) e clica no item dentro de `dialog "Menu"`.
   - `layout.spec.ts:234-242` passa a testar o menu: abre, troca de tela e fecha.
   - Em `:135`, o computador continua sem barra de abas, e o ☰ fica visível.

**Verificação:** `npm.cmd run e2e` passando, sem rolagem horizontal em 375px, e com o foco voltando ao ☰ quando o menu fecha.

---

## Phase 4 — Tela do Financeiro (depois das Phases 1 e 3)
> **How this serves the primary goal:** é o painel que o Hugo vê.

**O que implementar** (copiar estrutura e CSS de `financeiro-2026-11.html`)
1. **Dados:**
   - Em `src/lib/api.ts`, adicionar o tipo `FinanceView` (vindo de `shared/finance.ts`) e `api.finance(month?)`.
   - Criar `src/lib/useFinance.ts`, copiado de `useWeek.ts:18-45` com o parâmetro de mês.
2. **`src/screens/Finance.tsx`, com estas seções na ordem do rascunho:**
   - **Topo:** ☰, a eyebrow "Financeiro" e o olho (`aria-pressed`, rótulo "Esconder valores" / "Mostrar valores").
   - **Chips de mês:** `mesesDisponiveis`.
   - **Patrimônio:** total, "em contas" e "investido".
   - **Mês:** entrou, saiu e sobra. Gráfico SVG acumulado com projeção, **sem teto**, e eixo com "1", "hoje" e o último dia.
   - **Gastos por categoria:** rosca em conic-gradient, com as cores da paleta em ordem fixa e "Outros" a partir da sétima categoria, mais a variação em relação ao mês anterior.
   - **Cartões:** um cartão por item, com fatura, fechamento, vencimento e barra. Quando há meta, a barra vai até a meta e mostra o marcador; quando não há, mostra o limite usado.
   - **Contas fixas:** com as etiquetas da decisão fixa.
   - **Investimentos:** total, barra de alocação, legenda e lista. Sem cotação, mostra "custo" no lugar.
   - **Últimas 10 movimentações:** ícone por categoria, valor com sinal e parcela "n/N".
   - **Rodapé:** "Sincronizado pelo Agente Finanças <quando>".
3. **Estados:**
   - Carregando: esqueleto.
   - Erro: mensagem com o botão "Tentar de novo".
   - **Vazio** (`{empty:true}`): cartão explicando "Peça ao Agente Finanças para sincronizar".
   - Olho fechado: todos os valores viram "R$ ••••". As porcentagens e o gráfico continuam aparecendo.
4. **Formatação:** `Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})` a partir dos centavos, num helper em `src/lib/format.ts`.
5. **Testes e2e** (`tests/e2e/finance.spec.ts`):
   - Fazer POST de um retrato de exemplo em `/api/finance/sync` (DEV) e abrir pelo menu.
   - Conferir o patrimônio, a categoria principal, a etiqueta de conta fixa (usando a data fixa via `X-Test-Today`, `http.ts:14-18`) e o olho.
   - Conferir também o estado vazio.

**Verificação:** e2e e unitários passando, mais prints em 390×844 e 1440×900 comparados com o rascunho.

---

## Phase 5 — Ligar na Cloudflare (o Hugo faz no painel; eu guio)
> **How this serves the primary goal:** deixa só o agente do PC gravar no painel de produção.

1. **Hugo:** em Zero Trust → Access controls → Service credentials → Service Tokens → Create, criar "agenda-sync" com duração de 1 ano.
   - Guardar o Client ID e o Client Secret direto em `dados/financas/sync.json`, a partir do `sync.exemplo.json`, com `url` = `https://agenda.hugo-agenda.workers.dev/api/finance/sync`.
   - **Não colar o secret no chat.**
2. **Hugo:** na aplicação Access da Agenda, adicionar a política **Service Auth**, com Include = Service Token "agenda-sync". A política Allow por e-mail continua.
3. **Eu:** `wrangler secret put SYNC_CLIENT_ID` (o Client ID não é segredo forte, mas fica fora do código). Depois `wrangler d1 migrations apply agenda --remote` (depois de um backup com `wrangler d1 export`), `npm run deploy`, e uma primeira execução do `py sincronizar_app.py`.
   - Na primeira vez, registrar no log do Worker a carga do JWT de serviço, só as chaves, para confirmar `common_name`. Remover o log em seguida.

**Verificação:**
- O script devolve `ok`.
- O celular mostra o painel com os dados reais.
- Uma chamada sem cabeçalhos é barrada pelo Access, e um `curl` com a chave na rota GET `/api/finance` recebe 403.

---

## Phase 6 — Agente sincroniza sozinho (depois da Phase 5)
> **How this serves the primary goal:** faz o painel "atualizar junto" sem o Hugo pedir.

1. **Mostrar ao Hugo e só aplicar com o OK dele** (regra do agente, `CLAUDE.md:73-78`): uma regra nova em `agentes/AGENTE_FINANCAS/CLAUDE.md` e um espelho em `.claude/agents/financas.md`.
   - Texto da regra: "Depois de qualquer gravação confirmada, e também depois de pesquisar cotações, rodar `py agentes/AGENTE_FINANCAS/relatorios/sincronizar_app.py` (com as cotações, se acabou de pesquisar). Se der erro, avisar em uma linha e seguir."
   - Corrigir também `python3` para `py` na linha 62.
2. **Commit no repositório AGENTES_IA** (script, exemplo e regra), em português.
   - Antes, varredura de segredos e conferência de que `dados/` não entrou. O push só acontece com o OK do Hugo.

**Verificação:** pedir ao agente "gastei 10 no café" → confirmar → o celular mostra a movimentação em menos de 1 min.

---

## Phase 7 — Verificação final
> **How this serves the primary goal:** prova, de ponta a ponta, que o painel é fiel ao banco e que ninguém além do agente grava nele.

- `npm.cmd run typecheck`, `npx.cmd vitest run --maxWorkers=2`, `npm.cmd run build` e `npm.cmd run e2e`.
- `grep` por `from "lucide-react"` fora de `Icon.tsx` → nada. `grep` por emoji em `src/screens/Finance.tsx` → nada. `grep` por `readBody` em `finance.ts` → nada.
- Conferência numérica: o patrimônio e o total de gastos do mês no app batem com uma consulta direta às views no `financas.db`.
- Segurança:
  - O sync sem chave é barrado.
  - A chave fora da rota de sync recebe 403.
  - Um usuário fazendo POST no sync recebe 403.
- Prints do celular e do computador. README: uma linha citando o Financeiro e a captura nova.
- Commit e push do app no daily_planner, só com o OK do Hugo.

## Fora deste plano
Teto mensal de gastos · gravar gastos pelo app · painel da Faculdade · Configurações e Ajuda de verdade · cotação automática no servidor · grade de medalhas das semanas.
