import { expect, it } from 'vitest';
import {
  clockSchema,
  errorResponseSchema,
  examples,
  healthResponseSchema,
  listsResponseSchema,
} from '../../src/shared/contract';
import { testApp } from '../helpers/app';

it('parses example payloads using the same shared schemas as the client', () => {
  expect(listsResponseSchema.parse(examples.lists)).toEqual(examples.lists);
  expect(healthResponseSchema.parse(examples.health)).toEqual(examples.health);
  expect(errorResponseSchema.parse(examples.error)).toEqual(examples.error);
  expect(clockSchema.parse(examples.clock)).toEqual(examples.clock);
});

it('validates app payloads and matches the example name and color', async () => {
  const app = await testApp();
  try {
    const response = await app.request('/api/lists');
    expect(response.status).toBe(200);
    const payload = listsResponseSchema.parse(await response.json());
    expect(payload.lists[0]).toMatchObject(examples.lists.lists[0]);
    expect(
      healthResponseSchema.parse(
        await (await app.request('/api/health')).json(),
      ),
    ).toEqual(examples.health);
  } finally {
    await app.close();
  }
});
