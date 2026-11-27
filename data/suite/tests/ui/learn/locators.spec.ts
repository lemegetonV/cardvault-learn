// Lesson: Locators.
// The same /cards page, found five different ways. Each test reads alice's
// cards and changes nothing, so the tests can run in any order.
import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

// Runs before every test in this file: sign in as alice and open her cards.
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait until the sign-in has finished and the wallet page is open, then go to the cards.
  await expect(page).toHaveURL('/wallet');
  await page.goto('/cards');
});

test('by role: the heading and the navigation links', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Transactions' })).toBeVisible();
});

test('by text: a card by the last four digits of its number', async ({ page }) => {
  // Text matching ignores case and finds the text anywhere inside an element.
  await expect(page.getByText('•••• 4417')).toBeVisible();
});

test('by label: the sign-in form fields', async ({ page }) => {
  // Sign out first, so the sign-in form is on the screen again.
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByLabel('Username')).toBeEmpty();
  await expect(page.getByLabel('Password')).toBeEmpty();
});

test('by test id: the list of cards', async ({ page }) => {
  // data-testid is an attribute the developers added for tests: <ul data-testid="card-list">.
  await expect(page.getByTestId('card-list')).toBeVisible();
});

test('by role inside a part of the page: the main navigation', async ({ page }) => {
  // Find the navigation first, then look for links only inside it.
  const nav = page.getByRole('navigation', { name: 'Main' });

  await expect(nav.getByRole('link')).toHaveCount(4);
});
