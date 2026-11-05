# Guidelines review — core + Today (reviewer 1) — Top findings

1. Report.tsx:64 hand-rolled role="dialog" overlay: no focus move/trap, no Escape, no inert bg, no overscroll contain, not in history → native <dialog>/showModal like TaskSheet; Back button closes it.
2. Weak/absent focus on text fields: TaskSheet.tsx:22, DayNote.tsx:78 (`focus:outline-none`) → focus-visible ring.
3. Low contrast: done titles text-ink/45 (TaskRow.tsx:66), 80% white 11px on purple (WeekStrip.tsx:42), tiny muted 11px (WeekReportView.tsx:37,46), unchecked box border ink/45 (TaskRow.tsx:41), AskSheet Cancel bg-bg on bg-surface invisible (AskSheet.tsx:56).
4. styles.css:78,88 global overscroll-behavior none kills pull-to-refresh on touch → scope to pointer:fine; no hover: states anywhere (styles.css:100) on desktop; user-select:none on all buttons (110-112) blocks copying titles.
5. Silent discard of edits: TaskSheet backdrop/Esc/Fechar (121-123), DayNote Esc/Cancelar (74,89); Toast 5s "Desfazer" no pause on hover/focus (Toast.tsx:45); repeated "→ esta semana" buttons unlabeled (WeekReportView.tsx:71).

Other notable:
- No skip link (App.tsx); tab/report not in URL; Report second h1; Today "Carregando" div needs role=status + "…" (Today.tsx:143, Report.tsx:88).
- Decorative glyphs "›","‹","→","✓","📊" and area emoji not aria-hidden (Today:115, Report:73-99, SundayCard:9-10, TaskRow:75, WeekReportView:69).
- WeekStrip day state color-only → sr summary per day; hardcoded #ffb4b6 (20).
- ScoreBar text needs aria-live; nbsp in "0 de 4".
- TaskRow role=checkbox label static even when done; long titles break-words.
- TaskSheet: names/autoComplete; radio arrow keys; "Salvando…" on save; delete confirm silent.
- Report dates: use Intl instead of hardcoded months (Report.tsx:9-10); percent via Intl; nbsp in date ranges.
- Body scroll not locked behind open sheets (styles.css:137-149); scroll-padding-bottom for fixed bars; reduced-motion for transitions/scale; text-balance on headings; preload fonts; brand translate="no".
