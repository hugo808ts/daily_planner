# Plano — aba Treino (Agenda)

Branch: `feat/aba-treino`. Rascunhos aprovados:
- `docs/superpowers/mockups/treino-2026-11.html`: semana, montar semana, brasão e conquistas.
- `docs/superpowers/mockups/treino-sessao-2026-11.html`: treino ao vivo, descanso, resumo e relatório.

## Primary goal
No celular, Hugo toca em **Treino** na barra de baixo, monta a semana com os treinos A/B/C, e na academia toca **Começar treino**.

O app mostra o exercício da vez com o peso e as repetições da última vez já preenchidos. Cada série fica salva na hora, e o descanso conta sozinho com o tempo que ele ajusta.

No fim do treino, e no relatório semanal, ele vê se a carga subiu em relação à semana passada. A gamificação ajuda a manter o hábito: XP, recordes, brasão da semana, sequência de semanas e conquistas.

## Decisões fixas (não rediscutir)
- **Usuário único.** Sem coluna de usuário; o Cloudflare Access só protege a entrada (`worker/auth.ts`).
- **Peso.** Guardado como inteiro em gramas (`weight_g`), assim 82,5 kg = 82500. O passo do ajuste é 2500. A tela mostra "82,5 kg", e o volume aparece em toneladas com 1 casa ("19,6t").
- **Histórico por exercício.** A chave é o nome normalizado (`exercise_key`: minúsculo, sem acento, espaços colapsados). Renomear o treino ou mudar o exercício de treino não quebra o histórico. Sets e sessões guardam também o nome em texto (snapshot).
- **Semana fixa.** É um modelo fixo: cada dia da semana (1=seg … 7=dom) aponta para um treino ou para folga, e se repete toda semana. A meta semanal vai de 3 a 6 dias.
- **XP calculado, nunca gravado** (mesmo padrão de `worker/xp.ts`):
  - série concluída: +5
  - treino concluído: +50
  - recorde pessoal: +30, uma vez por exercício por sessão
  - O XP do treino **soma no nível geral** (ProgressPill). O brasão semanal das tarefas continua só com XP de tarefas; o treino tem **brasão próprio**.
- **Recorde pessoal (PR).** Uma série é recorde quando o peso dela é maior que o maior peso daquele `exercise_key` em sessões anteriores. Exige reps ≥ 1 e que exista histórico anterior: a primeira vez não conta como recorde.
- **Brasão de treino da semana.** Usa as faixas de `shared/xp.ts` (`MedalTier`) pela fração de treinos concluídos sobre a meta:

  | Treinos concluídos / meta | Brasão |
  |---|---|
  | ≥ 1 treino | bronze |
  | ≥ 50% | prata |
  | ≥ 75% | ouro |
  | ≥ 100% | diamante |
  | 100% e ≥ 3 recordes na semana | supremo |

  Conta 1 treino por dia, só treinos concluídos.
- **Sequência.** Conta as semanas seguidas com a meta cumprida. A semana atual entra só quando já cumprida, e não zera a sequência antes de acabar.
- **Conquistas.** Lista fixa no código, calculada a partir dos dados, sem tabela:

  | Conquista | Condição |
  |---|---|
  | Constante | 4 semanas seguidas |
  | Inquebrável | 12 semanas seguidas |
  | Recordista | 1º recorde |
  | Tonelada | 10 t de volume num dia |
  | Semana perfeita | todos os dias planejados feitos no próprio dia |
  | Madrugador | treino iniciado antes das 7h |
- **Treino ao vivo salvo no servidor série a série.** Fechar o app não perde nada, e ao reabrir aparece "Continuar treino". Só pode haver 1 sessão aberta por vez.
- **Pré-preenchimento.** Peso e reps vêm da última sessão daquele exercício, na mesma série (S1 com S1). Se a série não existir, vêm do alvo do treino.
  - "Meta hoje ↑ +2,5 kg" aparece quando na última vez todas as séries bateram as reps alvo.
