-- Aba Treino. Pesos em gramas inteiros (82,5 kg = 82500). XP, brasão e conquistas são calculados, nunca gravados.

-- Treinos (A/B/C...).
CREATE TABLE workout_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  focus TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Exercícios de um treino; exercise_key = nome normalizado (liga o histórico).
CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exercise_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  sets INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_g INTEGER NOT NULL DEFAULT 0,
  rest_s INTEGER NOT NULL DEFAULT 90,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_workout_exercises_template ON workout_exercises(template_id, position);

-- Semana fixa: 1 = segunda … 7 = domingo; template_id NULL = folga.
CREATE TABLE workout_plan (
  weekday INTEGER PRIMARY KEY CHECK (weekday BETWEEN 1 AND 7),
  template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL
);

-- Configurações (linha única).
CREATE TABLE workout_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  weekly_goal INTEGER NOT NULL DEFAULT 4 CHECK (weekly_goal BETWEEN 3 AND 6),
  default_rest_s INTEGER NOT NULL DEFAULT 90,
  sound INTEGER NOT NULL DEFAULT 1
);
INSERT INTO workout_settings (id) VALUES (1);

-- Sessões de treino; finished_at NULL = em andamento (no máximo uma).
CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX idx_workout_sessions_date ON workout_sessions(date);
CREATE UNIQUE INDEX idx_workout_sessions_open ON workout_sessions(finished_at IS NULL) WHERE finished_at IS NULL;

-- Séries feitas; nome e posição guardados como retrato.
CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_key TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  exercise_position INTEGER NOT NULL DEFAULT 0,
  set_index INTEGER NOT NULL,
  weight_g INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  done_at TEXT NOT NULL
);
CREATE INDEX idx_workout_sets_key ON workout_sets(exercise_key, done_at);
CREATE UNIQUE INDEX idx_workout_sets_slot ON workout_sets(session_id, exercise_key, set_index);
