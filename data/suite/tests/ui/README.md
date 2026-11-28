# CardVault UI tests (Playwright)

Browser tests for the CardVault web app, written in TypeScript with
[Playwright Test](https://playwright.dev). Playwright opens a real browser,
clicks and types like a customer, and checks what the page shows.

The suite grows in two parts, following the lessons on the learning site:

1. `learn/`: one small, plain test file per Playwright lesson. No page objects
   and no helpers, so every line is visible.
2. The CardVault framework (page objects, fixtures, journeys): coming next.

## What is where

```
tests/ui/
  package.json          the tools (Playwright, TypeScript) and the npm scripts
  playwright.config.ts  the settings Playwright reads before every run
  tsconfig.json         settings for the TypeScript checker
  config.ts             where the app is, and the demo password
  learn/                Part 1: one small test file per lesson
    first-test.spec.ts    sign in and see the wallet
    locators.spec.ts      finding things: role, text, label, test id
    narrowing.spec.ts     one card out of four: filter, first, nth
    actions.spec.ts       select, check, fill, press, click
    assertions.spec.ts    web-first assertions that wait and retry
    waiting.spec.ts       waiting for rows and server answers, never for the clock
    forms.spec.ts         the dispute form: select, text area, file upload
    hooks.spec.ts         beforeAll, beforeEach, describe; every test starts clean
    fixtures.spec.ts      the built-in fixtures: page, context, browser, request, testInfo
    config.spec.ts        test.use: change a setting for one file (a narrow window)
    running.spec.ts       tags, choosing tests to run, skipping
    frames.spec.ts        the wallet terms inside an iframe
    tabs-dialogs-downloads.spec.ts   a new tab, confirm boxes, the CSV download
    network-mocking.spec.ts          page.route: fake an empty list, an error, a changed field
    time.spec.ts          a fake clock for the session timer; time zones and languages
    devices.spec.ts       pretend to be a phone
    api-requests.spec.ts  the request fixture; checking the page against the API
    saved-login.setup.ts  signs in once and saves the login (the setup project)
    saved-login.spec.ts   tests that start already signed in
    helpers/
      new-customer.ts     set-up: a brand-new customer with a purchase, or with a card
    files/
      receipt.png         a small picture the upload test sends
    typescript/
      basics.ts           values, types, arrays, objects, functions (no browser)
      async-await.ts      a tiny program that shows what await does
```

Most tests in `learn/` only read data: they sign in as the demo customer alice
and change nothing. Tests that change data (opening a dispute, adding a card,
closing a card) first create a brand-new customer of their own. That way every test can run in any
order and in parallel.

## Run it

You need Node.js 22 or newer, and CardVault running on your computer
(`make up && make seed` in the repository root).

```bash
cd tests/ui
npm install                      # the tools in package.json, once
npx playwright install chromium  # the browser Playwright drives, once

npx playwright test              # every test: 61 passed (60 tests and the setup step)
npx playwright test learn/first-test.spec.ts   # one file
npx playwright test --grep @smoke               # only the tests tagged @smoke
npx playwright test --headed     # watch the browser while it runs
npx playwright test --ui         # UI mode: pick tests, watch them, step back in time
npx playwright show-report       # open the HTML report of the last run
npm run typecheck                # check the TypeScript without running anything
node learn/typescript/basics.ts        # the TypeScript basics (no browser)
node learn/typescript/async-await.ts   # the await example (no browser)
```

Run the commands from `tests/ui`: file paths in the tests, such as the receipt
to upload, are relative to that folder.

To test another copy of the app, set `BASE_URL` (and, for the tests that call
services directly, the service addresses and `TEST_KEY`; see `config.ts`):

```bash
BASE_URL=https://cardvault.example.com npx playwright test
```

## CI

`.github/workflows/ui-tests.yml` starts CardVault in the GitHub runner, runs the
suite in Chromium and keeps the HTML report and the traces of failed tests.
