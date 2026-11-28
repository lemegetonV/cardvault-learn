import { test, expect } from '@playwright/test';
import { newCustomerWithCard } from './helpers/new-customer';

// Adding a card changes data, so each test gets a brand-new customer
// with one card that is not in the wallet yet.
test.beforeEach(async ({ page, request }) => {
  const customer = await newCustomerWithCard(request);

  await page.goto('/login');
  await page.getByLabel('Username').fill(customer.username);
  await page.getByLabel('Password').fill(customer.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  await page.getByRole('button', { name: 'Add to wallet' }).click();
});

test('agree to the terms inside the frame, then add the card', async ({ page }) => {
  // The terms are a separate web page, shown in an <iframe>.
  // contentFrame() gives a locator for the page inside it.
  const terms = page.getByTestId('terms-iframe').contentFrame();
  const addCard = page.getByRole('button', { name: 'Add card' });

  await expect(addCard).toBeDisabled();

  // Inside the frame: the same locators and actions as on any page.
  await terms.getByLabel('I agree').check();
  await terms.getByRole('button', { name: 'Continue' }).click();
  await expect(terms.getByText('Thank you.')).toBeVisible();

  // Back on the main page: the frame told it the terms were accepted.
  await expect(page.getByTestId('consent-status')).toContainText('accepted');
  await expect(addCard).toBeEnabled();
  await addCard.click();

  // The card shows as pending, then the wallet confirms it a moment later.
  const card = page.getByTestId('wallet-cards').getByRole('listitem');
  await expect(card).toContainText('ENROLLED', { timeout: 10_000 });
});

test('Continue stays disabled until the box is ticked', async ({ page }) => {
  const terms = page.getByTestId('terms-iframe').contentFrame();

  await expect(terms.getByRole('heading', { name: /Checkout wallet terms/ })).toBeVisible();
  await expect(terms.getByRole('button', { name: 'Continue' })).toBeDisabled();

  await terms.getByLabel('I agree').check();
  await expect(terms.getByRole('button', { name: 'Continue' })).toBeEnabled();
});
