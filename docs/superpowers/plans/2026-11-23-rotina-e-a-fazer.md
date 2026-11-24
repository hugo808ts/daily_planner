# Plano: Rotina do dia + lista "A fazer"

**Primary goal:** o Hugo abre o Hoje e vê as rotinas que se repetem sozinhas e uma lista única de coisas a fazer, sem precisar relançar nada todo dia. Cada coisa marcada dá XP no dia em que foi feita, então a contagem da semana mostra o que ele realmente fez.

Decisões: docs/superpowers/ideias/rotina-e-a-fazer-2026-11.md. Rascunho aprovado: docs/superpowers/mockups/rotina-afazer-2026-11.html.

Regras de execução: **1 ajudante por vez** (PC de 6 GB). Durante o trabalho só `npx tsc --noEmit --singleThreaded` e vitest `--maxWorkers=1`; e2e uma vez no fim de cada fase (`$env:E2E_PORT=5210`). Commit por fase, em português. Push e deploy só no fim.

---

## Phase 0: O que já existe (levantado em 2026-11-23)
> **How this serves the primary goal:** garante que o plano parte do código real e reaproveita o que já foi feito.

- `migrations/0001_init.sql:1-12`: `tasks.date TEXT NOT NULL`, `done_at`, `moved_from_id`. `0002_difficulty.sql` adiciona `difficulty`.
- `shared/types.ts:5-16`: `Task.date: string`. `CaptureResult.date: string | null` (a IA já devolve null quando a frase não tem dia).
- `worker/routes/tasks.ts`: `GET /api/week` (52), `POST /api/tasks` (66), `PATCH /api/tasks/:id` (86), `DELETE` (107), `POST /api/tasks/:id/move` (114).
- `worker/xp.ts:30-37`: XP das tarefas agrupado por `date(date, ...)`, o dia da tarefa. Este é o ponto a mudar.
- `shared/status.ts`: `taskStatus` (pendente, feita, atrasada, não feita) e `dayScore`. `shared/report.ts`: `computeWeekReport`.
- **Rotina = Missões** (`missions`, `mission_checks`, `shared/hero.ts`, `/api/missions`), backend já em produção. A tela das missões no Hoje está no branch `feat/heroi-telas`, commit ebeba5e (`src/components/missions/`, `src/lib/useMissions.ts`, `tests/e2e/missions.spec.ts`).
- Anti-padrões: não gravar XP (ele é sempre calculado); não usar `new Date()` sem o fuso America/Sao_Paulo (usar `shared/dates.ts`); ícones só via `Icon.tsx`; nada de emoji.

## Phase 1: Banco e API com data opcional
> **How this serves the primary goal:** permite guardar uma tarefa sem dia, que fica na lista até ser feita.

- Migração `0006_afazer.sql`: recriar `tasks` com `date TEXT NULL`, copiando os dados (o SQLite não altera NOT NULL; seguir o padrão de recriar a tabela). Manter os índices.
- Criar uma tabela de configuração, ou uma constante em `shared/xp.ts`, com `XP_DONE_AT_FROM = '2026-11-24'` (data de corte; a partir dela o XP conta por `done_at`).
- `shared/types.ts`: `Task.date: string | null`.
- `POST/PATCH /api/tasks`: aceitar `date: null` (Zod `.nullable()`).
- Nova rota `GET /api/todo?date=`: devolve as tarefas sem data e não feitas, as sem data feitas naquele dia, e os compromissos com `date = hoje`.
- **Verificar:** testes do worker para criar, editar e listar sem data, e para a migração preservar as tarefas antigas.

## Phase 2: XP no dia em que marca
> **How this serves the primary goal:** faz a contagem do dia e da semana refletir o que foi feito de verdade.

- `worker/xp.ts`: o dia da tarefa passa a ser `CASE WHEN date(done_at, local) >= XP_DONE_AT_FROM THEN dia local de done_at ELSE date END`. Converter `done_at` (UTC) para America/Sao_Paulo com o mesmo deslocamento usado em `shared/dates.ts`.
- `shared/report.ts` e `computeWeekReport`: tarefas sem data contam no dia de `done_at`; pendentes sem data **não** viram "não feita".
- `shared/status.ts`: uma tarefa sem data nunca fica "atrasada".
- **Verificar:** testes unitários com uma semana antiga (não muda) e uma nova (conta no dia do check); o brasão de semanas já fechadas fica igual.

## Phase 3: Tela Hoje (Rotina + A fazer)
> **How this serves the primary goal:** é a tela que o Hugo usa todo dia.

- Trazer a parte de missões do commit ebeba5e (`git cherry-pick` ou copiar `src/components/missions/` e `useMissions.ts`), sem a barra do Herói da fase 4. Título da seção: "Rotina do dia".
- Seção "A fazer": a lista de `/api/todo`. Compromisso de hoje em destaque (laranja `--warn`) com hora; "na lista há N dias" quando passar de 1 dia; os feitos de hoje riscados.
- Folha de adicionar (`TaskSheet.tsx`): seletor "Sem data" (padrão) e "Dia certo". Captura por IA: frase sem dia → sem data.
- Topo: "+N XP hoje" (rotina + feitos de hoje).
- Seguir `docs/superpowers/mockups/rotina-afazer-2026-11.html` (telas 1 e 2).
- **Verificar:** e2e `tests/e2e/afazer.spec.ts` (adicionar sem data, marcar e ver o XP, a tarefa continua no dia seguinte, compromisso em destaque) e captura de 390 px.

## Phase 4: Verificar e publicar
> **How this serves the primary goal:** coloca a mudança no celular do Hugo sem perder dados.

- typecheck, vitest e e2e completos.
- Backup do D1 remoto, `wrangler d1 migrations apply agenda --remote` (0006), build, deploy.
- Varredura de segredos, commit, push para `feat/aba-treino` e `main`.
- Conferir no app: criar uma tarefa sem data, marcar e ver o XP do dia.

## Fora agora
Herói (tela, torre, domingo) · editar rotina por dia da semana · repetir tarefas da lista · recalcular o XP de semanas antigas.
