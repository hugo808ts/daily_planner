CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  area TEXT,
  done_at TEXT,
  moved_from_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_tasks_date ON tasks(date);

CREATE TABLE day_notes (
  date TEXT PRIMARY KEY,
  text TEXT NOT NULL
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  link_title TEXT,
  link_thumb TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_ideas_folder ON ideas(folder_id, pinned, updated_at);
