# Plano — Herói e Torre (Agenda)

Branch: `feat/heroi-torre`, criada a partir de `feat/aba-treino` **depois** do merge de `feat/treino-telas` (Treino, Fases 4–6) e `feat/financeiro-tela`. Rascunhos e decisões aprovados:
- `docs/superpowers/ideias/gamificacao-2026-11.md`: decisões das rodadas 1 a 5.
- `docs/superpowers/mockups/heroi-2026-11.html`: Herói com radar, Hoje com missões e Trilha do atributo.
- `docs/superpowers/mockups/heroi-castelo-2026-11.html`: herói em 3 estágios (SVG à mão) e gerador JS da torre de castelo.

> **Pré-requisito.** A tela do Treino (Fases 4–6 do plano `2026-11-13-aba-treino.md`) está sendo feita em paralelo em `feat/treino-telas`. Este plano só depende do Treino por meio de `shared/workout.ts` e das rotas do Worker que **já existem** neste branch (`GET /api/workout`, `POST /api/workout/sessions`). Não importa nenhum componente de `src/components/workout/`. As Fases 1–3 (banco, regras e API) podem até começar antes; as Fases 4 em diante **só começam depois do merge do Treino**, porque mexem nos mesmos arquivos (ver "Pontos de conflito").

## Primary goal
No celular, Hugo abre o app e cai na tela **Herói**: vê o personagem (que muda com o nível e com as peças ganhas), o radar dos 5 atributos e a **torre de castelo**, que ganha um andar por semana na cor do brasão.

Na tela **Hoje**, ele marca as **missões diárias** com um toque (Ler 10 páginas, Meditar 10 min). Quando faz todas, a janela do dia acende na torre. Embaixo ficam os compromissos: as tarefas e o treino do dia, com o botão **INICIAR** que abre o treino ao vivo.

O XP vem do que ele já faz (tarefas por área, treino, finanças pelo agente e missões), sem marcar nada duas vezes. No domingo, a revelação mostra o andar novo subindo e o brasão pousando nele.

## Decisões fixas (não rediscutir)
- **Usuário único**, como no resto do app (`worker/auth.ts`).
- **Barra de baixo (celular):** **Herói · Hoje · Treino · Ideias**. No ☰ ficam Financeiro, Configurações e Ajuda. O item "Quadro da semana" **sai do ☰**: o caminho agora é tocar num andar da torre (ou o ProgressPill/cartão de domingo, que continuam).
- **Tela inicial = Herói.** Hash `#heroi`; um hash desconhecido (ou nenhum) cai no Herói.
- **XP calculado, nunca gravado** (mesmo padrão de `worker/xp.ts`). Também não se gravam nível de atributo, nós de trilha, peças, títulos nem andares da torre: tudo sai dos dados.
- **Uma moeda só: XP.** Recompensas da trilha são cosméticas (título ou peça). Punição leve: nada conquistado se perde.
- **5 atributos e de onde vem o XP:**

  | Atributo | Fonte |
  |---|---|
  | Física | XP do Treino (`workoutXpBySession`, `worker/xp.ts:13-23`) + missões Física |
  | Mental | tarefas da área **Faculdade** (`school`) + missões Mental |
  | Profissional | tarefas da área **Trabalho** (`work`) + missões Profissional |
  | Financeira | dias com movimentação registrada pelo Agente Finanças (regra abaixo) + missões Financeira |
  | Espiritual | só missões Espiritual |

  - Tarefas da área **Pessoal** ou sem área: XP só no **nível geral**, sem atributo.
  - O XP de tarefa no atributo é o mesmo da dificuldade (`XP_BY_DIFFICULTY`, `shared/xp.ts:8`), domingo incluído.
- **Nível do atributo** usa a mesma curva do nível geral (`levelFromXp`, `shared/xp.ts:45-55`).
- **Nível geral** = tarefas (como hoje) + treino (como hoje) + **missões** + **finanças**. O brasão semanal **continua só com XP de tarefas seg–sáb** (`WeekXp.xp`), sem mudança.
- **Missões diárias** (conceito novo):
  - hábitos que se repetem **todo dia**, com XP fixo, atributo e sequência própria
  - valores de XP permitidos: **5, 10, 20, 35, 50**
  - no máximo **8** missões ativas; título de 1 a 60 caracteres
  - sementes na migração: **Ler 10 páginas (+20, Mental)** e **Meditar 10 min (+10, Espiritual)**
  - dá para criar, renomear, reordenar e arquivar. **Arquivar, nunca apagar**: o histórico e o XP ficam.
  - **XP e atributo travam depois da primeira marcação** (para mudar, arquiva e cria outra). Assim o XP continua calculado e o histórico não muda sozinho.
  - uma missão vale para o dia D quando `start_date ≤ D` e (`archived_date` é nulo ou `D < archived_date`)
  - marcar e desmarcar é um toque, só para hoje na interface
- **Dia cumprido** (janela acesa) = existe ao menos 1 missão valendo no dia **e todas** foram feitas. Sem missões, a janela fica apagada.
- **Sequência das missões** (chama no topo do Herói) = dias seguidos cumpridos. Hoje entra só quando já cumprido e não zera a sequência antes de acabar (mesma regra de `streakWeeks`, `shared/workout.ts:590`). Cada missão também mostra a própria sequência ("9 dias").
- **Torre:**
  - 1 andar por semana (segunda a domingo), de baixo para cima, desde a primeira semana com qualquer atividade (tarefa feita, missão marcada, treino concluído ou dia de finanças)
  - **cor do estandarte** = brasão de tarefas da semana (`medalFor(WeekXp.xp)`); sem brasão, sem estandarte
  - **7 seteiras**, acesas nos dias cumpridos; no andar atual, hoje fica verde e os dias seguintes ficam fechados
  - **bandeira verde** quando a semana bateu a meta de treino (`doneByWeek`, `shared/workout.ts:579`, contra a meta **atual** `weeklyGoal`)
  - **andar atual "em obra"**, com andaime e guindaste (desenho do rascunho 4)
  - **tocar num andar** abre o Quadro da semana que já existe (`Report`, com `start` = segunda daquele andar)
