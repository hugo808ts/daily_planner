# Plano — Gamificação da Agenda (XP, nível, medalhas)

## Primary goal
Ao marcar uma tarefa como feita, o Hugo vê na hora quanto XP ganhou. A tela Hoje mostra o nível e a medalha da semana em andamento. No domingo, uma revelação em tela cheia, no estilo de jogo, mostra a medalha conquistada (Bronze → Supremo), o XP e se ele subiu de nível.

Fontes: rascunho aprovado `docs/superpowers/mockups/gamificacao-2026-11.html`; pesquisa em `scratchpad/research-*.md`; mapa do código (Fase 0, abaixo).

## Decisões (fixas)
- Dificuldade por tarefa: `low` (↓ Baixa, 10 XP), `medium` (= Média, 25 XP), `high` (↑ Alta, 50 XP). O padrão é `medium`, e as tarefas antigas viram `medium`.
- Tarefa feita soma o XP dela, atribuído ao dia (`date`) da tarefa. Tarefa não feita não soma nem tira. Desmarcar uma tarefa feita remove o XP dela: é correção, não punição.
- Medalha da semana (seg–sáb, pela soma de XP): Bronze 1–149 · Prata 150–299 · Ouro 300–499 · Diamante 500–749 · Supremo 750+. Semana com 0 XP fica sem medalha. O Supremo depende só do XP.
- Nível: soma de todo o XP, domingo incluído. O nível só sobe (exceto pela correção ao desmarcar). Para passar do nível n ao n+1 são necessários `round(300 × 1,2^(n−1))` XP: do 1 para o 2, 300; do 2 para o 3, 360; e assim por diante.
- Tarefas de domingo contam para o nível e não contam para a medalha.
- Fora do escopo: grade de medalhas das semanas, sequências, conquistas e sons.

## Fase 0 — Descoberta (feita)
**How this serves the primary goal:** mapeia os lugares exatos que precisam mudar, para nenhuma fase inventar API.
- Modelo de tarefa: `migrations/0001_init.sql:1-10`; `shared/types.ts` (Task 3-13, CaptureResult 41-49, WeekReport 54-63); `worker/db.ts` (TaskRow 3-13, rowToTask 15-27, insertTask 34-41 e updateTask 43-48, que listam as colunas explicitamente); `worker/routes/tasks.ts` (areaSchema 17, createSchema 24-29, patchSchema 30-36, literal do POST 66-76, merge do PATCH 88-96; o move copia a tarefa por spread, então leva a dificuldade junto); `src/lib/api.ts` (NewTask/TaskPatch 22-35).
- Captura: `worker/ai.ts` (SCHEMA 16-27, sanitize 29-41, prompt 52-59, modelo llama-3.1-8b com json_schema); `shared/rules.ts` (parseCapture 114-138, AREA_WORDS 14-18); `src/screens/Ideas.tsx:222-232` (literal de CaptureResult).
- Telas: `ConfirmSheet.tsx` (Field 23, Chip 47-62, RadioGroup 65-82, saveTask 145-148, chips 297-343, seletor de área 402-423); `TaskSheet.tsx` (AREA_OPTIONS 27, onAreaKey 64-72, save 83-101, fieldset de área 296-324); `TaskRow.tsx` (linha de detalhes 23-29); `Today.tsx` (cabeçalho 111-124, SundayCard 125, header 128-137, toggle otimista 58-71); `Report.tsx` (dialog nativo 71-80); `WeekReportView.tsx`; `SundayCard.tsx`; `Toast.tsx`; padrão de `ui/AreaTag.tsx`; `ui/Icon.tsx` (sem ícones de troféu, estrela ou raio ainda).
- Relatório: `shared/report.ts` `computeWeekReport(tasks,start,now,copied)`; `worker/routes/report.ts`. Ainda não existe consulta de histórico nem de XP total.
- Testes: `tests/unit/report.test.ts` (o helper `mk()` lista todos os campos); `tests/worker/capture.test.ts` (asserts com `toEqual` sobre o CaptureResult inteiro); `rules.test.ts`; e2e em 5 specs (seed por `/api/tasks`, `x-test-today`). Migrações aplicadas automaticamente no vitest e no e2e.
- Estilos: não há tokens de medalha nem gradientes. Só existe o keyframe `sheet-up`. O reduced-motion global já cobre animações novas.

