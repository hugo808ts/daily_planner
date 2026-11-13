import { SET_XP, formatKg, type TodayExercise } from "../../../shared/workout";
import { exerciseLine } from "../../lib/workoutFormat";
import { ArrowUpIcon } from "../ui/Icon";

interface Props {
  exercises: TodayExercise[];
  /** Abre o editor do treino ("Editar"). */
  onEdit?: () => void;
}

/** Exercícios do treino de hoje: séries × reps · kg e o XP das séries. */
export function ExerciseList({ exercises, onEdit }: Props) {
  return (
    <section aria-labelledby="treino-exercicios">
      <div className="mx-1 mt-[18px] mb-2 flex min-h-11 items-center justify-between">
        <h2 id="treino-exercicios" className="eyebrow">
          Exercícios
        </h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="eyebrow -mr-2 min-h-11 rounded-xl px-2 hover:!text-ink focus-visible:outline-2 focus-visible:outline-accent active:!text-ink"
          >
            Editar
          </button>
        )}
      </div>
      {exercises.length === 0 ? (
        <p className="glass-quiet rounded-[22px] px-4 py-5 text-center text-sm text-muted">Nenhum exercício neste treino.</p>
      ) : (
        <ol className="glass-quiet overflow-hidden rounded-[22px]">
          {exercises.map((e, i) => (
            <li key={e.id} className="flex items-center gap-3 border-line px-3.5 py-3 [&+&]:border-t">
              <span
                aria-hidden
                className="grid size-[30px] shrink-0 place-items-center rounded-[10px] bg-lime/[0.08] font-mono text-[12px] font-bold text-lime ring-1 ring-lime/30 ring-inset"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold tracking-[-0.01em] break-words">{e.name}</p>
                <p className="mt-0.5 font-mono text-[11.5px] text-muted">
                  {exerciseLine(e)}
                  {e.suggestUp && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-lime">
                      <ArrowUpIcon size={11} strokeWidth={2.6} />
                      <span className="sr-only">Meta hoje: subir para</span>
                      {formatKg(Math.max(e.weightG, e.last?.sets.reduce((m, s) => Math.max(m, s.weightG), 0) ?? 0) + 2500)}
                    </span>
                  )}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[12px] font-semibold text-lime [text-shadow:0_0_8px_rgb(136_239_27/0.6)]">
                +{e.sets * SET_XP}
                <span className="sr-only"> XP</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