- **Herói em 3 estágios** pelo nível geral: **Andarilho** (1–9), **Patrulheiro** (10–24), **Guardião Sombrio** (25+). O desenho vem do rascunho 4 (SVG à mão), com o neon só nos olhos e no amuleto.
- **6 peças**, destravadas por nós de trilha: Elmo, Gibão, Arco (estágio Patrulheiro) e Capa, Máscara, Amuleto (estágio Guardião). Uma peça só aparece no desenho do estágio dela; antes disso aparece no quadro de peças como "ganha · aparece no Patrulheiro/Guardião".
- **Trilhas:** 5 nós (I a V) por atributo, lista fixa no código (tabela na Fase 1). Cada nó tem marco, recompensa (título ou peça) e **data em que destravou** (calculada), para a revelação de domingo.
- **Hoje:** missões em cima, compromissos (tarefas) embaixo. O treino do dia é o primeiro compromisso, com **INICIAR**.
- **Domingo:** a revelação mostra o andar novo subindo, o brasão pousando no estandarte e, se uma peça destravou na semana, o herói vestindo.
- **Fora:** chefão semanal, inventário, loja, moeda extra, energia.

### Suposições (confirmar depois)
O Hugo está fora e aprovou seguir com as opções recomendadas. Ficam valendo até ele dizer o contrário:
1. **Regra da Financeira:** **+10 XP por dia** (data `data` da movimentação) com ao menos 1 movimentação do tipo `gasto`, `receita` ou `aporte` no retrato do Agente Finanças. Para não perder XP quando o retrato só traz os últimos 13 meses (`shared/finance.ts:94`), cada sync grava as datas numa tabela `finance_days` (só a data, não XP), com `INSERT OR IGNORE`.
2. **Missões e finanças entram no nível geral**, mas não no brasão semanal (que segue só com tarefas).
3. **Marcar missão:** a interface só marca hoje. A API aceita qualquer data **até hoje** (não futura), para os testes E2E com relógio falso e para corrigir um esquecimento depois, se for preciso.
4. **Bandeira de treino** usa a meta atual (a meta antiga não é guardada).
5. **Valores das trilhas** (tabela da Fase 1) são iniciais e podem ser ajustados depois sem migração.
6. **Tela inicial = Herói** também no computador: lá, o Herói abre na coluna da direita (o Hoje continua fixo à esquerda).
7. **Captura rápida escondida no Herói**, como no Treino e no Financeiro.
8. **Escala do radar:** raio = nível do atributo ÷ max(5, maior nível entre os 5).
9. **Título exibido** no card = título do nó mais recente destravado; sem título, o nome do estágio.
10. Os desenhos do herói e da torre são os do rascunho 4. Se o Hugo encomendar arte em PNG por estágio, só o componente `HeroFigure` muda.

## Phase 0 — Descoberta (feita em 2026-11-16, branch `feat/aba-treino` em 658d94b)
> **How this serves the primary goal:** o Herói é feito em cima do XP, das medalhas, do Treino e do relatório que já existem. Copiar esses padrões evita uma segunda forma de calcular XP e reduz o risco.

### Allowed APIs e padrões (com fonte)

**Migrações**
- Existentes: `0001_init.sql`, `0002_difficulty.sql`, `0003_finance.sql`, `0004_treino.sql`. **Próxima: `migrations/0005_heroi.sql`** (conferir antes que nenhum branch em paralelo criou uma 0005).
- Convenções:
  - `id TEXT PRIMARY KEY` com `crypto.randomUUID()`
  - `created_at`/`updated_at` ISO
  - dia como `date TEXT` YYYY-MM-DD
  - booleanos `INTEGER 0/1`
  - FK `ON DELETE CASCADE` (`0001_init.sql:28`)
  - índices `idx_<tabela>_<col>`
  - comentários em português (`0004_treino.sql:1`)
- Linha semente dentro da migração: `INSERT INTO workout_settings (id) VALUES (1);` (`0004_treino.sql:42`).
- Tarefas: `tasks.area` ∈ `work|school|personal` ou NULL (`worker/routes/tasks.ts:17`), `done_at`, `date`, `difficulty` (`0002_difficulty.sql:1`). Rótulos: `src/lib/format.ts:5-9` (work=Trabalho, school=Faculdade, personal=Pessoal).
- Finanças: linha única `finance_snapshot` (`0003_finance.sql`); movimentações com `data` e `tipo` em `shared/finance.ts:95-108`, `MOV_TIPOS` em 34-43.

**XP, nível e brasões**
- `shared/xp.ts`:
  - `XP_BY_DIFFICULTY` (8), `taskXp` (11)
  - `MedalTier` (15), `MEDALS` (18-24), `medalFor` (27), `nextMedal` (34)
  - `xpToNext` (40), `levelFromXp` (45-55)
- `worker/xp.ts`:
  - `WeekXp` (10)
  - `workoutXpBySession` (13-23)
  - `xpByWeek` (30-55): consulta agrupada por `date(date,'-6 days','weekday 1')` (34)
  - `totalXp` (58-62)
- `/api/report` em `worker/routes/report.ts:14-43` (usa `totalXp` para `level`/`levelBefore`). `/api/progress` em 45-53.

