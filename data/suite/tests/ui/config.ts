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
