import { test as base, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { WalletPage } from './pages/WalletPage';
import { CardsPage } from './pages/CardsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { TransactionPage } from './pages/TransactionPage';
import { Toast } from './components/Toast';
import { ConsentDialog } from './components/ConsentDialog';
import { Menu } from './components/Menu';
import { CardVaultApi, Customer } from './api/CardVaultApi';
import { PURCHASE } from './data/test-data';

// Everything our own fixtures give a test, by name.
type CardVaultFixtures = {
  loginPage: LoginPage;
  walletPage: WalletPage;
  cardsPage: CardsPage;
  transactionsPage: TransactionsPage;
  transactionPage: TransactionPage;
  toast: Toast;
  consentDialog: ConsentDialog;
  menu: Menu;
  api: CardVaultApi;
  customer: Customer;
  customerWithCard: Customer;
};

// Sign a customer in through the sign-in page and wait for their wallet.
async function signIn(loginPage: LoginPage, customer: Customer) {
  await loginPage.open();
  await loginPage.signIn(customer.username, customer.password);
  await expect(loginPage.page).toHaveURL('/wallet');
}

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
  toast: async ({ page }, use) => {
    await use(new Toast(page));
  },
  consentDialog: async ({ page }, use) => {
    await use(new ConsentDialog(page));
  },
  menu: async ({ page }, use) => {
    await use(new Menu(page));
  },

  api: async ({ request }, use) => {
    await use(new CardVaultApi(request));
  },

  // A brand-new customer with one card in the wallet and one purchase on it,
  // already signed in. Only tests that ask for `customer` pay for this set-up.
  customer: async ({ api, loginPage }, use) => {
    const customer = await api.createCustomer(true);
    await api.makePurchase(customer, PURCHASE.merchant, PURCHASE.amountInCents);

    // The purchase reaches the transaction list a moment later. Wait until it is there.
    await expect.poll(() => api.countTransactions(customer)).toBe(1);

    await signIn(loginPage, customer);
    await use(customer);
  },

  // A brand-new customer with one credit card that is not in the wallet yet,
  // already signed in. The card was used recently, so it can be added.
  customerWithCard: async ({ api, loginPage }, use) => {
    const customer = await api.createCustomer(false);
    await signIn(loginPage, customer);
    await use(customer);
  },
});

export { expect };