**Treino (só a API de `shared/workout.ts` e as rotas já prontas)**
- `isoWeekday` (416), `isoWeekNumber` (421), `sessionXp` (438), `recordsBySession` (466)
- `workoutMedal` (556), `doneByWeek` (579), `streakWeeks` (590), `bestStreak` (603)
- `volumeOf` (659), `TONNE_DAY_G` (42)
- `loadHistory` e `getSettings`/`getPlan` em `worker/workout-db.ts:149`, `123`, `133`
- `GET /api/workout` em `worker/routes/workout.ts:73-155` devolve `todayWorkout` (109-118), `openSession` (123-132) e `days[].status`. Tipo `WorkoutWeekView` em `shared/workout.ts:234`.
- `POST /api/workout/sessions` (`workout.ts:460`): 409 se já houver sessão aberta.
- Cliente: `api.workoutWeek` (`src/lib/api.ts:203`), `api.startWorkoutSession` (228), hook `useWorkout` (`src/lib/useWorkout.ts:9-38`).

**Datas:** `shared/dates.ts`
- `todayISO` (19), `isRealDate` (24), `addDays` (33)
- `weekStart` segunda (39-42), `weekDays` (44), `isSunday` (56)

**Worker**
- Rotas: arquivo `new Hono<{ Bindings: Env }>()` montado em `worker/index.ts:36-41`; `Env` em 10-20.
- `readBody(c, schema)` (`worker/http.ts:28-48`), `badRequest` (24-26), `serverToday(c)` (14-18, respeita `X-Test-Today` em DEV).
- Modelo CRUD: `worker/routes/tasks.ts:14-60` (Zod 4 com `{ error }`, `.nullish()` no create, `.nullable().optional()` no patch). 404: `notFound` como em `worker/routes/workout.ts:60`.
- Sync do Financeiro: `worker/routes/finance.ts:70-85` (`INSERT … ON CONFLICT`).
- Limites em constantes: `shared/limits.ts`.

**Testes**
- Harness do Worker: `tests/worker/workout.test.ts:1-30` (`call(method, path, body, today)` com `X-Test-Today`, `beforeEach` limpando tabelas com `env.DB.batch`).
- Migrações aplicadas sozinhas: `vitest.config.ts:5,11` + `tests/worker/apply-migrations.ts`.
- Unidade: `tests/unit/xp.test.ts`, `tests/unit/workout.test.ts`.
- E2E:
  - `playwright.config.ts`: celular 390×844; desktop roda só `layout.spec`; `workers: 1`; o banco **não** é zerado entre specs (`scripts/e2e-server.mjs:9-16`)
  - relógio falso com `page.clock.install` (`tests/e2e/reveal.spec.ts:28-31`, `today.spec.ts:44`)
  - semente via `request.post` (`reveal.spec.ts:16-26`)
  - `openSection` em `tests/e2e/nav.ts:4`
- Scripts: `npm.cmd test -- --maxWorkers=2`, `npm.cmd run typecheck`, `npm.cmd run e2e` (porta própria com `E2E_PORT`).

**Front**
- `src/App.tsx`:
  - `Tab` (20), `HASH` (23), `TABS` (26-30), `tabFromHash` com padrão "today" (33), `useHashTab` (36-49)
  - `openReport` (94-99), `openFromToday` (102-105)
  - `drawer` com `onOpenWeek` (164-174), `reveal` (176-185), `report` (187-189)
  - desktop: coluna direita (217-225); celular: troca de tela (239-247), CaptureBar (250), barra de baixo (253-278)
- `src/components/NavDrawer.tsx`: `Section` (19), props (21-34), Rotina (147-163; "Quadro da semana" em 151-160), Painéis (168-172), Configurações (176-178).
- `src/screens/Today.tsx`:
  - `MOBILE_PAD` (37-40)
  - XP do dia (62)
  - `afterChange` + `notifyProgressChanged` (67-72)
  - toque otimista com `toggling` (53, 74-89)
  - rótulo **"Missões do dia" acima das tarefas (162)**: vira "Compromissos"
  - `TaskList` (182)
- `src/screens/MedalReveal.tsx`:
  - `reducedMotion` (52-53), `useCountUp` (56-76)
  - carrega `api.reportData` (100-108)
  - palco `Won` (298-370): raios, halo, `medal-in`
  - `NoMedal` (372)
- `src/components/game/Medal.tsx`:
  - cores por nível em `TIERS` (24-30, privado)
  - `MEDAL_GLOW` (33-39), `MEDAL_LABEL` (6-12)
  - ids únicos com `useId` (181-182): **modelo para os SVGs do herói e da torre**
- `src/screens/Report.tsx:14-21` (`start`, `onClose`, `onMoved`).
- `src/components/SundayCard.tsx` (cartão de domingo no Hoje).
- `src/lib/useProgress.ts`: `notifyProgressChanged` (7), hook (10-42). Modelo de hook de dados: `useWorkout.ts:9-38`.
- `src/lib/api.ts`: `request<T>` (121-153), objeto `api` (161), bloco do Treino (201-245).
- Ícones só via `src/components/ui/Icon.tsx`. Já existem `ShieldIcon` (120, ícone do Herói no rascunho), `FlameIcon` (125), `PlayIcon` (126), `BookOpenIcon` (161), `HeartIcon` (162), `BriefcaseIcon` (160), `WalletIcon` (117), `DumbbellIcon` (121). Falta um para Espiritual: adicionar `SparkleIcon`/`LeafIcon` do lucide, se não houver equivalente.
- CSS:
  - `--tabbar-h: 57px` e `--fixed-bars-h` (`src/styles.css:42-43`), zerados no desktop (62-63)
  - `.sheet-dialog` (230-263), `.glass` (362), `.glass-quiet` (372), `.fill-neon` (380), `.text-neon` (390), `.eyebrow` (394)
  - `.medal-in`/`@keyframes medal-in` (427, 435)
  - bloco de movimento reduzido (445-450)
