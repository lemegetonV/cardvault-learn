import { test, expect } from '@playwright/test';

// Tags are labels you can choose tests by: npx playwright test --grep @smoke
test('the sign-in page opens', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('a wrong password is refused', { tag: '@smoke' }, async ({ page }) => {
  // A new made-up username on every run. CardVault locks a username after a
  // few wrong passwords, so reusing one name would lock it after a few runs.
  await page.goto('/login');
  await page.getByLabel('Username').fill(`nobody-${Date.now()}`);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByTestId('login-error')).toHaveText('Wrong username or password.');
  await expect(page).toHaveURL('/login');
});

test('the sign-in page has a title in the browser tab', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/CardVault/);
});

test('the username field can be typed into', async ({ page, browserName }) => {
  // test.skip with a condition skips this test only where the condition is true.
  // browserName is a fixture: 'chromium', 'firefox' or 'webkit'.
  test.skip(browserName === 'webkit', 'An example of skipping one browser');

  await page.goto('/login');
  await expect(page.getByLabel('Username')).toBeEditable();
});
