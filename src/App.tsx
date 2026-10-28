import { useState } from "react";
import { Toast } from "./components/Toast";
import { Today } from "./screens/Today";

type Tab = "today" | "ideas";

const TABS: { id: Tab; label: string; icon: string }[] = [
  // Folha com uma tarefa riscada
  { id: "today", label: "Hoje", icon: "M5 4h14v16H5zM8.5 9.5l2 2 4-4M8.5 15h7" },
  // Lâmpada
  { id: "ideas", label: "Ideias", icon: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" },
];

function IdeasSoon() {
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-center"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
    >
      <h1 className="font-display text-[28px] font-semibold">Ideias</h1>
      <p className="mt-1 text-muted">Em breve.</p>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="safe-x min-h-dvh">
      <main>{tab === "today" ? <Today /> : <IdeasSoon />}</main>

      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium transition-colors duration-150 ${
                  on ? "text-accent" : "text-muted active:text-ink"
                }`}
              >
                <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                  <path
                    d={t.icon}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={on ? 2 : 1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <Toast />
    </div>
  );
}
