import { test, expect } from '../fixtures';
import { ALICE, unusedUsername } from '../data/test-data';

test('alice signs in and sees her wallet', async ({ loginPage, walletPage, page }) => {
  await loginPage.open();
  await loginPage.signIn(ALICE.username, ALICE.password);

  await expect(page).toHaveURL('/wallet');
  await expect(walletPage.heading).toBeVisible();
  await expect(walletPage.cards).toHaveCount(4);
});

test('a wrong password is refused', async ({ loginPage, page }) => {
  await loginPage.open();
  await loginPage.signIn(unusedUsername(), 'not-the-password');

  await expect(loginPage.error).toBeVisible();
  await expect(page).toHaveURL('/login');
});
