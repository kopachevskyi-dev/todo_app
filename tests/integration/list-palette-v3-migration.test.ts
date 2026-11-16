import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';

const instant = '2026-11-10T00:00:00.000Z';

function migrate(prepare: (sqlite: Database.Database) => void) {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  for (const file of [
    '20261108133000_initial',
    '20261110195700_list_palette',
  ]) {
    sqlite.exec(readFileSync(`migrations/${file}.sql`, 'utf8'));
  }
  prepare(sqlite);
  sqlite.transaction(() => {
    sqlite.exec(
      readFileSync('migrations/20261116120000_list_palette_v3.sql', 'utf8'),
    );
  })();
  return sqlite;
}

const addTask = (sqlite: Database.Database, id: string, listId: string) =>
  sqlite
    .prepare(
      `INSERT INTO task (id, title, list_id, placed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, id, listId, instant, instant, instant);

it('recolors a #E3686A list to #e05a4f and keeps its 2 tasks', () => {
  const sqlite = migrate((db) => {
    db.exec("DELETE FROM list WHERE name <> 'Personal'");
    db.exec("UPDATE list SET color = '#E3686A'");
    const { id } = db.prepare('SELECT id FROM list').get() as { id: string };
    addTask(db, 'task-a', id);
    addTask(db, 'task-b', id);
  });
  try {
    const list = sqlite.prepare('SELECT id, color FROM list').get() as {
      id: string;
      color: string;
    };
    expect(list.color).toBe('#e05a4f');
    expect(
      sqlite
        .prepare('SELECT id FROM task WHERE list_id = ? ORDER BY id')
        .all(list.id),
    ).toEqual([{ id: 'task-a' }, { id: 'task-b' }]);
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
  } finally {
    sqlite.close();
  }
});

it('maps every old palette color to its v3 color without losing a list', () => {
  const mapping: Record<string, string> = {
    '#E3686A': '#e05a4f',
    '#5FB4C6': '#2a9bb5',
    '#F0C24B': '#e8a33c',
    '#8E7CC3': '#8b6ad8',
    '#6FBF8A': '#3aa77a',
    '#6A93D4': '#4a86e8',
    '#E8975A': '#ee7d3b',
    '#D985A8': '#b25a9c',
  };
  const sqlite = migrate((db) => {
    db.exec('DELETE FROM list');
    Object.keys(mapping).forEach((color, index) => {
      db.prepare(
        'INSERT INTO list (id, name, color, position, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(`list-${index}`, color, color, index, instant);
    });
  });
  try {
    const rows = sqlite
      .prepare('SELECT name, color FROM list ORDER BY position')
      .all() as { name: string; color: string }[];
    expect(rows).toHaveLength(8);
    expect(rows.map(({ name, color }) => [name, color])).toEqual(
      Object.entries(mapping),
    );
  } finally {
    sqlite.close();
  }
});