- **Cronômetro de descanso.**
  - Só no aparelho. Guarda a hora de término (`endsAt`), e não um contador, então não se perde se a tela dormir ou a aba for para segundo plano.
  - Ajuste de ±15 s, presets 0:45/1:00/1:30/2:00/3:00, e opção "usar sempre neste exercício", que salva `rest_s` no exercício.
  - No fim: `navigator.vibrate` (só Android; no iPhone o Safari não vibra, e isso é aceito) e um bipe curto via WebAudio.
  - Durante o treino, pede `navigator.wakeLock` quando o aparelho suportar.
- **Navegação no celular.** A barra de baixo volta com **Hoje · Ideias · Treino**, e o ☰ continua para o resto. O menu lateral ganha "Treino" em Rotina.
  - Durante o treino ao vivo, a tela ocupa tudo: sem barra de baixo e sem captura.
  - No computador, o Treino abre na coluna da direita, como o Financeiro.
- **Trabalho pausado do Financeiro.** O menu e o Worker do Financeiro já estão prontos e sem commit neste branch. Ficam como estão. A tela Financeiro (placeholder) continua só no ☰. Terminar o Financeiro é outro plano (`2026-11-09-menu-e-financeiro.md`, Fase 4+).

## Phase 0 — Descoberta (feita em 2026-11-13)
> **How this serves the primary goal:** cada fase copia padrões que já existem no código, assim o Treino nasce igual ao resto do app e com menos risco.

### Allowed APIs e padrões (com fonte)

**Migrações**
- Próxima: `migrations/0004_treino.sql`.
- Convenções, de `0001_init.sql`:
  - `id TEXT PRIMARY KEY` com `crypto.randomUUID()`
  - `created_at` e `updated_at` como ISO
  - dia como `date TEXT` YYYY-MM-DD
  - booleanos como `INTEGER 0/1`
  - FK `ON DELETE CASCADE` (0001:28)
  - índices `idx_<tabela>_<col>`
  - comentários SQL em português
- Linha única: `CHECK (id = 1)` (`0003_finance.sql`).
- Os testes aplicam as migrações sozinhos: `vitest.config.ts:5,11` com `tests/worker/apply-migrations.ts:1-3`.
- O e2e recria o D1 local: `scripts/e2e-server.mjs:9-16`.

**Rotas**
- Arquivo `new Hono<{ Bindings: Env }>()` com caminho `/api/...` completo, montado em `worker/index.ts:35-39`.
- `Env` em `worker/index.ts:9-19`.
- Corpo da requisição:
  - `readBody(c, schema)` em `worker/http.ts:28-48`, usado como `if (!body.ok) return body.res`.
  - `badRequest` em `http.ts:24-26`.
- Erros: `{error:"..."}` em pt-BR, 404 no formato `c.json({ error: "… não encontrado." }, 404)`.
- Data de hoje: `serverToday(c)` (`http.ts:14-18`), que respeita `X-Test-Today` em DEV.
- Modelo de CRUD a copiar: `worker/routes/tasks.ts:14-100` (Zod 4 com `{ error }`, `.nullish()` no create, `.nullable().optional()` no patch).
- Respostas embrulhadas: `{ task }` com 201, `{ folders: [...] }`.
- Mapper de linha (snake→camel): `worker/db.ts:16-29`.

**Regras puras em `shared/`**
- Modelo: `shared/finance.ts`. Schema Zod e tipo com o mesmo nome (45-111), constantes `as const` (31-44), funções de view que recebem `today`.
- XP e brasões: `shared/xp.ts`.
  - `MedalTier` (15), `MEDALS` (18-24), `medalFor` (27)
  - `levelFromXp` (45-55)
- Somas de XP: `worker/xp.ts:4-34`.
  - `xpByWeek` e `totalXp`; a semana é calculada por `date(date,'-6 days','weekday 1')`.
- `/api/progress`: `worker/routes/report.ts:45-53`.
- Datas: `shared/dates.ts` (`todayISO`, `addDays`, `weekStart` segunda 39-42, `weekDays`, `weekdayShort`, `isRealDate`).

**Testes**
- Worker: `tests/worker/tasks.test.ts:1-27`.
  - `SELF.fetch("http://localhost"+path, …)`
  - `beforeEach` limpa as tabelas com `env.DB.batch`
  - host de produção dá 401: `tasks.test.ts:217-235`
