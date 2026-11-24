-- Lista "A fazer": tarefa sem dia (date NULL) fica na lista até ser feita.
-- O SQLite não tira NOT NULL de uma coluna: recria a tabela copiando tudo (ids, datas e done_at iguais).
CREATE TABLE tasks_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT,
  time TEXT,
  area TEXT,
  done_at TEXT,
  moved_from_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium'
);
INSERT INTO tasks_new (id, title, date, time, area, done_at, moved_from_id, created_at, updated_at, difficulty)
  SELECT id, title, date, time, area, done_at, moved_from_id, created_at, updated_at, difficulty FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
CREATE INDEX idx_tasks_date ON tasks(date);
-- Lista sem data: pendentes e feitas por done_at.
CREATE INDEX idx_tasks_undated ON tasks(date, done_at) WHERE date IS NULL;
