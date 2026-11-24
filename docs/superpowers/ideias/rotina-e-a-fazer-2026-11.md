# Rotina do dia + lista "A fazer" (decidido em 2026-11-23)

## Problema
Hoje toda tarefa precisa de um dia (`tasks.date NOT NULL`) e o XP conta no dia da tarefa (`worker/xp.ts`, `date(date, ...)`), não no dia em que foi feita. Quem esquece de lançar ou faz em outro dia tem uma contagem irreal, e é preciso relançar tudo todo dia.

## Decisões do Hugo
1. **Rotina do dia = Missões do Herói.** Reaproveitar `missions`/`mission_checks` (repetem todo dia, editáveis, XP 5/10/20/35/50 por check). Na tela, chamar de "Rotina do dia". Já construído no branch `feat/heroi-telas` (fase 5, commit ebeba5e), ainda não publicado.
2. **Lista "A fazer" com data opcional.**
   - Sem data: fica na lista até ser marcada. Não existe "atrasada" nem "não feita".
   - Com data/hora (compromisso, ex.: dentista quinta 15h): aparece destacada naquele dia.
   - O que sobrou fica disponível para o dia seguinte, sem precisar relançar.
3. **XP no dia em que marca** (`done_at`, fuso America/Sao_Paulo) daqui para frente. As tarefas antigas e os brasões passados não mudam.

## Próximos passos
1. Rascunho visual da tela Hoje (Rotina do dia em cima, A fazer embaixo, compromissos do dia destacados) para o OK do Hugo.
2. Plano (make-plan): migração com `date` opcional, regra de XP por `done_at` a partir de uma data de corte, captura por IA sem data quando a frase não tiver dia, placar do dia e resumo semanal.
