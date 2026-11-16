import { useEffect, useRef, useState, type MouseEvent } from "react";
import { addDays, isSunday, todayISO, weekStart } from "../shared/dates";
import type { Idea, Task } from "../shared/types";
import { CaptureBar } from "./components/CaptureBar";
import { NavDrawer, type Section } from "./components/NavDrawer";
import { Toast } from "./components/Toast";
import { ProgressPill } from "./components/game/ProgressPill";
import { IconButton } from "./components/ui/Button";
import { CalendarIcon, CheckIcon, DumbbellIcon, LightbulbIcon, MenuIcon, type IconComponent } from "./components/ui/Icon";
import { api } from "./lib/api";
import { useProgress } from "./lib/useProgress";
import { useWide } from "./lib/useWide";
import { Finance } from "./screens/Finance";
import { Ideas } from "./screens/Ideas";
import { MedalReveal } from "./screens/MedalReveal";
import { Report } from "./screens/Report";
import { Today } from "./screens/Today";
import { Workout } from "./screens/Workout";

type Tab = Section;

/** Hash de cada tela (#hoje / #ideias / #treino / #financeiro). Hash desconhecido cai no Hoje. */
const HASH: Record<Tab, string> = { today: "hoje", ideas: "ideias", workout: "treino", finance: "financeiro" };

/** Barra de baixo no celular; o resto (Financeiro, Quadro da semana…) fica no ☰. */
const TABS: { id: Tab; label: string; Icon: IconComponent }[] = [
  { id: "today", label: "Hoje", Icon: CalendarIcon },
  { id: "ideas", label: "Ideias", Icon: LightbulbIcon },
  { id: "workout", label: "Treino", Icon: DumbbellIcon },
];
const TAB_BY_HASH = new Map(Object.entries(HASH).map(([tab, hash]) => [`#${hash}`, tab as Tab]));

const tabFromHash = (): Tab => TAB_BY_HASH.get(window.location.hash) ?? "today";

/** Tela atual refletida no hash: o botão Voltar do navegador troca de tela. */
function useHashTab(): [Tab, (t: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const onChange = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const setTab = (t: Tab) => {
    if (t === tab) return;
    setTabState(t); // já neste render: o foco do menu volta ao ☰ da tela nova
    window.location.hash = HASH[t];
  };
  return [tab, setTab];
}

/** Selo NOVO do Financeiro some depois da primeira visita (conveniência deste aparelho). */
const FINANCE_SEEN = "agenda:finance-seen";
const readFinanceSeen = () => {
  try {
    return localStorage.getItem(FINANCE_SEEN) === "1";
  } catch {
    return false;
  }
};

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Primeira coisa focável: pula as barras e vai direto ao conteúdo. */
function SkipLink() {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); // o hash é das abas; não pode virar #conteudo
    const main = document.getElementById("conteudo");
    main?.focus();
    main?.scrollIntoView();
  };
  return (
    <a
      href="#conteudo"
      onClick={go}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:flex focus:items-center focus:rounded-xl focus:bg-accent-fill focus:px-4 focus:text-on-accent focus:shadow-lg"
    >
      Pular para o conteúdo
    </a>
  );
}