- Rascunhos para copiar:
  - `heroi-castelo-2026-11.html`:
    - `HERO_DEFS` (L383-397), `legs`, `hero1`/`hero2`/`hero3` (L400-506)
    - torre: `towerDefs`, `slit`, `floor`, `scaffold`, `tower` (L524-609)
    - card do herói com quadro de 6 peças (L339-349)
  - `heroi-2026-11.html`:
    - radar (L426-450, pentágono r=88, eixos em -90°, -18°, 54°, 126°, 198°)
    - Hoje com missões, `dots7` e compromisso do treino (L498-533)
    - Trilha (L536-559)
- E2E existentes afetados:
  - **25 chamadas `page.goto("/")`** que esperam o Hoje (capture, ideas, layout, report, reveal, today)
  - `layout.spec.ts`: menu (261-311; "Quadro da semana" em 306-308), barra de baixo (313-366), sem rolagem lateral (392)

### Pontos de conflito (arquivos que o Treino/Financeiro em paralelo também mexem)
- `src/App.tsx`: `Tab`/`HASH`/`TABS`, troca de tela e condição da CaptureBar.
- `src/screens/Today.tsx`: o Herói muda o topo e o rótulo das tarefas.
- `src/components/NavDrawer.tsx`, `src/lib/api.ts` (acrescentar um bloco `// ===== Herói` no fim, sem reordenar), `worker/index.ts` (montar rotas no fim), `worker/xp.ts`, `worker/routes/finance.ts` (só o sync), `src/styles.css`, `tests/e2e/layout.spec.ts`.
- **Regra:** começar a Fase 4 só depois do merge do Treino e do Financeiro, com `git pull` do `feat/aba-treino` e typecheck verde. Se um dos dois ainda não entrou, parar e avisar.

### Anti-padrões
- Não gravar XP, nível, nós, peças, títulos nem andares em tabela.
- Não usar `zValidator`; usar `readBody`.
- Não usar `new Date()` local para dia; usar `shared/dates.ts` e `serverToday(c)`.
- Não colar SVG com `innerHTML`/`dangerouslySetInnerHTML`. Converter o rascunho para JSX, com ids de `<defs>` únicos por instância (`useId`, como `Medal.tsx:181-182`). O rascunho usa ids globais (`hLeather`, `tBrick`) que colidem quando há dois heróis ou duas torres na tela.
- Não importar `lucide-react` fora de `Icon.tsx`; não usar emoji como ícone (o ⚑ e o 🔥 do rascunho viram SVG ou `FlameIcon`).
- Não importar componentes de `src/components/workout/` (o contrato com o Treino é `shared/workout.ts` + rotas).
- Não apagar missão com histórico; arquivar.
- Não mudar `WeekXp.xp` (o brasão semanal de tarefas).

---

## Phase 1 — Banco e regras puras
> **How this serves the primary goal:** guarda as missões e os dias de finanças, e põe todas as contas (atributos, trilhas, peças, torre) em funções puras testáveis. As telas só mostram o resultado.

**Implementar**

1. `migrations/0005_heroi.sql`, com as convenções de `0001_init.sql` e comentários em português:

   | Tabela | Colunas |
   |---|---|
   | `missions` | `id`, `title`, `attribute TEXT CHECK(attribute IN ('fisica','mental','profissional','financeira','espiritual'))`, `xp INTEGER CHECK(xp IN (5,10,20,35,50))`, `position INT`, `start_date TEXT NOT NULL`, `archived_date TEXT` (NULL = ativa), `created_at`, `updated_at` |
   | `mission_checks` | `mission_id` FK CASCADE, `date TEXT`, `done_at TEXT NOT NULL`, `PRIMARY KEY (mission_id, date)` |
   | `finance_days` | `date TEXT PRIMARY KEY`, `first_seen_at TEXT NOT NULL` |

   - Índices: `idx_mission_checks_date` em `(date)` e `idx_missions_active` em `(archived_date, position)`.
   - Sementes: `INSERT INTO missions … VALUES (<uuid fixo 1>, 'Ler 10 páginas', 'mental', 20, 0, date('now','-3 hours'), …)` e o mesmo para `('Meditar 10 min', 'espiritual', 10, 1, …)`. `-3 hours` = São Paulo, que está sem horário de verão.

2. Em `shared/limits.ts`: `MISSION_TITLE_MIN = 1`, `MISSION_TITLE_MAX = 60`, `MISSIONS_ACTIVE_MAX = 8`.

3. `shared/hero.ts`, no modelo de `shared/workout.ts` (constantes `as const`, schemas Zod com o tipo de mesmo nome, funções puras que recebem `today`):
   - Constantes:
     - `ATTRIBUTES` (ordem do radar: `fisica`, `mental`, `profissional`, `espiritual`, `financeira`) e `ATTRIBUTE_LABEL`
     - `AREA_ATTRIBUTE` (`school→mental`, `work→profissional`, `personal→null`)
     - `MISSION_XP = [5,10,20,35,50]`, `FINANCE_DAY_XP = 10`, `FINANCE_XP_TIPOS = ["gasto","receita","aporte"]`
   - Schemas:
     - `MissionCreate {title, attribute, xp}`
     - `MissionPatch {title?, attribute?, xp?}`
     - `MissionOrder {ids}`
     - `MissionCheckPut {done:boolean}`
   - Tipos: `Mission` (`hasChecks`, `streak`), `AttributeId`, `AttributeView` (`xp`, `level`, `into`, `needed`, `sources: {tasks, missions, workout, finance}`), `TrailNode`, `GearId`, `HeroStage`, `TowerFloor`, `HeroView`.
   - Funções:
     - `missionActiveOn(m, date)`
     - `dayComplete(missions, checks, date)`: false sem missões
     - `missionStreak(dates, today)` e `daysStreak(completeDates, today)`, com a regra de `streakWeeks`
     - `missionXpByWeek(missions, checks)`
     - `financeDaysFrom(snapshot)`: datas distintas com tipo em `FINANCE_XP_TIPOS`
     - `heroStage(level)`: `andarilho` | `patrulheiro` | `guardiao`, com limites 10 e 25 em constantes
     - `attributeXp({taskRows, missionRows, workoutXp, financeDays})`: `Record<AttributeId, AttributeView>`, usando `levelFromXp`
     - `radarPoints(levels, radius = 88)`: pontos do pentágono, com a escala da Suposição 8
     - `TRAILS` e `trailProgress(attr, facts, today)`: cada nó com `{n, title, hint, reward, current, target, unlockedOn}`
     - `GEAR` e `gearFrom(trails)`: `{id, label, stage, unlockedOn}`
     - `currentTitle(trails)`
     - `buildTower({weeks, completeDates, trainDoneByWeek, goal, today, firstWeek})`: `TowerFloor[]` de baixo para cima, cada um com `{week, weekNumber, medal, windows: ("lit"|"dark"|"today"|"future")[7], trainFlag, current}`

