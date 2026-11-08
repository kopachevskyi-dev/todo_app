CREATE TABLE list (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CONSTRAINT list_name_length CHECK (length(name) BETWEEN 1 AND 40 AND length(trim(name)) > 0),
  color TEXT NOT NULL CONSTRAINT list_color CHECK (color IN ('#E3686A', '#5FB4C6', '#F0C24B', '#8E7CC3', '#6FBF8A')),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX list_name_unique ON list (name COLLATE NOCASE);
--> statement-breakpoint
CREATE TABLE task (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CONSTRAINT task_title CHECK (length(title) BETWEEN 1 AND 200 AND title = trim(title)),
  description TEXT NOT NULL DEFAULT '',
  list_id TEXT REFERENCES list(id) ON DELETE SET NULL,
  day TEXT,
  completed_at TEXT,
  missed_from TEXT,
  placed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX task_list_id ON task(list_id);
--> statement-breakpoint
CREATE TABLE subtask (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0 CONSTRAINT subtask_done CHECK (done IN (0, 1)),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX subtask_task_id ON subtask(task_id);
--> statement-breakpoint
CREATE TABLE task_event (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  type TEXT NOT NULL CONSTRAINT task_event_type CHECK (type IN ('added_to_backlog', 'added_to_today', 'details_added', 'planned', 'completed', 'reopened', 'moved_to_backlog', 'missed')),
  at TEXT NOT NULL,
  day TEXT,
  data TEXT CONSTRAINT task_event_data CHECK (data IS NULL OR json_valid(data))
);
--> statement-breakpoint
CREATE INDEX task_event_task_id ON task_event(task_id);
--> statement-breakpoint
-- Bootstrap records have stable ULIDs and the migration's UTC instant.
INSERT INTO list (id, name, color, position, created_at) VALUES
  ('01JBX0000000000000000PERSN', 'Personal', '#E3686A', 0, '2026-11-08T13:30:00.000Z'),
  ('01JBX0000000000000000W0RK0', 'Work', '#5FB4C6', 1, '2026-11-08T13:30:00.000Z'),
  ('01JBX0000000000000000H0ME0', 'Home', '#F0C24B', 2, '2026-11-08T13:30:00.000Z');
