import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

// test.use changes settings from playwright.config.ts for the tests in this
// file only. Here: a narrow window, the width of a phone.
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  // Wait until the wallet has loaded alice's cards. Until the page has
  // finished starting up, the Menu button may not respond to a click yet.
  await expect(page.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(4);
});

test('on a narrow screen the links hide behind a Menu button', async ({ page }) => {
  const menu = page.getByRole('button', { name: 'Menu' });
  const cardsLink = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Cards' });

  await expect(menu).toBeVisible();
  await expect(cardsLink).toBeHidden();

  await menu.click();
  await expect(cardsLink).toBeVisible();
});

test('the window really is 390 pixels wide', async ({ page }) => {
  // viewportSize() reads the setting back. It is a plain value, so plain expect.
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
});