4. **Trilhas** (valores iniciais; Suposição 5). Os "fatos" vêm do Worker (contagens com data):

   | Atributo | I | II | III | IV | V |
   |---|---|---|---|---|---|
   | Física | 1 treino concluído → título *Iniciante* | 4 semanas seguidas com a meta → **Elmo** | 5 recordes → título *Recordista* | 10 t num dia (`TONNE_DAY_G`) → **Capa** | 12 semanas seguidas → título *Inquebrável* |
   | Mental | 1 tarefa de Faculdade → *Aprendiz* | 7 dias seguidos com missão Mental → **Gibão** | 30 tarefas de Faculdade → *Estudioso* | Mental nível 8 → *Erudito* | 60 dias com missão Mental → *Sábio* |
   | Profissional | 1 tarefa de Trabalho → *Aprendiz de ofício* | 10 tarefas difíceis de Trabalho → **Arco** | 50 tarefas de Trabalho → *Artesão* | 4 semanas seguidas com ≥ 5 tarefas de Trabalho → *Mestre de ofício* | Profissional nível 10 → *Lenda do ofício* |
   | Espiritual | 1 missão Espiritual → *Buscador* | 7 dias seguidos → *Sereno* | 30 dias no total → *Monge* | 30 dias seguidos → **Máscara** | 100 dias no total → *Iluminado* |
   | Financeira | 1º dia registrado → *Contador* | 7 dias seguidos registrando → *Atento* | 30 dias registrados → *Tesoureiro* | 90 dias registrados → **Amuleto** | Financeira nível 10 → *Guardião do tesouro* |

   - `unlockedOn` é a data do evento que bateu o alvo: o n-ésimo evento nas contagens; para sequências e níveis, o primeiro dia em que o valor chegou ao alvo.
   - Use `bestStreak`/`doneByWeek` de `shared/workout.ts` para as semanas de treino.

5. `tests/unit/hero.test.ts`. Casos:
   - missão vale só entre `start_date` e `archived_date`
   - `dayComplete` falso sem missões e com 1 de 2 feita
   - sequência com hoje incompleto (não zera)
   - limites de estágio (9→andarilho, 10→patrulheiro, 24, 25)
   - área Pessoal fora dos atributos
   - `financeDaysFrom` ignora `transferencia`/`ajuste`
   - `unlockedOn` de contagem e de sequência
   - peça de estágio maior que o atual
   - `buildTower` com semana atual em obra, hoje = `today`, futuros, bandeira com meta batida
   - `radarPoints` com tudo zero (sem NaN)

**Verificação:** `npm.cmd test -- --maxWorkers=2` e `npm.cmd run typecheck` verdes. A migração 0005 aplica nos testes do Worker.

**Anti-padrões:** nada de `new Date()` local; nada de XP em coluna (nem `xp` em `mission_checks`); não duplicar `levelFromXp`.

## Phase 2 — API das missões e dias de finanças
> **How this serves the primary goal:** o Hoje precisa marcar a missão com um toque e o resultado aparecer em qualquer aparelho. A Financeira precisa de dias que não somem quando o retrato do agente encolhe.

**Implementar** `worker/routes/missions.ts`, copiando `worker/routes/tasks.ts` (readBody, 404 em pt-BR, respostas embrulhadas), e montar em `worker/index.ts` depois de `workoutRoutes`:

| Rota | O que faz |
|---|---|
| `GET /api/missions?date=YYYY-MM-DD` | Missões valendo no dia (padrão `serverToday`), em ordem. Cada uma com `done`, `streak` e `hasChecks`. Também devolve `complete` (dia cumprido), `dayStreak` e `week`: 7 estados da semana do dia, para os pontinhos `dots7`. |
| `POST /api/missions` | Cria com `start_date = serverToday`. Dá 409 acima de `MISSIONS_ACTIVE_MAX`. Devolve `{ mission }` com 201. |
| `PATCH /api/missions/:id` | `title` sempre; `xp`/`attribute` dão 409 com `fields` se `hasChecks` ("Arquive e crie outra para mudar o XP."). |
| `PATCH /api/missions/order` | `{ids}` = todas as ativas, na nova ordem (copiar `PATCH …/exercises/order`, `workout.ts:262`). |
| `DELETE /api/missions/:id` | **Arquiva** (`archived_date = serverToday`). Sem checks e criada hoje: apaga de verdade. |
| `PUT /api/missions/:id/checks/:date` | `{done}`; data real e **≤ serverToday** (Suposição 3); a missão precisa valer na data. Devolve `{ mission, xp, complete, dayStreak }`. Idempotente. |

- Em `worker/routes/finance.ts:70-85`, depois do `INSERT` do retrato: `INSERT OR IGNORE INTO finance_days (date, first_seen_at)` para cada data de `financeDaysFrom(snap)`, num `env.DB.batch`. É a única mudança no Financeiro.
- `tests/worker/missions.test.ts`, com o harness de `tests/worker/workout.test.ts:1-30`:
  - existem as 2 sementes (antes do `beforeEach` limpar, num `describe` próprio)
  - CRUD e limite de 8
  - trava de XP depois da marcação
  - arquivar mantém o check e some do dia seguinte
  - check em data futura dá 400
  - `complete` e `dayStreak` com `X-Test-Today`
  - 401 em host de produção, como `tasks.test.ts`
