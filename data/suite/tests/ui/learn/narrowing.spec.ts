// Lesson: Narrowing a match.
// alice has four cards, and every card has the same buttons. These tests show
// how to point at one card, or one button on one card, without clicking anything.
import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait until the sign-in has finished and the wallet page is open, then go to the cards.
  await expect(page).toHaveURL('/wallet');
  await page.goto('/cards');
});

test('one locator can match many elements', async ({ page }) => {
  // Every card has a Reissue button, so this locator matches four buttons.
  // Clicking it would fail: Playwright refuses to guess which one you meant.
  const reissueButtons = page.getByRole('button', { name: 'Reissue' });

  await expect(reissueButtons).toHaveCount(4);
});

test('filter by text: the card ending 4417', async ({ page }) => {
  const cards = page.getByTestId('card-list').getByRole('listitem');
  const creditCard = cards.filter({ hasText: '4417' });

  await expect(creditCard).toHaveCount(1);
  await expect(creditCard.getByRole('button', { name: 'Reissue' })).toBeVisible();
});

test('filter by what is inside: the prepaid card', async ({ page }) => {
  const cards = page.getByTestId('card-list').getByRole('listitem');
  const prepaidCard = cards.filter({ has: page.getByText('PREPAID') });

  await expect(prepaidCard).toContainText('5521');
});

test('first, last and nth: by position', async ({ page }) => {
  const cards = page.getByTestId('card-list').getByRole('listitem');

  // Positions are counted from 0, so nth(1) is the second card.
  await expect(cards.first()).toBeVisible();
  await expect(cards.nth(1)).toBeVisible();
  await expect(cards.last()).toBeVisible();
});
