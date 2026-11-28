// Set-up for the tests that change data. Each one gets a brand-new customer,
// so it never disturbs alice or another test. The lesson on API set-up for
// UI tests explains how this works; for now it is enough to know what it returns.
import { APIRequestContext, expect } from '@playwright/test';
import { AUTH_URL, CARD_NETWORK_URL, TEST_KEY, TRANSACTIONS_URL, WALLET_URL } from '../../config';

// What the helper hands back: everything a test needs to sign in.
export interface NewCustomer {
  username: string;
  password: string;
}

// Create a customer with one credit card in the wallet and one $30.00 purchase on it.
export async function newCustomerWithPurchase(request: APIRequestContext): Promise<NewCustomer> {
  const created = await request.post(`${WALLET_URL}/test/customers`, {
    headers: { 'X-Test-Key': TEST_KEY },
    data: { cards: [{ product: 'CREDIT', enrolled: true }] },
  });
  expect(created.status()).toBe(201);
  const customer = await created.json();

  const purchase = await request.post(`${CARD_NETWORK_URL}/v1/test/purchases`, {
    headers: { 'X-Test-Key': TEST_KEY },
    data: { token_ref: customer.cards[0].token_ref, amount: 3000, merchant_name: 'Northwind Books' },
  });
  expect(purchase.status()).toBe(200);

  // The purchase reaches the customer's transaction list a moment later.
  // Ask every half second until it is there, so the test starts with it on screen.
  const login = await request.post(`${AUTH_URL}/v1/auth/login`, {
    data: { username: customer.username, password: customer.password },
  });
  const token = (await login.json()).access_token;
  await expect
    .poll(async () => {
      const list = await request.get(`${TRANSACTIONS_URL}/v1/wallet/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await list.json()).items.length;
    })
    .toBe(1);

  return { username: customer.username, password: customer.password };
}

// Create a customer with one credit card that is not in the wallet yet.
// The card was used five days ago, so it can be added.
export async function newCustomerWithCard(request: APIRequestContext): Promise<NewCustomer> {
  const created = await request.post(`${WALLET_URL}/test/customers`, {
    headers: { 'X-Test-Key': TEST_KEY },
    data: { cards: [{ product: 'CREDIT', enrolled: false }] },
  });
  expect(created.status()).toBe(201);
  const customer = await created.json();

  return { username: customer.username, password: customer.password };
}