- Em `tests/worker/finance.test.ts`: o sync grava `finance_days` e um segundo sync com menos meses não apaga datas.

**Verificação:** vitest e typecheck verdes.

**Anti-padrões:** não aceitar XP fora de `MISSION_XP`; não devolver missão arquivada no `GET` de dias depois do arquivamento.

## Phase 3 — API do Herói, da torre e do nível geral
> **How this serves the primary goal:** uma chamada só entrega tudo o que a tela Herói mostra, e o nível geral passa a contar missões e finanças.

**Implementar**
1. `worker/xp.ts`:
   - `WeekXp` ganha `missionXp` e `financeXp`.
   - `xpByWeek` soma as missões (join `mission_checks` × `missions.xp`, por semana) e `finance_days × FINANCE_DAY_XP`.
   - `totalXp` (58-62) soma os quatro. **`xp` (brasão) não muda.**
   - Conferir `tests/worker/report.test.ts` e `tests/unit/xp.test.ts` (sem missões marcadas, nada muda).
2. `worker/hero-db.ts`, no modelo de `worker/workout-db.ts`. Carregadores:
   - `taskFacts(db)`: tarefas feitas por `date`, `area` e `difficulty` (`GROUP BY`)
   - `loadMissions(db)` e `loadChecks(db)`
   - `loadFinanceDays(db)`
   - reutiliza `loadHistory`/`getSettings`
3. `worker/routes/hero.ts`:

   | Rota | O que faz |
   |---|---|
   | `GET /api/hero` | `{ today, level (levelFromXp(totalXp)), totalXp, stage, title, attributes, gear, dayStreak, tower: TowerFloor[] }`. `tower` vai da primeira semana com atividade até a atual. |
   | `GET /api/hero/trail/:attr` | Atributo com `sources` em % e os 5 nós com progresso e `unlockedOn`. 404 para atributo desconhecido. |
   | `GET /api/hero/week?start=YYYY-MM-DD` | Para a revelação: o andar daquela semana, os nós destravados entre `start` e `start+6` e o estágio antes e depois. |

4. `tests/worker/hero.test.ts`:
   - Faculdade soma em Mental e Pessoal não soma em atributo, mas soma no nível
   - treino soma em Física
   - `finance_days` soma em Financeira
   - janela acesa só com todas as missões
   - bandeira com a meta de treino
   - andar atual `current`
   - `/api/progress` inclui missões e finanças
   - brasão semanal igual ao de antes

**Verificação:** vitest e typecheck verdes.

**Anti-padrões:** não fazer N consultas por semana (usar consultas agrupadas como `worker/xp.ts:34`); não calcular a torre no cliente.

## Phase 4 — Navegação: barra Herói · Hoje · Treino · Ideias (depois do merge do Treino)
> **How this serves the primary goal:** o Herói vira a porta de entrada, e o resto continua a um toque.

**Implementar**
- `NavDrawer.tsx`:
  - `Section` (19) ganha `"hero"`
  - Rotina: **Herói** (`ShieldIcon`, com o rótulo do brasão da semana que hoje está no "Quadro da semana", 159), Tarefas do dia, Ideias, Treino
  - **remover "Quadro da semana"** (151-160) e a prop `onOpenWeek`
- `App.tsx`:
  - `HASH` ganha `hero: "heroi"`
  - `TABS` = Herói (`ShieldIcon`), Hoje, Treino, Ideias (nesta ordem)
  - `tabFromHash` cai em `"hero"` (Suposição 6)
  - celular: `tab === "hero"` → `<Hero menu={menuButton} … />`
  - desktop: Herói na coluna direita (217-225)
  - CaptureBar (250) continua só em Hoje e Ideias
  - remover `onOpenWeek` do `drawer` (171)
  - comentários das linhas 22 e 25 atualizados
- `src/styles.css:41`: comentário da barra atualizado (sem mudar a altura).
- `src/screens/Hero.tsx` como esqueleto (cópia da casca de `src/screens/Workout.tsx`: `menu`, `wide`, padding com `--tabbar-h`), `src/lib/useHero.ts` (cópia de `useWorkout.ts:9-38`) e `api.hero()`, `api.heroTrail(attr)`, `api.heroWeek(start)` num bloco `// ===== Herói` no fim de `api.ts`.
- E2E:
  - `tests/e2e/nav.ts`: `openSection` aceita "Herói".
  - Trocar as 25 `page.goto("/")` que esperam o Hoje por `page.goto("/#hoje")`, sem mudar mais nada nesses testes.
  - `layout.spec.ts`:
    - barra (313-366) com 4 botões `["Herói","Hoje","Treino","Ideias"]`
    - `/` abre o Herói com `aria-current`
    - captura só no Hoje e nas Ideias
    - o passo "Quadro da semana" do menu (306-308) passa a conferir que o item **não** existe mais
  - Conferir de novo os testes do menu (261-311) e o de 375 px (392).

**Verificação:** e2e completo verde. No celular (390), ver que as 4 abas cabem sem quebrar o rótulo.

**Anti-padrões:** não mexer na lógica do Treino ao resolver conflitos em `App.tsx`; não deixar dois itens com `aria-current`.

## Phase 5 — Hoje: missões em cima, compromissos embaixo
> **How this serves the primary goal:** é o uso diário. Marcar uma missão com um toque acende a janela da torre, e o treino do dia vira um compromisso com INICIAR.

