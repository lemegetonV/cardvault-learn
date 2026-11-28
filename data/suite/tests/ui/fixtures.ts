import { test as base, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { WalletPage } from './pages/WalletPage';
import { CardsPage } from './pages/CardsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { TransactionPage } from './pages/TransactionPage';
import { CardVaultApi, Customer } from './api/CardVaultApi';
import { PURCHASE } from './data/test-data';

// Everything our own fixtures give a test, by name.
type CardVaultFixtures = {
  loginPage: LoginPage;
  walletPage: WalletPage;
  cardsPage: CardsPage;
  transactionsPage: TransactionsPage;
  transactionPage: TransactionPage;
  api: CardVaultApi;
  customer: Customer;
};

// test.extend makes a new `test` that has Playwright's fixtures and ours.
// Each fixture builds its value, hands it to the test with use(), and anything
// after use() runs when the test has finished.
export const test = base.extend<CardVaultFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  walletPage: async ({ page }, use) => {
    await use(new WalletPage(page));
  },
  cardsPage: async ({ page }, use) => {
    await use(new CardsPage(page));
  },
  transactionsPage: async ({ page }, use) => {
    await use(new TransactionsPage(page));
  },
  transactionPage: async ({ page }, use) => {
    await use(new TransactionPage(page));
  },

  api: async ({ request }, use) => {
    await use(new CardVaultApi(request));
  },

  // A brand-new customer with one card in the wallet and one purchase on it,
  // already signed in. Only tests that ask for `customer` pay for this set-up.
  customer: async ({ api, loginPage, page }, use) => {
    const customer = await api.createCustomer(true);
    await api.makePurchase(customer, PURCHASE.merchant, PURCHASE.amountInCents);

    // The purchase reaches the transaction list a moment later. Wait until it is there.
    await expect.poll(() => api.countTransactions(customer)).toBe(1);

    await loginPage.open();
    await loginPage.signIn(customer.username, customer.password);
    await expect(page).toHaveURL('/wallet');

    await use(customer);
  },
});

export { expect };
