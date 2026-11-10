import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const DRAFT = 'Buy milk';

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
});

const addTask = (page: Page) => page.getByRole('button', { name: 'Add task' });
const sheet = (page: Page) => page.getByRole('dialog', { name: 'New task' });
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');

async function openAndType(page: Page, text = DRAFT) {
  await addTask(page).click();
  await sheet(page).getByRole('textbox').fill(text);
}

test('mobile: Close hides the sheet, focuses Add task and the reopened field keeps the draft', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    await openAndType(page);
    await sheet(page).getByRole('button', { name: 'Close' }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(addTask(page)).toBeFocused();

    await addTask(page).click();
    await expect(sheet(page).getByRole('textbox')).toHaveValue(DRAFT);
  } finally {
    await server.stop();
  }
});

test('mobile: Escape and a backdrop tap keep the draft like Close and return focus to Add task', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    await openAndType(page);

    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await expect(addTask(page)).toBeFocused();
    await addTask(page).click();
    await expect(sheet(page).getByRole('textbox')).toHaveValue(DRAFT);

    await page.mouse.click(195, 20); // scrim, above the sheet
    await expect(sheet(page)).toBeHidden();
    await expect(addTask(page)).toBeFocused();
    await addTask(page).click();
    await expect(sheet(page).getByRole('textbox')).toHaveValue(DRAFT);
  } finally {
    await server.stop();
  }
});

test('mobile: Backlog and Today each keep their own draft', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    await openAndType(page);
    await sheet(page).getByRole('button', { name: 'Close' }).click();
    const tabs = page.getByRole('navigation', { name: 'Sections' });

    await tabs.getByRole('link', { name: /Backlog/ }).click();
    await addTask(page).click();
    await expect(sheet(page).getByRole('textbox')).toHaveValue('');
    await sheet(page).getByRole('button', { name: 'Close' }).click();

    await tabs.getByRole('link', { name: /Today/ }).click();
    await addTask(page).click();
    await expect(sheet(page).getByRole('textbox')).toHaveValue(DRAFT);
  } finally {
    await server.stop();
  }
});

test('mobile: Add creates exactly one task and the reopened sheet is empty', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    await openAndType(page);
    await sheet(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(rows(page).filter({ hasText: DRAFT })).toHaveCount(1);

    await addTask(page).click();
    await expect(sheet(page).getByRole('textbox')).toHaveValue('');
  } finally {
    await server.stop();
  }
});

test('mobile: a failed Add with the server stopped shows an error and keeps the draft', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    await openAndType(page);
    await server.stop();
    await sheet(page).getByRole('button', { name: 'Add', exact: true }).click();

    await expect(sheet(page).getByRole('alert')).toBeVisible();
    await expect(sheet(page).getByRole('textbox')).toHaveValue(DRAFT);
  } finally {
    await server.stop();
  }
});
