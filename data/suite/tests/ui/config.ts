// Where CardVault is, and the demo login the tests share.
//
// Each value comes from an environment variable when one is set, otherwise the
// default after ?? is used. The defaults point at CardVault on your own computer.
// To test another copy of the app, set the variable when you run the tests:
//
//   BASE_URL=https://cardvault.example.com npx playwright test

// The web app's address. Tests open pages with short paths such as "/login".
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// The password shared by the demo customers (alice, bob, charlie and dana).
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'CardVault-Demo-1';

// Where the setup project saves alice's login (lesson: Logging in once).
// .auth/ is in .gitignore: while it lasts, a saved login is as secret as a password.
export const ALICE_LOGIN = '.auth/alice.json';

// The services some tests talk to directly, without the browser: Login, Cards,
// Wallet (which also creates test customers), Transactions, and the card
// network simulator (which makes purchases, the way a shop would).
export const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:8001';
export const CARDS_URL = process.env.CARDS_URL ?? 'http://localhost:8002';
export const TRANSACTIONS_URL = process.env.TRANSACTIONS_URL ?? 'http://localhost:8004';
export const WALLET_URL = process.env.WALLET_URL ?? 'http://localhost:8003';
export const CARD_NETWORK_URL = process.env.CARD_NETWORK_URL ?? 'http://localhost:8102';

// The key that unlocks the test-only endpoints. Set TEST_KEY for any other environment.
export const TEST_KEY = process.env.TEST_KEY ?? 'cv-test-key-local';