## Fase 1A — Dados e regras do XP ⚠️ ATENÇÃO (roda em paralelo com a 1B)
**How this serves the primary goal:** sem o campo de dificuldade e sem as contas de XP, nível e medalha, nenhuma tela tem o que mostrar.
Arquivos: `migrations/0002_difficulty.sql`, `shared/types.ts`, novo `shared/xp.ts`, `shared/report.ts`, `worker/db.ts`, `worker/routes/tasks.ts`, `worker/routes/report.ts`, nova rota `GET /api/progress`, `src/lib/api.ts`, testes de unidade e de worker.
1. Migração: `ALTER TABLE tasks ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'medium'` (seguir o estilo de `0001_init.sql`).
2. `shared/xp.ts`: `Difficulty`, `DIFFICULTIES`, `XP_BY_DIFFICULTY`, `taskXp(task)`, `MEDALS` (nome e limites acima), `medalFor(xp)`, `nextMedal(xp)` → `{medal, missing}`, `xpToNext(level)`, `levelFromXp(total)` → `{level, into, needed}`.
3. Adicionar `difficulty` a Task, TaskRow, rowToTask, insertTask, updateTask, ao literal do POST e ao merge do PATCH; `difficultySchema = z.enum(DIFFICULTIES)`, opcional na criação (padrão `medium`) e no PATCH. Atualizar NewTask e TaskPatch.
4. `computeWeekReport` passa a devolver também `xp`, `medal`, `byDifficulty` (feitas por dificuldade), `bestDay`.
5. `GET /api/report` passa a incluir `previousXp` (semana anterior), `bestWeekXp` (maior XP de uma semana seg–sáb em todo o histórico) e `level` (`levelFromXp` do total) com `levelBefore` (nível antes desta semana, para o "Subiu de nível").
6. `GET /api/progress?start=` → `{ totalXp, level, into, needed, weekXp, medal, next: {medal, missing} }`, para a tela Hoje.
**Verificação:** testes de unidade de `shared/xp.ts` (limites exatos: 149 → Bronze, 150 → Prata, 750 → Supremo, 0 → nenhuma; levelFromXp(299) = 1, (300) = 2, (660) = 3); testes de worker (criar sem dificuldade → medium; PATCH da dificuldade; move copia a dificuldade; report e progress com números conhecidos; domingo soma no nível e não na medalha); ajustar o `mk()` e os `toEqual` da captura.
**Anti-padrões:** não gravar XP numa coluna (é sempre calculado); não usar SELECT de colunas sem a dificuldade; não mudar a regra do move.

## Fase 1B — Peças visuais do jogo (roda em paralelo com a 1A)
**How this serves the primary goal:** as medalhas e os chips de dificuldade são o que dá a cara de jogo, e as três frentes da Fase 2 usam essas peças.
Arquivos: novos `src/components/game/Medal.tsx`, `src/components/ui/DifficultyTag.tsx`, `src/components/game/XpPop.tsx`, `src/components/game/LevelBar.tsx`, tokens e keyframes em `src/styles.css`, ícones novos em `ui/Icon.tsx` (Trophy, Star, Sparkles, ChevronsUp e similares do lucide-react).
1. `Medal({tier, size, glow?})`: copiar os 5 SVGs do rascunho (`gamificacao-2026-11.html`, `<symbol id="m-…">`) com ids de gradiente únicos por instância (`useId`), `role="img"` e `aria-label` "Medalha Ouro", e `MedalPlaceholder` para semana sem medalha.
2. `DifficultyTag({difficulty, withXp?})`: no padrão do AreaTag, com seta ↓ = ↑ (ícone lucide), rótulo e cores AA (verde, âmbar, vermelho) nos dois temas. Exportar `difficultyMeta()`.
3. `LevelBar({level, into, needed})`: selo do nível com barra animada. `XpPop`: o "+25 XP" que sobe e some, com `aria-live`.
4. Tokens `--medal-*`, gradientes e keyframes (`xp-pop`, `medal-in`, `rays-spin`, `count-up` via JS), respeitando o reduced-motion.
**Verificação:** typecheck e build; uma página de teste temporária ou story com as 5 medalhas em claro e escuro, com captura comparada ao rascunho; nenhum id de gradiente duplicado com duas medalhas na mesma tela.
**Anti-padrões:** não usar emoji como ícone; não usar bibliotecas de animação (só CSS e requestAnimationFrame); não copiar a arte da referência, só o estilo.

