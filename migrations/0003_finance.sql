-- Retrato do financas.db enviado pelo Agente Finanças. Uma linha só (id = 1),
-- substituída a cada envio com INSERT ... ON CONFLICT(id) DO UPDATE.
CREATE TABLE finance_snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  generated_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  data TEXT NOT NULL
);