**Implementar**, seguindo `heroi-2026-11.html` tela 3 (L498-533):
- `src/components/missions/MissionsCard.tsx` (`.glass`), no topo do Hoje, **só quando o dia selecionado é hoje**:
  - cabeçalho "Missões do dia · 1/2" e os 7 pontinhos da semana (`week` do `GET /api/missions`)
  - linhas com caixa, título, "+20 · Mental · 9 dias"
  - rodapé "Faça as 2 para acender a janela de hoje na torre." Quando cumprido: "Janela de hoje acesa".
  - toque otimista **copiando `Today.tsx:74-89`** (`toggling` ref, volta ao estado anterior e mostra toast se falhar)
  - `XpPop` com o XP da missão
  - `notifyProgressChanged()` (`useProgress.ts:7`)
  - botão ⋯ "Editar missões"
- `src/components/missions/MissionsSheet.tsx` (`.sheet-dialog`, como o editor de treino):
  - lista com renomear, subir/descer, arquivar (Desfazer no toast)
  - "+ Nova missão" com título, atributo e chips de XP 5/10/20/35/50
  - XP e atributo desabilitados com a dica quando `hasChecks`
- `src/lib/useMissions.ts` (modelo `useWorkout.ts`) e métodos `api.missions(date)`, `createMission`, `updateMission`, `reorderMissions`, `archiveMission`, `checkMission(id, date, done)`.
- `Today.tsx`:
  - rótulo da linha 162 vira **"Compromissos"**
  - o "+N XP hoje" (62) soma o XP das missões feitas no dia
- `src/components/WorkoutCommitment.tsx`, primeiro item dos compromissos de hoje (só se `todayWorkout` existir ou houver `openSession`):
  - linha "Treino C · Perna · 6 exercícios · Física · +50 XP"
  - estados: **INICIAR**, **CONTINUAR** (sessão aberta) e "Feito ✓" (`days[].status === "done"`)
  - INICIAR chama `api.startWorkoutSession(templateId)`; num 409, ignora. Depois navega para `#treino`, onde o Treino (Fase 5 dele, "Retomar") mostra a sessão aberta.
  - O Hoje recebe `onOpenWorkout` do `App` (que faz `setTab("workout")`).
- E2E `tests/e2e/missions.spec.ts`, com relógio falso numa semana própria de 2020 (como `reveal.spec.ts:4-9`, para não colidir com outros specs):
  - as 2 sementes aparecem
  - marcar as 2 mostra "Janela de hoje acesa" e o XP sobe
  - desmarcar volta
  - criar uma missão de +35 Física e arquivar
  - INICIAR com um treino semeado via API leva a `#treino` com a sessão aberta (`GET /api/workout` com `openSession`)

**Verificação:** e2e verde e screenshot no celular comparado com o rascunho (tela 3).

**Anti-padrões:** não mostrar caixas de missão em dias passados ou futuros (lá não dá para marcar); não duplicar o treino como tarefa no banco.

## Phase 6 — Tela Herói: personagem, radar e trilha
> **How this serves the primary goal:** o Hugo vê o herói mudar com o nível e as peças, e o radar mostra o equilíbrio dos 5 atributos.

**Implementar**, seguindo `heroi-castelo-2026-11.html` (card L339-349) e `heroi-2026-11.html` (radar L426-450, trilha L536-559):
- `src/components/hero/HeroFigure.tsx`: `({stage, gear, size})`.
  - Converter `HERO_DEFS`, `legs`, `hero1/2/3` (L383-506) para JSX, com ids `useId` e `role="img"` + `aria-label` ("Patrulheiro com elmo e arco").
  - Camadas por peça:

    | Peça | Camada (estágio) | Se não tiver |
    |---|---|---|
    | Elmo | elmo + cota (hero2) | capuz e lenço do hero1 |
    | Gibão | gibão acolchoado (hero2) | túnica de couro do hero1 |
    | Arco | arco na mão + aljava (hero2) | maça do hero1 |
    | Capa | capa longa (hero3) | sem capa |
    | Máscara | máscara branca + olhos neon (hero3) | capuz escuro sem máscara |
    | Amuleto | corrente + amuleto neon (hero3) | sem amuleto |
- `src/components/hero/HeroCard.tsx`:
  - nome do estágio (eyebrow lima), "Hugo", título atual, nível grande, barra `level-track`/`level-fill` (como `NavDrawer.tsx:137-139`) e "6.120 XP · faltam 830"
  - quadro de 6 peças (ganha / bloqueada / "aparece no Guardião")
- Topo do Herói: ☰, "Herói" e a chama com `dayStreak` ("12 dias", `FlameIcon`).
- `src/components/hero/AttributeRadar.tsx`:
  - SVG do rascunho com `radarPoints`
  - os 5 rótulos ("FÍSICA Nv 6") são **botões** que abrem a trilha
  - `aria-label` no SVG com o resumo dos níveis
- `src/components/hero/TrailSheet.tsx` (`.sheet-dialog`, tela cheia no celular):
  - cabeçalho com ícone do atributo, "Física · Nv 6", "1.180 XP neste atributo" e fontes em %
  - trilha vertical I–V: feito / atual com barra "3 de 5" / bloqueado
  - recompensa "TÍTULO · Iniciante" ou "PEÇA · Elmo"
  - Explica em uma linha de onde vem o XP do atributo (princípio "explicar cada mecânica na tela").
- Estados de carregamento e erro como em `Today.tsx:167-180`.
- E2E `tests/e2e/hero.spec.ts`:
  - `/` mostra o Herói com nível e estágio
  - uma tarefa de Faculdade feita sobe Mental no radar
  - tocar em "MENTAL" abre a trilha com o nó I feito
  - o herói muda de estágio no nível 10 (semear XP em semana antiga, como `reveal.spec.ts`)

**Verificação:** e2e verde, sem rolagem lateral em 375 px, screenshots dos 3 estágios.

**Anti-padrões:** nada de emoji; não pôr neon fora dos olhos e do amuleto; não copiar o SVG com ids fixos.

