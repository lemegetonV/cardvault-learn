import { DEMO_PASSWORD } from '../config';

// The data the framework tests use, in one place, with where each value comes from.

// alice is a demo customer who is always there. Tests only read her data,
// so they can share her safely, even when they run at the same time.
export const ALICE = { username: 'alice', password: DEMO_PASSWORD };

// alice's four cards, by the last four digits shown on screen.
export const ALICE_CARDS = {
  credit: '4417', // in the wallet
  debit: '2045', // in the wallet
  unusedCredit: '7380', // not used for 120 days, so it cannot be added
  prepaid: '5521', // prepaid cards cannot be added
};

// The purchase made for a new customer before a test.
export const PURCHASE = { merchant: 'Northwind Books', amountInCents: 3000, shownAs: '$30.00' };

// A small picture to upload as a dispute receipt.
export const RECEIPT_FILE = 'data/files/receipt.png';

// A username that has never been used: usernames lock after a few wrong
// passwords, so each run needs a new one.
export function unusedUsername(): string {
  return `nobody-${Date.now()}`;
}