- Unidade: `tests/unit/xp.test.ts`.
- Scripts: `npm.cmd test` (vitest `--maxWorkers=2`), `npm.cmd run typecheck`, `npm.cmd run e2e`.

**Front**
- Barra de baixo antiga:
  - marcação em `git show HEAD:src/App.tsx` L146-171
  - `TABS` em L17-20
  - CSS em `git show HEAD:src/styles.css` L41-42 (`--tabbar-h: 57px`, `--fixed-bars-h`) e L58-63 (zera no desktop)
- Hoje: `src/styles.css:42` tem `--tabbar-h: 0px`. Quem consome a variável: CaptureBar.tsx:119, IdeaList.tsx:189, Toast.tsx:65, Ideas.tsx:30, Today.tsx:39, styles.css:114 e 209.
- `src/App.tsx`:
  - `Tab` em L19, `HASH` em L22, `useHashTab` em L28-41
  - `menuButton` em L144-154, NavDrawer em L156-166
  - desktop L183-218 (coluna direita em L210), celular L221-241 (CaptureBar em L234)
- `src/components/NavDrawer.tsx`:
  - `Section` em L18, props em L20-33
  - lista "Rotina" em L146-161, item a clonar em L167-169
- Tela modelo: `src/screens/Finance.tsx` (prop `menu`). Hook modelo: `src/lib/useFinance.ts:10-39`.
- API: `src/lib/api.ts`, `request<T>` em L104-134 e `api` em L138.
- Componentes:
  - `Button` e `IconButton` em `src/components/ui/Button.tsx:87`
  - `Medal({tier,size,glow,ribbon})` em `src/components/game/Medal.tsx:180`, com `MEDAL_LABEL` e `MEDAL_GLOW`
  - `ProgressPill`
- Ícones: só via `src/components/ui/Icon.tsx` (lucide). **Não existe Dumbbell nem Timer**; adicionar `DumbbellIcon`, `TimerIcon` e `FlameIcon` (lucide `Dumbbell`, `Timer`, `Flame`).
- Utilitários CSS: `.glass` 361, `.glass-quiet` 371, `.fill-neon` 379, `.text-neon` 389, `.eyebrow` 393, `.sheet-dialog` 229-263.
- Formatação: `src/lib/format.ts` só tem dinheiro (`money` em 110-116) e `plural` (37). **Não há formatador de kg**: criar.
- Timers existentes: `setInterval` em `useNow.ts:8` e `Recorder.tsx:212`; AudioContext em `Recorder.tsx:40,117`. **Não há** vibrate, wakeLock nem contagem regressiva.
- E2E:
  - `tests/e2e/nav.ts` `openSection(...)` (união de nomes)
  - `playwright.config.ts`: celular 390×844; desktop roda só `layout.spec`
  - `layout.spec.ts` L247-279 (teste do menu) e L323 (375 px sem rolagem lateral)
- Typecheck passa hoje (2026-11-13).

### Anti-padrões
- Não usar `zValidator`, porque o projeto valida com `readBody`.
- Não gravar XP, brasão ou conquistas em tabela.
- Não importar `lucide-react` fora do `Icon.tsx`.
- Não usar emoji como ícone.
- Não usar número de ponto flutuante para peso.
- Não contar o descanso com `setInterval` decrementando; usar `endsAt - Date.now()`.
- Não usar notificações push: fora do escopo.

---

## Phase 1 — Banco e regras puras
> **How this serves the primary goal:** guardar treinos, séries e cargas é o que permite pré-preencher o peso, detectar recordes e comparar semanas.

**Implementar**

