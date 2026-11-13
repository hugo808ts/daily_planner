# Prompts para o Orca (2026-11-13)

Base: branch `feat/aba-treino` (commits locais; nada no GitHub ainda).

## Preparar cada worktree (uma vez)
1. No Orca, crie o worktree **a partir do branch `feat/aba-treino`**, com um nome de branch próprio (sugestões abaixo).
2. Copie o arquivo `.dev.vars` da pasta principal (`MVPs\agenda\.dev.vars`) para a raiz do worktree. Ele é ignorado pelo Git; sem ele, os testes não rodam.
3. No terminal do worktree, rode `npm.cmd install`.
4. Use uma porta de teste diferente em cada worktree (PowerShell): `$env:E2E_PORT=5201` no A e `$env:E2E_PORT=5202` no B.
5. No máximo **2 agentes ao mesmo tempo** (limite da assinatura).

## Ordem
- **Em paralelo:** A (Treino) e B (Financeiro).
- **Depois de juntar A e B em `feat/aba-treino`:** C (plano do Herói/Torre). O Herói mexe na barra de baixo, então precisa do Treino pronto.

---

## Prompt A — Treino, fases 4, 5 e 6 (branch `feat/treino-telas`)
```
Projeto Agenda (React 19 + Vite + Tailwind 4, Worker Hono + D1). Windows: use npm.cmd e py (não python).
Leia e siga docs/superpowers/plans/2026-11-13-aba-treino.md. As fases 0 a 3 estão PRONTAS (banco, API, regras em shared/workout.ts, barra de baixo, esqueleto src/screens/Workout.tsx).
Faça as Fases 4, 5 e 6, uma de cada vez, nesta ordem, verificando cada uma antes da próxima.
Rascunhos aprovados a seguir no visual: docs/superpowers/mockups/treino-2026-11.html (telas 1, 3 e 4) e treino-sessao-2026-11.html (telas A, B, C e D).
Já existem arquivos iniciais da Fase 4 de uma tentativa interrompida: os métodos de treino em src/lib/api.ts, src/lib/useWorkout.ts, src/lib/workoutFormat.ts e src/components/workout/ (WeekStrip, TodayCard, ExerciseList). Revise e aproveite-os ou refaça-os.
Regras: ícones só via src/components/ui/Icon.tsx; nada de emoji; textos em pt-BR; peso em gramas inteiras; o cronômetro de descanso usa endsAt (não setInterval decrementando); não mexer nos arquivos do Financeiro (Finance.tsx, useFinance.ts, shared/finance.ts, worker/routes/finance.ts).
Testes: npm.cmd run typecheck; npm.cmd test -- --maxWorkers=2; npm.cmd run e2e (com $env:E2E_PORT=5201). Tudo verde ao final de cada fase.
Ao fim de cada fase: um commit local em português no imperativo (ex.: "Adiciona tela da semana do Treino"). NÃO faça push, NÃO faça deploy, NÃO mexa no D1 remoto.
No final, escreva um resumo curto: o que foi feito, os testes, os desvios do plano e as capturas de tela de 390px em test-results/.
```

## Prompt B — Financeiro, Fase 4 (branch `feat/financeiro-tela`)
```
Projeto Agenda (React 19 + Vite + Tailwind 4, Worker Hono + D1). Windows: use npm.cmd e py.
Leia e siga docs/superpowers/plans/2026-11-09-menu-e-financeiro.md, Fase 4 (tela Financeiro). As Fases 1 a 3 estão PRONTAS: shared/finance.ts com buildFinanceView e os tipos FinanceView/FinanceResponse, worker/routes/finance.ts (GET /api/finance?month=YYYY-MM), o menu lateral NavDrawer (prop syncLabel livre) e o placeholder src/screens/Finance.tsx.
O rascunho aprovado a seguir é docs/superpowers/mockups/financeiro-2026-11.html. Os dados de teste estão em tests/fixtures/finance-snapshot.json (hoje = 2026-11-09, via header X-Test-Today).
Já existem src/lib/useFinance.ts e os métodos de finanças em src/lib/api.ts e src/lib/format.ts (money/moneyParts): revise e use.
Decisões fixas: sem linha de teto mensal; contas fixas mostram HOJE / AMANHÃ / N DIAS ou "dia N" (nunca "PAGO"); ícones de categoria via Icon.tsx (sem emoji); um olho para esconder valores, salvo no localStorage; passar syncLabel ("Atualizado pelo agente às HH:MM") para o NavDrawer.
Não mexer nos arquivos do Treino (Workout.tsx, src/components/workout/, shared/workout.ts, worker/routes/workout.ts).
Escreva tests/e2e/finance.spec.ts. Testes: npm.cmd run typecheck; npm.cmd test -- --maxWorkers=2; npm.cmd run e2e (com $env:E2E_PORT=5202).
Commit local em português no imperativo. NÃO faça push, deploy, migração remota nem nada com service token. A Fase 5 é feita com o Hugo depois.
No final: resumo curto, testes e captura de 390px em test-results/financeiro.png.
```

## Prompt C — Herói/Torre: só o PLANO (depois de juntar A e B)
```
Projeto Agenda. Use a skill make-plan.
Objetivo: planejar (NÃO construir) a gamificação Herói/Torre aprovada.
As decisões estão em docs/superpowers/ideias/gamificacao-2026-11.md (rodadas 1 a 5). Os rascunhos aprovados são docs/superpowers/mockups/heroi-2026-11.html (Herói, Hoje com missões, Trilha) e heroi-castelo-2026-11.html (herói em 3 estágios e torre de castelo).
Pontos principais:
- Barra de baixo: Herói · Hoje · Treino · Ideias.
- Missões diárias: Ler 10 páginas e Meditar 10 min.
- 5 atributos: Física, Mental, Profissional, Financeira e Espiritual, com trilha por atributo.
- Torre: 1 andar por semana; a janela do dia acende quando todas as missões do dia foram feitas; tocar no andar abre o Quadro da semana; no domingo, o andar novo sobe.
- Tarefas da área Pessoal dão XP só para o nível.
- Ficam fora: chefão e inventário.
Use os padrões do código (shared/xp.ts, worker/xp.ts, shared/workout.ts, Medal.tsx).
Salve o plano em docs/superpowers/plans/ e faça um commit local. Sem push.
```

## Depois (com o Claude principal)
- Revisar e juntar `feat/treino-telas` e `feat/financeiro-tela` em `feat/aba-treino`.
- Fase 7 do Treino: verificar, fazer o backup do D1 remoto, aplicar as migrações 0003 e 0004, fazer o deploy e o push. **Tudo isso só com o OK do Hugo.**
- Fase 5 do Financeiro, junto com o Hugo: service token e `wrangler secret put SYNC_CLIENT_ID`.
