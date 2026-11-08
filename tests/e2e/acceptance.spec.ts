import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../../scripts/test-server.mjs';

test.use({ timezoneId: 'America/New_York' });

const LICENSE = "Renew driver's license";
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');
const navLink = (page: Page, name: RegExp) =>
  page.getByRole('navigation').getByRole('link', { name });

async function api(url: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Timezone': 'America/New_York',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return (await response.json()) as { task: { id: string } };
}
const setServerClock = (url: string, now: string) =>
  api(url, 'PUT', '/api/test/clock', { now });
const create = async (
  url: string,
  title: string,
  target: 'today' | 'backlog',
) => (await api(url, 'POST', '/api/tasks', { title, target })).task.id;
const complete = (url: string, id: string) =>
  api(url, 'POST', `/api/tasks/${id}/complete`);
const plan = (url: string, id: string, day: string) =>
  api(url, 'POST', `/api/tasks/${id}/plan`, { day });

const viewports = [
  { name: 'desktop', mobile: false, width: 1440, height: 900 },
  { name: 'mobile', mobile: true, width: 390, height: 844 },
] as const;

for (const { name, mobile, width, height } of viewports) {
  test(`${name}: the section-7 core flow, Mon Nov 2 to Sun Nov 8`, async ({
    page,
  }) => {
    const server = await startTestServer({ testClock: true });
    const at = async (iso: string) => {
      await setServerClock(server.url, iso);
      await page.clock.setSystemTime(new Date(iso));
    };
    // The task detail is a right panel on desktop and a pushed screen on mobile.
    const detail = mobile
      ? page.getByRole('main')
      : page.getByRole('complementary');
    try {
      await page.setViewportSize({ width, height });

      // 1. Mon Nov 2, 9:12 AM: capture.
      await setServerClock(server.url, '2026-11-02T14:12:00.000Z');
      await page.clock.install({ time: new Date('2026-11-02T14:12:00.000Z') });
      for (let i = 1; i <= 7; i++)
        await create(server.url, `Backlog ${i}`, 'backlog');
      const monday = [];
      for (let i = 1; i <= 3; i++)
        monday.push(await create(server.url, `Monday ${i}`, 'today'));
      await page.goto(`${server.url}/backlog`);
      await expect(navLink(page, /Backlog/)).toContainText('7');
      await expect(navLink(page, /Today/)).toContainText('3');
      if (mobile) {
        await page.getByRole('button', { name: 'Add task' }).click();
        const sheet = page.getByRole('dialog');
        await sheet.getByRole('textbox').fill(LICENSE);
        await sheet.getByRole('button', { name: 'Add', exact: true }).click();
      } else {
        const field = page.getByPlaceholder('Add to backlog');
        await field.fill(LICENSE);
        await field.press('Enter');
      }
      await expect(rows(page).first()).toContainText(LICENSE);
      await expect(navLink(page, /Backlog/)).toContainText('8');
      await rows(page).first().click();
      await expect(detail).toContainText('added to backlog');
      for (const id of monday) await complete(server.url, id);

      // 2. Tue Nov 3, 8:03 PM: description, 3 subtasks, list Personal.
      await at('2026-11-04T01:03:00.000Z');
      const tuesday = await create(server.url, 'Tuesday open', 'today');
      const wednesday: Record<string, string> = {};
      for (const title of [
        'Pay rent',
        'Call the dentist',
        'Buy milk',
        'Water plants',
      ]) {
        wednesday[title] = await create(server.url, title, 'backlog');
        await plan(server.url, wednesday[title], '2026-11-04');
      }
      await page.goto(`${server.url}/backlog`);
      await expect(navLink(page, /Backlog/)).toContainText('8');
      await expect(navLink(page, /Today/)).toContainText('1');
      await rows(page).filter({ hasText: LICENSE }).click();
      await page
        .getByPlaceholder('Add a description')
        .fill('Bring the old license');
      await page.getByRole('button', { name: 'Add subtask' }).click();
      const subtask = page.getByRole('textbox', { name: 'Add subtask' });
      for (const title of ['Find the old license', 'Take a photo', 'Book it']) {
        await subtask.fill(title);
        await subtask.press('Enter');
        await expect(detail).toContainText(title);
      }
      await page.getByRole('button', { name: /^List/ }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Personal' })
        .click();
      await expect(detail).toContainText(
        'description, subtasks and list added',
      );

      // 2b. 8:05 PM: plan for tomorrow.
      await at('2026-11-04T01:05:00.000Z');
      await page.getByRole('button', { name: /^Day/ }).click();
      await expect(
        page.getByRole('button', { name: /Tomorrow, Wed 4/ }),
      ).toContainText('4 tasks');
      await page.getByRole('button', { name: /Tomorrow, Wed 4/ }).click();
      await page.getByRole('button', { name: 'Plan for Wed, Nov 4' }).click();
      await expect(detail).toContainText('planned for Nov 4');
      await expect(navLink(page, /Backlog/)).toContainText('7');
      await complete(server.url, tuesday);

      // 3. Wed Nov 4, 2:20 PM: check it off in Today.
      await at('2026-11-04T15:00:00.000Z');
      await complete(server.url, wednesday['Pay rent'] as string);
      await at('2026-11-04T19:20:00.000Z');
      await page.goto(`${server.url}/today`);
      await expect(navLink(page, /Backlog/)).toContainText('7');
      await expect(navLink(page, /Today/)).toContainText('4');
      await expect(page.getByRole('main')).toContainText('1 of 5 done');
      await page.getByRole('checkbox', { name: LICENSE }).check();
      await expect(page.getByRole('main')).toContainText('DONE · 2');
      await expect(page.getByRole('main')).toContainText('2 of 5 done');
      await expect(navLink(page, /Today/)).toContainText('3');
      await rows(page).filter({ hasText: LICENSE }).click();
      await expect(detail).toContainText('Completed at 2:20 PM');
      await at('2026-11-04T22:00:00.000Z');
      for (const title of ['Call the dentist', 'Buy milk'])
        await complete(server.url, wednesday[title] as string);

      // 4. Sun Nov 8: History.
      await at('2026-11-08T17:00:00.000Z');
      await page.goto(`${server.url}/history`);
      const main = page.getByRole('main');
      await main
        .getByRole('button', { name: /^Wednesday, November 4/ })
        .click();
      await expect(main).toContainText('4 of 5 done · 1 moved to backlog');
      await main.getByRole('listitem').filter({ hasText: LICENSE }).click();
      await expect(detail.locator('.activity li')).toHaveText([
        /added to backlog/,
        /description, subtasks and list added/,
        /planned for Nov 4/,
        /completed/,
      ]);
      await expect(
        page.getByRole('button', { name: 'Move to backlog' }),
      ).toBeVisible();
    } finally {
      await server.stop();
    }
  });
}

test('desktop: a task that rolled over shows "from Wed, Nov 4" and loses it once planned again through the day picker', async ({
  page,
}) => {
  const server = await startTestServer({ testClock: true });
  try {
    await setServerClock(server.url, '2026-11-04T15:00:00.000Z');
    await create(server.url, 'Pay rent', 'today');
    // Thu Nov 5, 10:00 AM: the task missed Wednesday.
    await setServerClock(server.url, '2026-11-05T15:00:00.000Z');
    await page.clock.install({ time: new Date('2026-11-05T15:00:00.000Z') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}/backlog`);
    await expect(rows(page).first()).toContainText('Pay rent');
    await expect(rows(page).first()).toContainText('from Wed, Nov 4');

    await rows(page).first().click();
    const panel = page.getByRole('complementary');
    await panel.getByRole('button', { name: /^Day/ }).click();
    await page.getByRole('button', { name: /Today, Thu 5/ }).click();
    await panel.getByRole('button', { name: 'Plan for today' }).click();

    await page.goto(`${server.url}/today`);
    const row = rows(page).filter({ hasText: 'Pay rent' });
    await expect(row).toHaveCount(1);
    await expect(row).not.toContainText('from');
  } finally {
    await server.stop();
  }
});

/** Asserts the focused control, or the field wrapping it, shows a visible ring. */
async function expectFocusRing(page: Page) {
  const visible = await page.evaluate(() => {
    let element: Element | null = document.activeElement;
    for (let depth = 0; element && depth < 3; depth++) {
      const style = getComputedStyle(element);
      if (
        (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none'
      )
        return true;
      element = element.parentElement;
    }
    return false;
  });
  expect(visible).toBe(true);
}

test('desktop keyboard only: quick-add, rows, Day popover, Plan, Escape', async ({
  page,
}) => {
  const server = await startTestServer({ testClock: true });
  try {
    await setServerClock(server.url, '2026-11-04T01:05:00.000Z');
    await page.clock.install({ time: new Date('2026-11-04T01:05:00.000Z') });
    await create(server.url, 'Existing one', 'backlog');
    await create(server.url, 'Existing two', 'backlog');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}/backlog`);
    const field = page.getByPlaceholder('Add to backlog');
    await expect(rows(page)).toHaveCount(2);

    // Tab to quick-add; every stop on the way shows a focus ring.
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      await expectFocusRing(page);
      if (await field.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(field).toBeFocused();
    await page.keyboard.type('Keyboard task');
    await page.keyboard.press('Enter');
    await expect(rows(page).first()).toContainText('Keyboard task');
    await expect(rows(page)).toHaveCount(3);

    // Tab into the rows, arrow between them, Enter opens the detail.
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      await expectFocusRing(page);
      const inRows = await page.evaluate(() =>
        Boolean(
          document.activeElement?.closest('main li') &&
          document.activeElement.tagName === 'A',
        ),
      );
      if (inRows) break;
    }
    await expect(rows(page).first().getByRole('link')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(rows(page).nth(1).getByRole('link')).toBeFocused();
    await expectFocusRing(page);
    await page.keyboard.press('ArrowUp');
    await expect(rows(page).first().getByRole('link')).toBeFocused();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary');
    await expect(panel.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Keyboard task',
    );

    // Day field: open, arrows to Tomorrow, Enter, activate Plan.
    const day = panel.getByRole('button', { name: /^Day/ });
    await day.focus();
    await expectFocusRing(page);
    await page.keyboard.press('Enter');
    await expect(day).toHaveAttribute('aria-expanded', 'true');
    const tomorrow = page.getByRole('button', { name: /Tomorrow, Wed 4/ });
    for (let i = 0; i < 6; i++) {
      if (await tomorrow.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('ArrowDown');
    }
    await expect(tomorrow).toBeFocused();
    await expectFocusRing(page);
    await page.keyboard.press('Enter');
    const planButton = panel.getByRole('button', {
      name: 'Plan for Wed, Nov 4',
    });
    await expect(planButton).toBeVisible();

    // Escape closes the popover first, then the drawer.
    await day.focus();
    await page.keyboard.press('Enter');
    await expect(day).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(day).toHaveAttribute('aria-expanded', 'false');
    await expect(panel.getByRole('textbox', { name: 'Title' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/task=/);

    // Reopen with the keyboard and activate Plan.
    await rows(page).first().getByRole('link').focus();
    await page.keyboard.press('Enter');
    await day.focus();
    await page.keyboard.press('Enter');
    for (let i = 0; i < 6; i++) {
      if (await tomorrow.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('ArrowDown');
    }
    await page.keyboard.press('Enter');
    await planButton.focus();
    await expectFocusRing(page);
    await page.keyboard.press('Enter');
    await expect(rows(page).filter({ hasText: 'Keyboard task' })).toHaveCount(
      0,
    );
  } finally {
    await server.stop();
  }
});

test('desktop: with the API unreachable, "Pay rent" stays in the field with an inline error; once reachable, Enter creates it', async ({
  page,
}) => {
  const server = await startTestServer();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}/backlog`);
    const field = page.getByPlaceholder('Add to backlog');
    await expect(field).toBeVisible();

    await page.route('**/api/**', (route) => route.abort('connectionrefused'));
    await field.fill('Pay rent');
    await field.press('Enter');
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).not.toBeEmpty();
    await expect(field).toHaveValue('Pay rent');

    await page.unroute('**/api/**');
    await field.press('Enter');
    await expect(rows(page).first()).toContainText('Pay rent');
    await expect(field).toHaveValue('');
  } finally {
    await server.stop();
  }
});

/** Elements whose computed animation or transition duration is above zero. */
function animatedElements(page: Page) {
  return page.evaluate(() => {
    const longest = (value: string) =>
      Math.max(...value.split(',').map((part) => parseFloat(part) || 0));
    return [...document.querySelectorAll('*')]
      .filter((el) => {
        const style = getComputedStyle(el);
        return (
          longest(style.animationDuration) > 0 ||
          longest(style.transitionDuration) > 0
        );
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
  });
}

test('mobile: with prefers-reduced-motion, the sheet and the task screen open without transitions', async ({
  page,
}) => {
  const server = await startTestServer();
  try {
    await create(server.url, 'One', 'backlog');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${server.url}/backlog`);

    await page.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await animatedElements(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await rows(page).first().click();
    await expect(page.getByRole('link', { name: /back/i })).toBeVisible();
    expect(await animatedElements(page)).toEqual([]);
  } finally {
    await server.stop();
  }
});