1. `migrations/0004_treino.sql`, copiando as convenções de `0001_init.sql`:

   | Tabela | Colunas |
   |---|---|
   | `workout_templates` | `id`, `name` ("Treino C"), `focus` ("Perna"), `position INT`, `created_at`, `updated_at` |
   | `workout_exercises` | `id`, `template_id` FK CASCADE, `name`, `exercise_key`, `position`, `sets INT`, `reps INT`, `weight_g INT`, `rest_s INT DEFAULT 90`, timestamps |
   | `workout_plan` | `weekday INTEGER PRIMARY KEY CHECK(weekday BETWEEN 1 AND 7)`, `template_id` (NULL = folga; FK `ON DELETE SET NULL`) |
   | `workout_settings` | `id CHECK(id=1)`, `weekly_goal INT DEFAULT 4 CHECK(3..6)`, `default_rest_s INT DEFAULT 90`, `sound INT DEFAULT 1` |
   | `workout_sessions` | `id`, `date`, `template_id` (SET NULL), `template_name`, `started_at`, `finished_at` NULL |
   | `workout_sets` | `id`, `session_id` FK CASCADE, `exercise_key`, `exercise_name`, `exercise_position`, `set_index`, `weight_g`, `reps`, `done_at` |

   Índices: `idx_workout_sets_key` em `(exercise_key, done_at)` e `idx_workout_sessions_date`.

2. `shared/workout.ts`, no modelo de `shared/finance.ts`. Schemas Zod de entrada (template, exercício, plano, configurações, série) e funções puras testáveis:
   - `exerciseKey(name)`
   - `formatKg(weight_g)` / `formatTonnes(g)`
   - `setXp`, `sessionXp(session, prs)`
   - `isPersonalRecord(weight_g, previousMax)`
   - `prefill(lastSets, exercise, setIndex)`, que devolve `{weight_g, reps, suggestUp}`
   - `workoutMedal(done, goal, prs)`, que devolve `MedalTier | null`
   - `streakWeeks(weeks, todayWeek)`
   - `achievements(data)`, que devolve uma lista `{id, label, hint, unlocked}`
   - `buildWeekReport(rows, week)`, que devolve:
     - por exercício: carga máx desta semana e da anterior, `delta`, série de 6 semanas, `stagnantWeeks`
     - volume total e variação %
     - "N de M subiram"
     - dica para o exercício parado há ≥ 3 semanas
   - `buildSessionSummary(sets, previousSessionSets)`
3. `tests/unit/workout.test.ts`: casos para cada função, incluindo os limites de faixa, recorde na primeira vez (não conta), sequência com semana atual incompleta e normalização com acento ("Elevação Lateral" → "elevacao lateral").

**Verificação:** `npm.cmd test -- --maxWorkers=2` e `npm.cmd run typecheck` passam; a migração é aplicada nos testes do Worker sem erro.

**Anti-padrões:** nada de lógica de data com `new Date()` local; usar `shared/dates.ts`.

## Phase 2 — API no Worker
> **How this serves the primary goal:** o app salva e lê treinos, séries e relatórios no D1, então os dados aparecem em qualquer aparelho e não se perdem.

**Implementar** `worker/routes/workout.ts`, copiando `worker/routes/tasks.ts`, e montar em `worker/index.ts:35-39`.

| Rota | O que faz |
|---|---|
| `GET /api/workout` | Visão da semana: plano dos 7 dias com status (feito/perdido/hoje/futuro/folga), treino de hoje com exercícios e "última vez", meta, treinos feitos, XP da semana, sessão aberta (se houver), sequência e brasão. |
| `POST/PATCH/DELETE /api/workout/templates[/:id]` | CRUD dos treinos A/B/C. |
| `POST/PATCH/DELETE /api/workout/templates/:id/exercises[/:eid]` | CRUD dos exercícios, mais `PATCH .../order` para reordenar. |
| `PUT /api/workout/plan` | Recebe `{days:[{weekday,templateId|null}], weeklyGoal}`. |
| `PATCH /api/workout/settings` | Configurações. |
| `POST /api/workout/sessions` | Recebe `{templateId}` e abre a sessão. Dá 409 se já existir uma aberta. Devolve a sessão com o pré-preenchimento de cada série. |
| `POST /api/workout/sessions/:id/sets` | Grava uma série e devolve `{set, xp, pr:boolean}`. |
| `PATCH/DELETE .../sets/:sid` | Corrige ou apaga uma série. |
| `POST /api/workout/sessions/:id/finish` | Fecha a sessão e devolve o resumo vs semana passada (`buildSessionSummary`). |
| `DELETE /api/workout/sessions/:id` | Descarta a sessão. |
| `GET /api/workout/report?week=YYYY-MM-DD` | `buildWeekReport`, conquistas e semanas disponíveis. |

