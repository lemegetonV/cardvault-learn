import { test, expect } from '../fixtures';
import { PURCHASE, RECEIPT_FILE } from '../data/test-data';
import { ALICE_LOGIN } from '../config';

test.describe('alice’s transactions', () => {
  // Filtering only reads data, so these tests can share alice's saved login.
  test.use({ storageState: ALICE_LOGIN });

  test('filter to settled transactions', async ({ transactionsPage, page }) => {
    await transactionsPage.open();
    await transactionsPage.filterByStatus('SETTLED');

    await expect(page).toHaveURL(/status=SETTLED/);
    // No row may show another status, and there is at least one row.
    await expect(transactionsPage.statuses.filter({ hasNotText: 'SETTLED' })).toHaveCount(0);
    await expect(transactionsPage.rows.first()).toBeVisible();
  });
});

test.describe('a new customer’s purchase', () => {
  // `customer` makes a new customer with one purchase and signs them in.

  test('the purchase is in the list', async ({ customer, transactionsPage }) => {
    await transactionsPage.open();

    await expect(transactionsPage.rows).toHaveCount(1);
    await expect(transactionsPage.rows.first()).toContainText(PURCHASE.merchant);
    await expect(transactionsPage.rows.first()).toContainText(PURCHASE.shownAs);
  });

  test('dispute the purchase, with a note and a receipt', async ({ customer, transactionsPage, transactionPage, page }) => {
    await transactionsPage.open();
    await transactionsPage.openTransaction(PURCHASE.merchant);
    await transactionPage.openDispute('Wrong amount', 'I was charged twice', RECEIPT_FILE);

    await expect(page.getByRole('status').filter({ hasText: 'Dispute opened' })).toBeVisible();
    await expect(transactionPage.disputeOpenBadge).toHaveText('DISPUTE OPEN');
  });
});
