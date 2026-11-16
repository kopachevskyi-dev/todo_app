-- Preserve task assignments before dropping the old checked table, which invokes
-- ON DELETE SET NULL while foreign keys remain enabled.
CREATE TEMP TABLE list_task_assignments AS SELECT id, list_id FROM task WHERE list_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE list_v3 (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CONSTRAINT list_name_length CHECK (length(name) BETWEEN 1 AND 40 AND length(trim(name)) > 0),
  color TEXT NOT NULL CONSTRAINT list_color CHECK (color IN ('#3aa77a', '#4a86e8', '#e8a33c', '#e05a4f', '#8b6ad8', '#ee7d3b', '#2a9bb5', '#b25a9c')),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO list_v3 (id, name, color, position, created_at)
SELECT id, name,
  CASE color
    WHEN '#E3686A' THEN '#e05a4f'
    WHEN '#5FB4C6' THEN '#2a9bb5'
    WHEN '#F0C24B' THEN '#e8a33c'
    WHEN '#8E7CC3' THEN '#8b6ad8'
    WHEN '#6FBF8A' THEN '#3aa77a'
    WHEN '#6A93D4' THEN '#4a86e8'
    WHEN '#E8975A' THEN '#ee7d3b'
    WHEN '#D985A8' THEN '#b25a9c'
  END,
  position, created_at
FROM list;
--> statement-breakpoint
DROP TABLE list;
--> statement-breakpoint
ALTER TABLE list_v3 RENAME TO list;
--> statement-breakpoint
CREATE UNIQUE INDEX list_name_unique ON list (name COLLATE NOCASE);
--> statement-breakpoint
UPDATE task SET list_id = (SELECT list_id FROM list_task_assignments WHERE list_task_assignments.id = task.id) WHERE id IN (SELECT id FROM list_task_assignments);
--> statement-breakpoint
DROP TABLE list_task_assignments;
