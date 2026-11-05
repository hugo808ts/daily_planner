# Primitivas de UI (redesign 2026-11)

Base visual: `docs/superpowers/mockups/redesign-2026-11.html` (telas "Depois").

## Regras

- O botão principal é `Button variant="primary"` (roxo). No máximo um por tela ou folha.
- Apagar ou descartar usa `variant="danger"` (texto vermelho com borda suave).
- Nunca use emoji como ícone. Os ícones vêm do lucide via `Icon.tsx`. Não importe `lucide-react` direto.
- O foco visível é obrigatório. Não use `focus:outline-none` sem colocar um `focus-visible:` no lugar. O global já desenha um anel de 2 px roxo com afastamento.
- O alvo de toque tem no mínimo 44×44 px. Para ícones, use `IconButton`: o visual fica entre 32 e 40 px e a área de toque é sempre de 44 px.
- `hover:` do Tailwind 4 só age com mouse (`@media (hover:hover)`). Use à vontade.
- Texto de apoio tem no mínimo 12,5 px: use `text-meta`, ou `meta` para tamanho e cor `--muted`.
- `user-select:none` fica só em ícones e chips, com a classe `no-select`. Títulos continuam copiáveis.
- Animações têm `motion-reduce:`. O CSS global também zera transições quando o sistema pede movimento reduzido.

## Icon.tsx

Cada ícone aceita as props do lucide e mais `label?`. O padrão é `size=20`, `strokeWidth=2` e `aria-hidden`. Com `label`, o ícone vira `role="img"` com aria-label. Dentro de um botão, quem dá o nome é o botão.

Ícones disponíveis:

- Navegação: `CalendarIcon`, `LightbulbIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `ArrowRightIcon`, `CloseIcon`, `MoreIcon`.
- Captura: `MicIcon`, `SendIcon` (seta para cima), `PlusIcon`, `SearchIcon`.
- Ações: `CheckIcon`, `TrashIcon`, `PencilIcon`, `PinIcon`, `PinOffIcon`, `UndoIcon`, `CalendarPlusIcon`, `SpinnerIcon`, `SquareIcon`.
- Conteúdo: `LinkIcon`, `ExternalLinkIcon`, `ReportIcon` (gráfico de linha), `ChartIcon`, `ClockIcon`, `NoteIcon`, `VideoIcon`, `FolderIcon`, `FolderPlusIcon`.
- Áreas: `BriefcaseIcon`, `BookOpenIcon`, `HeartIcon`.

Tipo exportado: `IconComponent`.

Precisa de outro ícone? Acrescente em `Icon.tsx` com `make(Nome, "NomeIcon")`.

## Button.tsx

`Button` aceita:

- `variant`: `"primary" | "secondary" | "ghost" | "danger"`. O padrão é `secondary`.
- `size`: `"md"` (44 px, padrão) ou `"sm"` (40 px com mouse, 44 px no toque).
- `icon?: ReactNode`, por exemplo `<PlusIcon size={18} />`.
- `busy?`: mostra um spinner, desabilita o botão e marca `aria-busy`.
- `busyLabel?`: texto durante o `busy`, por exemplo `"Salvando…"`.
- `ref?` e todos os atributos de `<button>`. O `type` padrão é `"button"`.

`IconButton` aceita:

- `label` (obrigatório): vira `aria-label` e `title`.
- `icon: ReactNode`.
- `variant`: o padrão é `ghost`.
- `size`: `"sm"` (32), `"md"` (36) ou `"lg"` (40, padrão).
- `busy?`, `tooltip?` (padrão `true`) e `ref?`.

Para botões de alternância, passe `aria-pressed` e mantenha o `label` constante. Exemplo: "Fixar no topo".

```tsx
<Button variant="primary" busy={saving} busyLabel="Salvando…">Salvar</Button>
<Button variant="danger" icon={<TrashIcon size={18} />}>Apagar</Button>
<IconButton label="Gravar áudio" icon={<MicIcon />} />
```

## AreaTag.tsx

`AreaTag` mostra um ponto colorido e o nome da área (Trabalho, Faculdade, Pessoal). Props:

- `area`.
- `dotOnly?`: deixa só o ponto. O nome fica em `sr-only`.
- `muted?`: para tarefa feita.
- `className?`.

Também exporta:

- `areaMeta(area)`: devolve `{ area, label, dotClass, textClass, color, Icon }`, para seletores e estilos.
- `AREA_ORDER`: a ordem das áreas.
- O tipo `AreaMeta`.

## Tokens (src/styles.css)

Cores, também disponíveis como classes Tailwind (`bg-*`, `text-*`, `border-*`). Cada uma tem variante escura com contraste AA.

- Base: `bg`, `surface`, `ink`, `muted`, `line`, `dot`.
- Roxo: `accent`, `accent-soft`, `accent-ink` (texto sobre `accent-soft`), `accent-fill` com `on-accent`.
- Vermelho: `danger`, `danger-soft`, `danger-line`, `danger-ink` (texto vermelho), `danger-fill`.
- Nota: `note`, `note-ink`.
- Áreas: `work`, `school` e `personal` são cores de ponto. As variantes `*-ink` são para texto.

Utilitários:

- `text-meta` e `meta`: texto de apoio.
- `no-select`: impede seleção em ícones e chips.
- `pb-fixed-bars`: espaço para captura e abas no celular. Usa a variável `--fixed-bars-h`, que vale 0 no computador.
- `pane`, `safe-x`, `safe-y`.

Comportamentos globais:

- `:focus-visible` desenha o anel de foco.
- `overscroll-behavior:none` vale só com `pointer:fine`.
- A página não rola enquanto houver um `dialog[open]`.
- Títulos usam `text-wrap:balance`.
- `scroll-padding-bottom` compensa as barras fixas.
