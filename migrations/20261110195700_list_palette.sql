-- Rebuild the checked table while retaining task assignments: dropping the old
-- list table invokes ON DELETE SET NULL while foreign keys remain enabled.
CREATE TEMP TABLE list_task_assignments AS SELECT id, list_id FROM task WHERE list_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE list_expanded (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CONSTRAINT list_name_length CHECK (length(name) BETWEEN 1 AND 40 AND length(trim(name)) > 0),
  color TEXT NOT NULL CONSTRAINT list_color CHECK (color IN ('#E3686A', '#5FB4C6', '#F0C24B', '#8E7CC3', '#6FBF8A', '#6A93D4', '#E8975A', '#D985A8')),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO list_expanded SELECT * FROM list;
--> statement-breakpoint
DROP TABLE list;
--> statement-breakpoint
ALTER TABLE list_expanded RENAME TO list;
--> statement-breakpoint
CREATE UNIQUE INDEX list_name_unique ON list (name COLLATE NOCASE);
--> statement-breakpoint
UPDATE task SET list_id = (SELECT list_id FROM list_task_assignments WHERE list_task_assignments.id = task.id) WHERE id IN (SELECT id FROM list_task_assignments);
--> statement-breakpoint
DROP TABLE list_task_assignments;