- Somar o XP do treino em `worker/xp.ts` `totalXp` para o nível geral (`/api/progress`), sem mexer no `weekXp` e no brasão das tarefas.
- Testes em `tests/worker/workout.test.ts`, copiando o harness de `tests/worker/tasks.test.ts:1-27`:
  - CRUD
  - 409 de sessão dupla
  - recorde
  - pré-preenchimento vindo da última sessão
  - relatório com `X-Test-Today`
  - 401 em host de produção
  - `/api/progress` somando o XP do treino

**Verificação:** vitest verde, typecheck verde.

**Anti-padrões:** não aceitar `weight_g` negativo nem fora de múltiplos de 500 g; limites em constantes como as de `shared/limits.ts`.

## Phase 3 — Navegação (barra de baixo + menu)
> **How this serves the primary goal:** o Treino fica a um toque, junto com Hoje e Ideias, como pedido.

**Implementar**
- Trazer de volta a barra de `git show HEAD:src/App.tsx` L146-171 com 3 itens: Hoje (CalendarIcon), Ideias (LightbulbIcon) e Treino (DumbbellIcon).
- Restaurar `--tabbar-h: 57px` e o reset no desktop (HEAD styles.css L41-42 e L58-63).
- `Section` e `HASH` ganham `workout: "treino"`.
- O NavDrawer ganha "Treino" em Rotina, clonando L167-169.
- O ☰ continua no topo de todas as telas.
- O Treino esconde a CaptureBar, como o Financeiro em App.tsx:234.
- No desktop, Treino abre na coluna direita (App.tsx:210).
- `src/screens/Workout.tsx` como esqueleto copiado de `Finance.tsx`.
- `src/lib/useWorkout.ts` copiado de `useFinance.ts:10-39`.
- `api.ts` ganha os métodos do Treino.
- `Icon.tsx` ganha Dumbbell, Timer e Flame.
- E2E:
  - `tests/e2e/nav.ts` aceita "Treino".
  - `layout.spec.ts`: um teste de barra de baixo no celular com 3 botões e `aria-current`, que não aparece no desktop.
  - Conferir que os testes do menu (L247-279) e o de 375 px (L323) continuam passando.

**Verificação:** e2e completo verde; checar no celular (390) que a CaptureBar não fica atrás da barra.

## Phase 4 — Tela Treino: semana e montar semana
> **How this serves the primary goal:** o Hugo monta os treinos A/B/C e a semana uma vez, e o app passa a saber o treino de cada dia.

**Implementar**, seguindo `treino-2026-11.html` telas 1 e 3:
- **Topo:** ☰, "Treino · semana N" e a chama da sequência.
- **Faixa dos 7 dias:** nome do treino ou Folga, ponto verde (feito), vermelho (perdido) ou cinza.
- **Card "Treino de hoje":** treinos feitos sobre a meta, volume da semana, XP da semana e botão **Começar treino**. Mostra **Continuar treino** se houver sessão aberta. Num dia de folga, mostra "Hoje é folga" com a opção de treinar mesmo assim, escolhendo o treino.
- **Lista de exercícios do treino de hoje:** séries × reps · kg e XP.
- **Montar a semana** (sheet ou tela, usando `.sheet-dialog`):
  - meta de 3 a 6 dias
  - os 7 dias, cada um com o treino ou folga (toque para trocar)
  - "+ Novo treino"
  - editor do treino: nome e foco, exercícios com séries, reps, kg e descanso, mover para cima/baixo, apagar
- **Primeiro uso**, sem nenhum treino: tela vazia com convite "Monte sua semana".
- `tests/e2e/workout.spec.ts`: criar treino A com 2 exercícios, pôr na quinta, e ver o card de hoje com `X-Test-Today` numa quinta.

**Verificação:** e2e e um screenshot no celular comparado com o rascunho.

## Phase 5 — Treino ao vivo, descanso e resumo
> **How this serves the primary goal:** é a parte que o Hugo mais gostou: o app conduz o treino, salva peso e reps, e conta o descanso.

