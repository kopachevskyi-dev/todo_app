CREATE TABLE planner.days (
  date date PRIMARY KEY,
  reflection text NOT NULL DEFAULT '',
  reflection_prompt_dismissed boolean NOT NULL DEFAULT false
);