## Phase 7 — Torre de castelo
> **How this serves the primary goal:** é a memória visual que prende no longo prazo: cada semana vira um andar, e tocar nele abre o Quadro da semana.

**Implementar**
- `src/components/hero/CastleTower.tsx`: `({floors, mode: "mini" | "full", onOpenWeek})`.
  - Converter `towerDefs`, `slit`, `floor`, `scaffold`, `tower` (L524-609) para JSX, com ids `useId`:
    - estados de seteira: `lit`, `dark` (rachada), `today` (verde), `future` (fechada)
    - estandarte com as cores do rascunho por nível (`TIER` L522); exportar de `Medal.tsx` uma função pública `tierColors(tier)` em vez de duplicar
    - bandeira verde de treino
    - andar atual com andaime e guindaste
    - base com portão
  - **Mini:** últimos 3 andares + atual, com "+N SEMANAS" embaixo e "ver tudo ›".
  - **Full:** todos os andares, numa `TowerSheet` (`.sheet-dialog`) com rolagem e o andar atual visível ao abrir.
  - Cada andar é um `<g role="button" tabIndex={0}>` com `aria-label` ("Semana 45, Ouro, 6 de 7 dias, meta de treino batida"), Enter/Espaço e área de toque ≥ 44 px de altura (`fh` 46/58 do rascunho já serve).
  - Legenda: missões feitas / janela rachada / bandeira = treino.
- `Hero.tsx`, de cima para baixo: HeroCard → radar → torre mini.
- `App.tsx`: `onOpenWeek(start) => setReportStart(start)`, passado para o Herói. O `Report` existente abre por cima, e "Levar" continua avisando o Hoje (`onMoved`).
- E2E em `hero.spec.ts`:
  - semear 2 semanas antigas (uma Ouro, uma com missões feitas todos os dias e meta de treino)
  - a torre mostra os andares com o rótulo certo
  - tocar no andar Ouro abre o Quadro da semana daquela semana (título com o intervalo)
  - "ver tudo" abre a torre inteira

**Verificação:** e2e verde; screenshot da torre mini e da inteira comparado com o rascunho 4.

**Anti-padrões:** não desenhar a torre com `innerHTML`; não carregar o relatório de cada semana para pintar a torre (a cor vem de `/api/hero`).

## Phase 8 — Domingo: o andar novo sobe
> **How this serves the primary goal:** fecha a semana com uma recompensa visível: o andar sobe, o brasão pousa nele e, se for o caso, o herói aparece com a peça nova.

**Implementar** em `src/screens/MedalReveal.tsx`, **sem tirar** nada do que `reveal.spec.ts` confere:
- Carregar `api.heroWeek(start)` junto com `api.reportData(start)` (100-108). Se o herói falhar, a revelação segue como hoje.
- Acima do palco do brasão (`Won`, 298; `NoMedal`, 372), uma `CastleTower` mini com os 2 andares anteriores e o andar da semana:
  1. o andar novo **sobe** (`translateY(100%) → 0`, 700 ms, nova classe `.floor-rise` em `styles.css` ao lado de `.medal-in`, 427)
  2. o estandarte ganha a cor com o `medal-in`
  3. se `unlocked` tem peça: `HeroFigure` com a peça e "Nova peça: Elmo"; se tem título, "Novo título: Recordista"
  4. se o estágio mudou: "Agora você é Patrulheiro"
- Movimento reduzido: tudo parado no estado final (`reducedMotion`, 52-53, e o bloco `@media` de 445-450).
- E2E em `reveal.spec.ts`: um teste novo com semana semeada que destrava o Elmo mostra "Nova peça: Elmo" e o andar. Os 4 testes atuais continuam passando sem mudança.

**Verificação:** e2e de revelação verde, com e sem movimento reduzido.

**Anti-padrões:** não atrasar o botão "Ver detalhes da semana" por causa da animação; não bloquear a revelação se `/api/hero/week` falhar.

## Phase 9 — Verificação, deploy e GitHub
> **How this serves the primary goal:** põe o Herói no celular do Hugo, com os dados de verdade.

1. `npm.cmd run typecheck`, `npm.cmd test -- --maxWorkers=2` e `npm.cmd run e2e`, tudo verde (porta própria via `E2E_PORT` se outra cópia estiver rodando). Grep de anti-padrões:
   - `dangerouslySetInnerHTML` e `innerHTML` em `src/components/hero`
   - `lucide-react` fora do `Icon.tsx`
   - ids fixos `"hLeather"`/`"tBrick"`
   - `xp` como coluna em `migrations/0005_heroi.sql`
   - import de `src/components/workout` fora do Treino
2. Revisar no celular (390 e 375): as 4 abas, o Hoje com missões, o Herói, a trilha, a torre e a revelação de domingo.
3. Screenshots para o README (`docs/screenshots`) e uma linha no README.
4. **Deploy (com OK do Hugo):**
   - backup do D1 remoto (`wrangler d1 export`)
   - `wrangler d1 migrations apply agenda --remote` (0005; as sementes entram com a data de hoje)
   - `wrangler deploy`
   - rodar um sync do Agente Finanças para preencher `finance_days`
5. Commits em português no imperativo. **Push só com OK.** HANDOFF.md nunca vai para o commit.

## Fora deste plano
- Chefão semanal, inventário de cosméticos, loja, moeda extra e energia.
- Escudo de sequência (salvar 1 dia perdido por semana).
- Escolha de classe e outros heróis.
- Arte final em PNG pintada por estágio (o componente já permite trocar).
- Missões com dias da semana específicos (ex.: só seg/qua/sex) e lembretes/notificações.
- Classificação "você contra você" (melhor semana, melhor mês).
- Marcar missão de dia passado pela interface.
- Mudanças na tela do Treino (plano `2026-11-13-aba-treino.md`) e na tela do Financeiro (plano `2026-11-09-menu-e-financeiro.md`).
