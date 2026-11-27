// Lesson: Web-first assertions.
// Each expect() below waits and retries until the page matches, for up to
// 5 seconds, so no test needs a sleep. alice's wallet is only read.
import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');
});

test('visible, and the text it shows', async ({ page }) => {
  const heading = page.getByRole('heading', { level: 1 });

  await expect(heading).toBeVisible();
  await expect(heading).toHaveText('Checkout wallet');
});

test('how many: alice has four cards', async ({ page }) => {
  await expect(page.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(4);
});

test('part of the text: why the prepaid card cannot be added', async ({ page }) => {
  const prepaid = page.getByRole('listitem').filter({ hasText: '5521' });

  await expect(prepaid).toContainText('Not eligible');
  // .not turns any check around: the prepaid card has no Add button.
  await expect(prepaid.getByRole('button', { name: 'Add to wallet' })).not.toBeVisible();
});

test('the page address and the browser tab title', async ({ page }) => {
  await expect(page).toHaveURL('/wallet');
  await expect(page).toHaveTitle(/CardVault/);
});

test('soft assertions report every problem, not just the first', async ({ page }) => {
  const credit = page.getByRole('listitem').filter({ hasText: '4417' });

  // A failed soft check is recorded, and the test carries on to the next line.
  await expect.soft(credit).toContainText('CREDIT');
  await expect.soft(credit).toContainText('ENROLLED');
  await expect.soft(credit.getByRole('button', { name: 'Remove from wallet' })).toBeEnabled();
});
