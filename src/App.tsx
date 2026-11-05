import { useEffect, useState, type MouseEvent } from "react";
import { addDays, isSunday, todayISO, weekStart } from "../shared/dates";
import type { Idea, Task } from "../shared/types";
import { CaptureBar } from "./components/CaptureBar";
import { Toast } from "./components/Toast";
import { ProgressPill } from "./components/game/ProgressPill";
import { CalendarIcon, CheckIcon, LightbulbIcon, type IconComponent } from "./components/ui/Icon";
import { useProgress } from "./lib/useProgress";
import { useWide } from "./lib/useWide";
import { Ideas } from "./screens/Ideas";
import { MedalReveal } from "./screens/MedalReveal";
import { Report } from "./screens/Report";
import { Today } from "./screens/Today";

type Tab = "today" | "ideas";

const TABS: { id: Tab; label: string; hash: string; Icon: IconComponent }[] = [
  { id: "today", label: "Hoje", hash: "hoje", Icon: CalendarIcon },
  { id: "ideas", label: "Ideias", hash: "ideias", Icon: LightbulbIcon },
];

const tabFromHash = (): Tab => (window.location.hash === "#ideias" ? "ideas" : "today");

/** Aba atual refletida no hash (#hoje / #ideias): o botão Voltar do navegador troca de aba. */
function useHashTab(): [Tab, (t: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const onChange = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const setTab = (t: Tab) => {
    if (t !== tab) window.location.hash = TABS.find((x) => x.id === t)!.hash;
  };
  return [tab, setTab];
}

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

  if (wide) {
    // Computador: barra no topo; o dia fixo à esquerda (com a captura embaixo) e as Ideias no resto.
    return (
      <div className="safe-x grid h-dvh grid-rows-[52px_minmax(0,1fr)] overflow-hidden">
        <SkipLink />
        <header className="flex items-center gap-3 border-b border-line bg-surface px-5">
          <span aria-hidden className="grid size-[26px] place-items-center rounded-lg bg-accent-fill text-on-accent">
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
          <aside data-testid="today-pane" aria-label="Dia" className="pane flex h-full flex-col border-r border-line">
            <div className="flex-1">
              <Today key={todayKey} captured={captured} onOpenReport={openFromToday} wide />
            </div>
            <CaptureBar inline onTaskSaved={setCaptured} onIdeaSaved={setCapturedIdea} />
          </aside>
          <main id="conteudo" tabIndex={-1} className="min-h-0 min-w-0 overflow-hidden focus:outline-none">
            <Ideas wide captured={capturedIdea} onTaskSaved={setCaptured} />
          </main>
        </div>
        {reportStart && (
          <Report start={reportStart} onClose={() => setReportStart(null)} onMoved={() => setTodayKey((k) => k + 1)} />
        )}
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
          <Today key={todayKey} captured={captured} onOpenReport={openFromToday} />
        ) : (
          <Ideas captured={capturedIdea} onTaskSaved={setCaptured} />
        )}
      </main>

      <CaptureBar onTaskSaved={setCaptured} onIdeaSaved={setCapturedIdea} />

      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md"
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
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[12px] transition-colors duration-150 focus-visible:-outline-offset-4 motion-reduce:transition-none ${
                  on ? "font-semibold text-accent" : "font-medium text-muted hover:text-ink active:text-ink"
                }`}
              >
                <Icon size={20} strokeWidth={on ? 2.2 : 1.8} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {reportStart && (
        <Report start={reportStart} onClose={() => setReportStart(null)} onMoved={() => setTodayKey((k) => k + 1)} />
      )}

      {reveal}
      <Toast />
    </div>
  );
}
