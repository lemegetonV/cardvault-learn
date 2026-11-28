import { test, expect } from '@playwright/test';
import { AUTH_URL, CARDS_URL, DEMO_PASSWORD } from '../config';

test('sign in through the API and list alice’s cards', async ({ request }) => {
  // The request fixture sends HTTP requests straight to a service, with no browser.
  const login = await request.post(`${AUTH_URL}/v1/auth/login`, {
    data: { username: 'alice', password: DEMO_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const token = (await login.json()).access_token;

  const cards = await request.get(`${CARDS_URL}/v1/cards`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(cards.status()).toBe(200);
  expect((await cards.json()).items).toHaveLength(4);
});

test('the Cards page shows the same cards as the API', async ({ page, request }) => {
  // Ask the API which cards alice has...
  const login = await request.post(`${AUTH_URL}/v1/auth/login`, {
    data: { username: 'alice', password: DEMO_PASSWORD },
  });
  const token = (await login.json()).access_token;
  const response = await request.get(`${CARDS_URL}/v1/cards`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const apiCards = (await response.json()).items;

  // ...then check that the page lists each of them.
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');
  await page.goto('/cards');

  const cardList = page.getByTestId('card-list');
  await expect(cardList.getByRole('listitem')).toHaveCount(apiCards.length);
  for (const card of apiCards) {
    await expect(cardList).toContainText(`•••• ${card.last4}`);
  }
});

test('page.request shares the page’s sign-in, request does not', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  // page.request sends the browser's cookies, so the web app knows who is asking.
  const signedIn = await page.request.get('/api/cards');
  expect(signedIn.status()).toBe(200);

  // The request fixture has its own, empty cookie jar.
  const signedOut = await request.get('/api/cards');
  expect(signedOut.status()).toBe(401);
});
