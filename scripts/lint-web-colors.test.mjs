import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

async function lint(source, file = 'src/Example.tsx') {
  const directory = await mkdtemp(join(tmpdir(), 'planner-color-lint-'));
  try {
    await mkdir(join(directory, 'src'), { recursive: true });
    await writeFile(join(directory, file), source);
    return spawnSync(process.execPath, ['scripts/lint-web-colors.mjs', directory], { encoding: 'utf8' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('web colour lint rejects raw hex colours in components', async () => {
  const result = await lint('export const Example = () => <p style={{ color: "#abc" }}>Hello</p>;');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Example.tsx:1:.*raw hex colour #abc/);
});

test('web colour lint rejects palette utilities including variants and opacity modifiers', async () => {
  for (const utility of ['text-red-700', 'dark:hover:bg-slate-950/50', 'border-white', 'ring-offset-blue-200', 'from-lime-100', 'fill-black', 'text-sky-500/20']) {
    const result = await lint(`export const Example = () => <p className="${utility}">Hello</p>;`);
    assert.equal(result.status, 1, utility);
    assert.match(result.stderr, /Tailwind palette colour/);
  }
});

test('web colour lint allows tokens, user colours, and the token stylesheet', async () => {
  const component = await lint('export const Example = ({ tag }) => <p className="bg-surface text-text-muted border-line" style={{ color: tag.color }}>Hello</p>;');
  assert.equal(component.status, 0, component.stderr);
  const stylesheet = await lint('@theme { --color-page: #ececea; }', 'src/style.css');
  assert.equal(stylesheet.status, 0, stylesheet.stderr);
});

test('web colour lint also checks stylesheets outside the token file', async () => {
  const result = await lint('.example { color: #123456; }', 'src/example.css');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /example.css:1:.*raw hex colour/);
});
