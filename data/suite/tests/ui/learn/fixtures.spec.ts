import { test, expect, Page } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

// Several tests below sign in, some of them on more than one page, so the
// steps live in one small function. Page is the type of a browser tab.
async function signIn(page: Page, username: string) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');
}

// A fixture is something a test asks for in { }: Playwright creates it before
// the test and cleans it up afterwards. These are the built-in ones.

test('page: one browser tab, ready to use', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'CardVault Bank' })).toBeVisible();
});

test('context: two tabs share one sign-in', async ({ context, page }) => {
  // page is the first tab in context. Sign in there.
  await signIn(page, 'alice');

  // A second tab in the same context has the same cookies, so it is signed in too.
  const secondTab = await context.newPage();
  await secondTab.goto('/cards');
  await expect(secondTab.getByRole('heading', { name: 'Cards' })).toBeVisible();
});

test('browser: two customers side by side', async ({ browser }) => {
  // Each new context is a separate, empty browser profile.
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await signIn(alice, 'alice');
  await signIn(bob, 'bob');

  // Each customer sees only their own cards.
  await expect(alice.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(4);
  await expect(bob.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(2);

  // Contexts you create yourself, you close yourself.
  await aliceContext.close();
  await bobContext.close();
});

test('request: send HTTP requests without a page', async ({ request }) => {
  // request uses the same baseURL as page.goto.
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', service: 'web' });
});

test('testInfo: facts about the running test', async ({ page }, testInfo) => {
  // testInfo is the second parameter, outside the { }.
  expect(testInfo.title).toBe('testInfo: facts about the running test');
  expect(testInfo.project.name).toBe('learn');

  // Attach a screenshot to this test's entry in the HTML report.
  await page.goto('/login');
  await testInfo.attach('sign-in page', { body: await page.screenshot(), contentType: 'image/png' });
});
