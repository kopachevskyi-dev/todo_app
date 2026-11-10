import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';

it('expands an existing database palette without losing lists or task assignments', () => {
  const sqlite = new Database(':memory:');
  try {
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(readFileSync('migrations/20261108133000_initial.sql', 'utf8'));
    const lists = sqlite.prepare('SELECT * FROM list ORDER BY position').all();
    sqlite.exec(`INSERT INTO task (id, title, list_id, placed_at, created_at, updated_at)
      VALUES ('task', 'Keep my list', '01JBX0000000000000000W0RK0', '2026-11-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z')`);
    sqlite.transaction(() => {
      sqlite.exec(
        readFileSync('migrations/20261110195700_list_palette.sql', 'utf8'),
      );
    })();
    expect(
      sqlite.prepare('SELECT * FROM list ORDER BY position').all(),
    ).toEqual(lists);
    expect(sqlite.prepare('SELECT list_id FROM task').get()).toEqual({
      list_id: '01JBX0000000000000000W0RK0',
    });
    for (const color of ['#6A93D4', '#E8975A', '#D985A8']) {
      sqlite
        .prepare("UPDATE list SET color = ? WHERE name = 'Work'")
        .run(color);
    }
    expect(() =>
      sqlite.prepare("UPDATE list SET color = '#000000'").run(),
    ).toThrow();
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    sqlite.prepare("DELETE FROM list WHERE name = 'Work'").run();
    expect(sqlite.prepare('SELECT list_id FROM task').get()).toEqual({
      list_id: null,
    });
  } finally {
    sqlite.close();
  }
});
