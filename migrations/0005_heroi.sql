-- Herói e Torre. XP, nível de atributo, nós de trilha, peças, títulos e andares são calculados, nunca gravados.

-- Missões diárias (hábitos que valem todo dia). archived_date NULL = ativa.
-- A missão vale no dia D quando start_date <= D e (archived_date IS NULL ou D < archived_date).
CREATE TABLE missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  attribute TEXT NOT NULL CHECK (attribute IN ('fisica', 'mental', 'profissional', 'financeira', 'espiritual')),
  xp INTEGER NOT NULL CHECK (xp IN (5, 10, 20, 35, 50)),
  position INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  archived_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_missions_active ON missions(archived_date, position);

-- Missão feita num dia (uma marcação por missão por dia; sem XP gravado).
CREATE TABLE mission_checks (
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  done_at TEXT NOT NULL,
  PRIMARY KEY (mission_id, date)
);
CREATE INDEX idx_mission_checks_date ON mission_checks(date);

-- Dias com movimentação registrada pelo Agente Finanças (só a data; o retrato guarda só 13 meses).
CREATE TABLE finance_days (
  date TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL
);

-- Sementes: valem a partir de hoje (São Paulo, -3 horas, sem horário de verão).
INSERT INTO missions (id, title, attribute, xp, position, start_date, created_at, updated_at) VALUES
  ('5e3d0a5e-0001-4c1a-9e00-6d15510e0001', 'Ler 10 páginas', 'mental', 20, 0, date('now', '-3 hours'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('5e3d0a5e-0002-4c1a-9e00-6d15510e0002', 'Meditar 10 min', 'espiritual', 10, 1, date('now', '-3 hours'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
