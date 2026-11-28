import { APIRequestContext, expect } from '@playwright/test';
import { AUTH_URL, CARD_NETWORK_URL, TEST_KEY, TRANSACTIONS_URL, WALLET_URL } from '../config';

// A customer made for one test, with everything a test needs to know about them.
export interface Customer {
  username: string;
  password: string;
  last4: string; // the last four digits of their one card
  tokenRef: string; // the wallet's stand-in for the card number, used to make purchases
}

// A small client for the CardVault services, used to set up data before a UI test.
// Setting up through the API is fast and reliable; the browser is kept for what the test checks.
export class CardVaultApi {
  readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  // Sign in and return the access token that other API calls need.
  async signIn(username: string, password: string): Promise<string> {
    const response = await this.request.post(`${AUTH_URL}/v1/auth/login`, {
      data: { username, password },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).access_token;
  }

  // Create a brand-new customer with one credit card. With inWallet set to false,
  // the card is not in the wallet yet, so a test can add it.
  async createCustomer(inWallet: boolean): Promise<Customer> {
    const response = await this.request.post(`${WALLET_URL}/test/customers`, {
      headers: { 'X-Test-Key': TEST_KEY },
      data: { cards: [{ product: 'CREDIT', enrolled: inWallet }] },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    return {
      username: body.username,
      password: body.password,
      last4: body.cards[0].last4,
      tokenRef: body.cards[0].token_ref,
    };
  }

  // Pay a shop with the customer's card, the way a checkout would.
  async makePurchase(customer: Customer, merchant: string, amountInCents: number) {
    const response = await this.request.post(`${CARD_NETWORK_URL}/v1/test/purchases`, {
      headers: { 'X-Test-Key': TEST_KEY },
      data: { token_ref: customer.tokenRef, amount: amountInCents, merchant_name: merchant },
    });
    expect(response.status()).toBe(200);
  }

  // How many wallet transactions the customer has right now.
  async countTransactions(customer: Customer): Promise<number> {
    const token = await this.signIn(customer.username, customer.password);
    const response = await this.request.get(`${TRANSACTIONS_URL}/v1/wallet/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).items.length;
  }
}
