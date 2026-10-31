CREATE TABLE planner.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  color text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$')
);
CREATE UNIQUE INDEX tags_name_unique ON planner.tags (lower(name));
CREATE TABLE planner.task_tags (
  task_id uuid NOT NULL REFERENCES planner.tasks(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES planner.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
INSERT INTO planner.tags (name, color) VALUES ('work', '#4679a5'), ('private', '#9163b5'), ('home', '#627b54');