**Implementar**, seguindo `treino-sessao-2026-11.html` telas A, B e C:
- **Tela cheia, sem barra:**
  - topo com ✕ (pergunta se quer sair ou descartar), nome, tempo decorrido e XP ganho
  - barra de progresso e o exercício da vez com "Semana passada: 80 kg × 8"
  - "meta hoje ↑" quando houver `suggestUp`
  - dois steppers grandes, Peso (±2,5) e Reps (±1)
  - lista S1…Sn com "antes", ✓ +5, ★ RECORDE e AGORA
  - botão **Concluir série · descanso 1:30**
  - linha "Depois: …"
- **Concluir série:** grava na hora (`POST .../sets`). Faz atualização otimista e, se falhar, mostra um aviso e permite tentar de novo. Recorde mostra ★ e +30.
- **Descanso** (componente `RestTimer`):
  - anel com contagem por `endsAt`, ±15 s, presets
  - interruptor "usar sempre neste exercício" (`PATCH` do exercício) e interruptor de som e vibração
  - "Próxima série" com os valores
  - Pular / Já estou pronto
  - No fim: vibra (`navigator.vibrate?.([200,100,200])`) e bipa (WebAudio, como em `Recorder.tsx:40`)
  - `wakeLock` enquanto a sessão estiver aberta, solto ao sair
- **Último exercício concluído:** botão **Finalizar treino**, que leva ao resumo com XP, volume vs semana passada, recordes, lista por exercício (↑ / = / ↓) e **Salvar e fechar**.
- **Retomar:** reabrir o app com sessão aberta volta para o exercício certo.
- E2E:
  - fazer 2 séries
  - recorde aparece quando o peso passa o da sessão anterior, semeada via API
  - o resumo mostra ↑
  - o descanso aparece e "Já estou pronto" fecha
  - Tempos testados com `page.clock`.

**Verificação:** e2e e um teste manual curto no celular de verdade (vibração e tela acesa) depois do deploy.

## Phase 6 — Progresso: brasão, conquistas e relatório
> **How this serves the primary goal:** mostra se a carga subiu semana a semana e dá o motivo para voltar (brasão, sequência, conquistas).

**Implementar**, seguindo `treino-2026-11.html` tela 4 e `treino-sessao-2026-11.html` tela D:
- **Seção Progresso na tela Treino:**
  - brasão da semana com `Medal` e "falta 1 p/ Diamante"
  - sequência, recordes e volume do mês
  - grade de conquistas, com as bloqueadas apagadas
- **Relatório semana × semana:**
  - seletor das últimas 4 semanas
  - "N de M subiram" e volume ↑%
  - por exercício: mini gráfico de 6 semanas (barras CSS, como no rascunho), carga máx e delta
  - dica do exercício parado
- Domingo: sem animação nova neste plano; só o card.
- E2E: o relatório mostra ↑ depois de duas semanas semeadas.

**Verificação:** e2e e unidade.

## Phase 7 — Verificação, deploy e GitHub
> **How this serves the primary goal:** coloca o Treino no celular do Hugo, funcionando com os dados de verdade.

1. `npm.cmd run typecheck`, `npm.cmd test -- --maxWorkers=2` e `npm.cmd run e2e`, tudo verde. Fazer grep de anti-padrões:
   - `lucide-react` fora do `Icon.tsx`
   - `parseFloat` em peso
   - `setInterval` no RestTimer
2. Screenshots para o README (`docs/screenshots`) e uma linha no README.
3. **Deploy (com OK do Hugo):**
   - backup do D1 remoto (`wrangler d1 export`)
   - `wrangler d1 migrations apply agenda --remote`: aplica a 0003 (Financeiro, inofensiva, tabela vazia) e a 0004
   - `wrangler deploy`
   - O item Financeiro no ☰ continua apontando para a tela placeholder. Antes do deploy, perguntar ao Hugo se esconde o item até terminar o Financeiro.
4. Commits em português no imperativo. **Push só com OK.** HANDOFF.md nunca vai para o commit.

## Fora deste plano
- Notificação com a tela desligada
- Biblioteca de exercícios com GIFs
- Cardio com GPS
- Peso corporal e medidas
- Importar treino de outro app
- Animação de revelação do brasão de treino no domingo
- Terminar o painel Financeiro (plano próprio)
