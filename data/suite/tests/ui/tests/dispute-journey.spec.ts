import { test, expect } from '../fixtures';
import { PURCHASE } from '../data/test-data';

// Journey: a customer finds a purchase they do not recognise and disputes it.
// customer is a new customer, signed in, with one $30.00 purchase at Northwind Books.

test('dispute a purchase and see it marked in the list', { tag: '@phone' }, async ({ customer, walletPage, menu, transactionsPage, transactionPage, toast }) => {
  await test.step('go to the transactions from the menu', async () => {
    // Wait for the wallet's card first: the menu only responds once the page has loaded.
    await expect(walletPage.card(customer.last4)).toBeVisible();
    await menu.goTo('Transactions');
    await expect(transactionsPage.rows).toHaveCount(1);
  });

  await test.step('open the purchase and dispute it', async () => {
    await transactionsPage.openTransaction(PURCHASE.merchant);
    await expect(transactionPage.amount).toHaveText(PURCHASE.shownAs);
    await transactionPage.openDispute('Unrecognised');
    await expect(toast.message('Dispute opened')).toBeVisible();
    await expect(transactionPage.disputeOpenBadge).toHaveText('DISPUTE OPEN');
  });

  await test.step('the list shows the open dispute', async () => {
    await transactionsPage.open();
    await expect(transactionsPage.rows.first().getByTestId('txn-dispute-badge')).toHaveText('DISPUTE OPEN');
  });
});

test('a purchase can only be disputed once', async ({ customer, transactionsPage, transactionPage, toast }) => {
  await transactionsPage.open();
  await transactionsPage.openTransaction(PURCHASE.merchant);
  await transactionPage.openDispute('Wrong amount');
  await expect(toast.message('Dispute opened')).toBeVisible();

  await expect(transactionPage.disputeButton).toBeHidden();
});
