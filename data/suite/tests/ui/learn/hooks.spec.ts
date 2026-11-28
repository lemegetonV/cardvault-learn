import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

// beforeAll runs once, before the first test in this file. It gets no page,
// because pages belong to single tests. Here it checks that the app is up,
// so a stopped app gives one clear error instead of a failure in every test.
test.beforeAll(async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBe(true);
});

// test.describe puts tests in a named group. The hook inside it runs only for
// the tests in the group.
test.describe('signed in as alice', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('alice');
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/wallet');
  });

  test('her wallet lists four cards', async ({ page }) => {
    await expect(page.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(4);
  });

  test('her profile shows her email address', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByTestId('profile-email')).toHaveValue('alice@example.com');
  });
});

// This test is outside the group, so the sign-in hook does not run for it.
// It also proves that nothing is left over from the tests above: every test
// gets a fresh browser context, with no cookies, so it starts signed out.
test('every test starts signed out', async ({ page }) => {
  await page.goto('/wallet');

  // A signed-out visitor is sent to the sign-in page.
  await expect(page).toHaveURL(/\/login/);
});