export default function App() {
  const [tab, setTab] = useHashTab();
  const [captured, setCaptured] = useState<Task | null>(null);
  const [capturedIdea, setCapturedIdea] = useState<Idea | null>(null);
  const [reportStart, setReportStart] = useState<string | null>(null);
  /** Domingo: a revelação da medalha vem antes do resumo. */
  const [revealStart, setRevealStart] = useState<string | null>(null);
  const [todayKey, setTodayKey] = useState(0);
  const wide = useWide();
  const { progress } = useProgress(weekStart(todayISO()), true);

  /** Mesmo destino do botão do Hoje: domingo revela a medalha da semana atual; nos outros dias, resumo da anterior. */
  const openReport = () => {
    const today = todayISO();
    const start = weekStart(today);
    if (isSunday(today)) setRevealStart(start);
    else setReportStart(addDays(start, -7));
  };

  /** Pedido vindo do Hoje (cartão de domingo ou link da semana passada). */
  const openFromToday = (start: string) => {
    if (isSunday(todayISO())) setRevealStart(start);
    else setReportStart(start);
  };

  // ===== Menu lateral =====
  const [menuOpen, setMenuOpen] = useState(false);
  const [todayCount, setTodayCount] = useState<string | null>(null);
  const [financeNew, setFinanceNew] = useState(() => !readFinanceSeen());
  /** "Atualizado pelo agente às HH:MM", vindo da tela do Financeiro. */
  const [financeSync, setFinanceSync] = useState<string | null>(null);
  /** Quem abriu o menu (o ☰ desta tela), para o foco voltar a ele. */
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  const openMenu = (e: MouseEvent<HTMLButtonElement>) => {
    opener.current = e.currentTarget;
    setMenuOpen(true);
    // "N/M" das tarefas de hoje; é um extra, então falha em silêncio.
    const today = todayISO();
    api
      .week(weekStart(today))
      .then(({ tasks }) => {
        const mine = tasks.filter((t) => t.date === today);
        setTodayCount(mine.length ? `${mine.filter((t) => t.doneAt).length}/${mine.length}` : null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (menuOpen) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    // Outro diálogo abriu no lugar (Quadro da semana): ele cuida do foco.
    if (document.querySelector("dialog[open]")) return;
    const back = opener.current?.isConnected ? opener.current : document.querySelector<HTMLElement>("[data-menu-button]");
    back?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (tab !== "finance" || !financeNew) return;
    setFinanceNew(false);
    try {
      localStorage.setItem(FINANCE_SEEN, "1");
    } catch {
      /* sem armazenamento: o selo volta na próxima visita */
    }
  }, [tab, financeNew]);

  const menuButton = (
    <IconButton
      label="Abrir menu"
      data-menu-button
      variant="secondary"
      aria-haspopup="dialog"
      aria-expanded={menuOpen}
      icon={<MenuIcon size={22} strokeWidth={2.2} className="drop-shadow-[0_0_4px_rgb(136_239_27/0.35)]" />}
      onClick={openMenu}
    />
  );

  const drawer = menuOpen && (
    <NavDrawer
      current={tab}
      progress={progress}
      todayCount={todayCount}
      financeNew={financeNew}
      syncLabel={financeSync}
      onNavigate={setTab}
      onOpenWeek={() => setReportStart(weekStart(todayISO()))}
      onClose={() => setMenuOpen(false)}
    />
  );

  const reveal = revealStart && (
    <MedalReveal
      start={revealStart}
      onClose={() => setRevealStart(null)}
      onDetails={(s) => {
        setRevealStart(null);
        setReportStart(s);
      }}
    />
  );

  const report = reportStart && (
    <Report start={reportStart} onClose={() => setReportStart(null)} onMoved={() => setTodayKey((k) => k + 1)} />
  );

  if (wide) {
    // Computador: barra no topo; o dia fixo à esquerda (com a captura embaixo) e Ideias, Treino ou Financeiro no resto.
    return (
      <div className="safe-x grid h-dvh grid-rows-[52px_minmax(0,1fr)] overflow-hidden">
        <SkipLink />
        <header className="flex items-center gap-3 glass-quiet rounded-none border-x-0 border-t-0 pr-5 pl-2">
          {menuButton}
          <span aria-hidden className="grid size-[26px] place-items-center rounded-lg fill-neon">
            <CheckIcon size={15} strokeWidth={2.6} />
          </span>
          <span translate="no" className="font-display text-base font-bold">
            Agenda
          </span>
          <span className="flex-1" />
          <ProgressPill progress={progress} onClick={openReport} />
          <kbd aria-hidden className="rounded-md border border-line px-1.5 py-px font-sans text-[12px] whitespace-nowrap text-muted">
            {isMac() ? "⌘ K" : "Ctrl K"}
          </kbd>
        </header>
        <div className="grid min-h-0 grid-cols-[380px_minmax(0,1fr)]">
          <aside data-testid="today-pane" aria-label="Dia" className="pane glass-quiet flex h-full flex-col rounded-none border-y-0 border-l-0">
            <div className="flex-1">
              <Today key={todayKey} captured={captured} onOpenReport={openFromToday} wide />
            </div>
            <CaptureBar inline onTaskSaved={setCaptured} onIdeaSaved={setCapturedIdea} />
          </aside>
          <main id="conteudo" tabIndex={-1} className="min-h-0 min-w-0 overflow-hidden focus:outline-none">
            {tab === "finance" ? (
              <Finance wide onSyncLabel={setFinanceSync} />
            ) : tab === "workout" ? (
              <Workout wide />
            ) : (
              <Ideas wide captured={capturedIdea} onTaskSaved={setCaptured} />
            )}
          </main>
        </div>
        {drawer}
        {report}
        {reveal}
        <Toast />
      </div>
    );
  }

  return (
    <div className="safe-x min-h-dvh">
      <SkipLink />
      <main id="conteudo" tabIndex={-1} className="focus:outline-none">
        {tab === "today" ? (
          <Today key={todayKey} captured={captured} onOpenReport={openFromToday} menu={menuButton} />
        ) : tab === "ideas" ? (
          <Ideas captured={capturedIdea} onTaskSaved={setCaptured} menu={menuButton} />
        ) : tab === "workout" ? (
          <Workout menu={menuButton} />
        ) : (
          <Finance menu={menuButton} onSyncLabel={setFinanceSync} />
        )}
      </main>

      {(tab === "today" || tab === "ideas") && <CaptureBar onTaskSaved={setCaptured} onIdeaSaved={setCapturedIdea} />}

      {/* No Financeiro (só pelo ☰) a barra continua, sem item marcado. */}
      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/70 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-md">
          {TABS.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => setTab(id)}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 font-mono text-[10.5px] tracking-[0.12em] uppercase transition-colors duration-150 focus-visible:-outline-offset-4 motion-reduce:transition-none ${
                  on ? "font-semibold text-lime" : "font-medium text-muted hover:text-ink active:text-ink"
                }`}
              >
                {on && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-lime glow-lime" />}
                <Icon size={20} strokeWidth={on ? 2.2 : 1.8} className={on ? "drop-shadow-[0_0_6px_rgb(136_239_27/0.8)]" : ""} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {drawer}
      {report}
      {reveal}
      <Toast />
    </div>
  );
}
