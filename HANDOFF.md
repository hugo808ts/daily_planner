# Agenda — estado final (28/10/2026)

**No ar:** https://agenda.hugo-agenda.workers.dev (login Cloudflare Access, código por e-mail). Testado no PC e no iPhone (instalado na tela de início, voz funcionando).

**Código:** branch `feat/agenda` (ainda não juntado no `main`). Testes: 108 de unidade + 24 de navegador.
**Banco:** D1 `agenda` (efd67906-…). Backup: `npx wrangler d1 export agenda --remote --output backup.sql`.
**Publicar de novo:** `npm run build` e `npx wrangler deploy` nesta pasta.

## Pendências pequenas (não bloqueiam o uso)
Ver o ledger `.superpowers/sdd/2026-10-28-agenda/progress.md` (linhas "Parked"): status bar escura no iOS, recarregar em loop se a config do login quebrar, índice único em moved_from_id, nota do dia perdida ao trocar de dia sem salvar, parser por regras ("amanhã na segunda").
