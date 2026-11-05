# Guidelines review — capture + Ideas (reviewer 2) — Top findings

1. Missing visible focus: `focus:outline-none` on title/body/link/search/FIELD inputs (IdeaEditor.tsx:352,383,434; ConfirmSheet.tsx:21; FolderGrid.tsx:12); no `focus-visible:` ring on any button/card in all 7 files.
2. Small touch targets / low-contrast icon controls: pin buttons (IdeaList.tsx:140-152, IdeaEditor.tsx:317-326, opacity-35, no size, aria-label+aria-pressed double negation — keep label constant "Fixar no topo"); folder grid edit button ~20px (FolderGrid.tsx:191-200).
3. Form fields lack name/autoComplete="off"/spellCheck; autoFocus on mobile sheets/editor pops keyboard (IdeaEditor.tsx:342, ConfirmSheet.tsx:226,428, FolderGrid.tsx:389) → desktop only; placeholders need "…"/examples ("Título da ideia…", "Buscar ideias…", "Ex.: Estudos…", capture "Ex.: dentista amanhã às 15h…").
4. Announcements: IdeaEditor status flips "Salvando…" each keystroke (IdeaEditor.tsx:265-272,302) → show "Salvando…" only during request; errors role="alert" (IdeaEditor.tsx:305-316); Recorder live region must be persistent (Recorder.tsx:197-201); field errors role="alert"/aria-describedby (ConfirmSheet.tsx:233,322,346,395; FolderGrid.tsx:397); aria-busy skeletons need role="status" + "Carregando…" (Ideas.tsx:239, FolderGrid.tsx:99, IdeaList.tsx:93).
5. No hover states on desktop anywhere; mic is hold-only (add tap-to-toggle, Recorder.tsx:223-250); two h1 in wide mode (FolderGrid.tsx:48 / IdeaList.tsx:64 → h2); EmptyPane title should be heading (Ideas.tsx:37).

Other notable:
- CaptureBar: focus-within ring on form (153); aria-keyshortcuts="Control+K Meta+K"; nbsp in "Ctrl K"; submit hover/focus.
- ConfirmSheet: Salvar → "Salvando…" + spinner while busy (474); "Editar"→"Editar tudo"; role=radio needs arrow keys (351,369); long `said`/title break-words/text-pretty (200,243); label-in-name mismatch on chips.
- IdeaEditor: "✓ Resolvida" opens delete → clearer label ("Concluir e apagar"); emoji in buttons aria-hidden; link anchor `inline-flex truncate` overflow → `block truncate` (450); img width/height attrs (400); external link "(abre em nova aba)"; handle pagehide for draft.
- FolderGrid: search clear button; results live region; result long titles truncate; buttons "Salvando…" during busy; duplicate "Pastas" h2 + aria-label.
- IdeaList: img width/height; <time datetime>; FAB may overlap capture bar/last item; LinkChip contrast.
- Recorder: motion-reduce for level bars/scale; user-select none; "Ajustes do Safari" only on iOS; avoid right-[6.5rem] magic.
- Ideas: landmarks (<nav>/<main>), URL state for folder/idea (Back button on mobile), overscroll-behavior on panes.