## Fase 2 — Três frentes em paralelo (depois da 1A + 1B; cada uma na sua cópia e porta de e2e)
**How this serves the primary goal:** coloca o XP nos três lugares onde o Hugo o percebe: ao capturar, ao fazer e no domingo.
- **2A Captura (cópia `agenda-cap`, porta 5341)** — `worker/ai.ts` (difficulty no SCHEMA, required, prompt "low/medium/high; na dúvida medium", sanitize com padrão medium), `shared/rules.ts` (heurística simples: "urgente/importante/prova/entregar/apresentar" → high, "rápido/só/comprar/ligar" → low, senão medium), `ConfirmSheet.tsx` (Field "difficulty", chip DifficultyTag, RadioGroup com os 3 níveis, botão "Salvar · 50 XP"), `Ideas.tsx:222-232` (literal), testes de captura e regras. ⚠️ Verificar no deploy se o llama aceita o enum novo; se a IA falhar, cai nas regras.
- **2B Hoje (cópia `agenda-hoje`, porta 5342)** — `Today.tsx` (LevelBar e chip "Semana em Prata · faltam 85 para Ouro" via `/api/progress`, recarregado após cada toggle), `TaskRow.tsx` (DifficultyTag + XP), `XpPop` no toggle para feita (não ao desmarcar), `TaskSheet.tsx` (seletor de dificuldade com setas do teclado, no padrão do de área), `useWeek` sem mudança de contrato, e2e `today.spec`. Não mexe em SundayCard nem App.tsx.
- **2C Domingo (cópia `agenda-domingo`, porta 5343)** — novo `src/screens/MedalReveal.tsx` (dialog nativo em tela cheia no padrão do Report: raios, medalha entrando, XP contando até o total, "Subiu para o nível N", "Melhor semana", 3 números, botão "Ver detalhes da semana" que abre o Report), `SundayCard.tsx` (mostra a medalha pequena e abre a revelação), `Report.tsx`/`WeekReportView.tsx` (cabeçalho com a medalha, XP da semana, feitas por dificuldade e "vs semana passada"), `App.tsx` (botão da barra superior abre a revelação no domingo e o resumo nos outros dias), e2e `report.spec`.
**Verificação (cada frente):** `npm test`, `npm run typecheck`, `npm run build`, o e2e da frente; capturas 390×844 claro e escuro e 1440×900 claro.

## Fase 3 — Juntar, testar e publicar ⚠️ ATENÇÃO
**How this serves the primary goal:** só tem valor quando estiver no ar, no iPhone.
1. Juntar 2A, 2B e 2C no `main`. Conflitos esperados: `tests/e2e/*.spec`, `src/lib/api.ts` (ordem de métodos) e talvez `styles.css`.
2. Rodar a suíte inteira duas vezes. Tirar capturas finais de Hoje, captura, revelação (Ouro e Supremo) e Report.
3. `wrangler d1 migrations apply agenda --remote` (aplica a 0002 no banco real, só adicionando coluna: seguro, as tarefas existentes viram Média). Depois build e `wrangler deploy`.
4. Conferir em produção: criar uma tarefa Alta, marcar como feita, ver "+50 XP" e o nível; a resposta da captura com `source: "ai"` e a dificuldade preenchida.
5. GitHub: varredura de segredos, resumo e OK do Hugo antes do push (regra do Agente GitHub), commit em português.

## Verificação final
- Grep sem emoji como ícone em `src/`; nenhuma coluna `xp` no banco; `difficulty` presente em todos os pontos listados na Fase 0.
- Unit, worker e e2e verdes duas vezes; capturas batendo com o rascunho.
- Em produção: medalha e nível corretos para uma semana de teste conhecida.

## Onde acelera / onde exige atenção
- **Acelera:** a 1A e a 1B rodam ao mesmo tempo (arquivos separados); depois as 2A, 2B e 2C rodam ao mesmo tempo, em cópias separadas com portas diferentes; o que não depende de nada (capturas, revisão) roda junto.
- **Atenção:** 1A (base de tudo: contas de XP e migração; erro aqui contamina as telas), aplicação da migração no banco real (Fase 3), o enum de dificuldade aceito pela IA da Cloudflare, e a junção final (3 frentes em telas vizinhas).
