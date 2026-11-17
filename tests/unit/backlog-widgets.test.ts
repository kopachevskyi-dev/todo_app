import { describe, expect, it } from 'vitest';
import { byListWidget, waitingWidget } from '../../src/web/backlog-widgets';

const unfinished = '2026-11-12';

describe('Waiting widget', () => {
  it('with 5 Backlog tasks, 2 of them unfinished, reads badge "2 returned", big number 5, unit "tasks", bar fill 40 (2 / 5 * 100)', () => {
    const tasks = [
      { missedFrom: unfinished },
      { missedFrom: '2026-11-13' },
      { missedFrom: null },
      { missedFrom: null },
      { missedFrom: null },
    ];
    expect(waitingWidget(tasks)).toEqual({
      badge: '2 returned',
      number: 5,
      unit: 'tasks',
      fill: 40,
    });
  });

  it('with 1 Backlog task and none unfinished reads badge "Clear", big number 1, unit "task", bar fill 0', () => {
    expect(waitingWidget([{ missedFrom: null }])).toEqual({
      badge: 'Clear',
      number: 1,
      unit: 'task',
      fill: 0,
    });
  });

  it('with an empty Backlog reads badge "Clear", big number 0, unit "tasks", bar fill 0', () => {
    expect(waitingWidget([])).toEqual({
      badge: 'Clear',
      number: 0,
      unit: 'tasks',
      fill: 0,
    });
  });
});

describe('By list widget', () => {
  it('has one row per list, in list order, counting the Backlog tasks of that list; tasks without a list are not counted and lists without tasks show 0', () => {
    const lists = [
      { id: 'L1', name: 'Work', color: '#111111' },
      { id: 'L2', name: 'Home', color: '#222222' },
      { id: 'L3', name: 'Errands', color: '#333333' },
    ] as unknown as Parameters<typeof byListWidget>[1];
    const tasks = [
      { listId: 'L1' },
      { listId: 'L1' },
      { listId: 'L2' },
      { listId: null },
    ];
    expect(byListWidget(tasks, lists)).toEqual([
      { id: 'L1', name: 'Work', color: '#111111', count: 2 },
      { id: 'L2', name: 'Home', color: '#222222', count: 1 },
      { id: 'L3', name: 'Errands', color: '#333333', count: 0 },
    ]);
  });
});
