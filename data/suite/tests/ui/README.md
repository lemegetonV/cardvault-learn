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
    typescript/
      async-await.ts      a tiny program that shows what await does
```

Every test in `learn/` only reads data (it signs in as the demo customer alice
and changes nothing), so the tests can run in any order and in parallel.

## Run it

You need Node.js 22 or newer, and CardVault running on your computer
(`make up && make seed` in the repository root).

```bash
cd tests/ui
npm install                      # the tools in package.json, once
npx playwright install chromium  # the browser Playwright drives, once

npx playwright test              # every test: 22 passed
npx playwright test learn/first-test.spec.ts   # one file
npx playwright test --headed     # watch the browser while it runs
npx playwright test --ui         # UI mode: pick tests, watch them, step back in time
npx playwright show-report       # open the HTML report of the last run
npm run typecheck                # check the TypeScript without running anything
node learn/typescript/async-await.ts   # the await example (no browser)
```

To test another copy of the app, set `BASE_URL`:

```bash
BASE_URL=https://cardvault.example.com npx playwright test
```

## CI

`.github/workflows/ui-tests.yml` starts CardVault in the GitHub runner, runs the
suite in Chromium and keeps the HTML report and the traces of failed tests.
