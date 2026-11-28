// The shape of the site: three tracks of short lessons, plus facts the pages share.

export const site = {
  name: 'CardVault Learn',
  description: 'Interview prep for QA and SDET roles: understand the CardVault app, then learn to test it with pytest and Playwright.',
  cardvaultCommit: '1f8ae4b',
  cardvaultRepo: 'https://github.com/lemegetonV/cardvault',
};

// A lesson with `ready: false` shows in the contents as "soon" and is not built yet.
export const tracks = [
  {
    id: 'app',
    title: 'Know the app',
    short: 'The app',
    blurb: 'CardVault as a product: what it does, its screens, its services and how they connect. Enough to explain it in an interview.',
    modules: [
      {
        title: 'The product',
        blurb: 'What CardVault does for its customers, and what each screen is for.',
        lessons: [
          ['what-is-cardvault', 'What CardVault is', true],
          ['screen-tour', 'A tour of the screens', true],
        ],
      },
      {
        title: 'How it is built',
        blurb: 'The parts behind the screens, and three journeys through them.',
        lessons: [
          ['system-at-a-glance', 'The system at a glance', true],
          ['flow-login', 'Flow: logging in', true],
          ['flow-add-to-wallet', 'Flow: adding a card to the wallet', true],
          ['flow-purchase', 'Flow: a purchase', true],
        ],
      },
      {
        title: 'Talking about it',
        blurb: 'Explaining the architecture out loud, and deciding what to test.',
        lessons: [
          ['explain-the-architecture', 'Explaining the architecture in an interview', true],
          ['what-to-test', 'What I would test, and why', true],
        ],
      },
    ],
  },
  {
    id: 'pytest',
    title: 'API testing with Python and pytest',
    short: 'API testing',
    blurb: 'From your first line of Python to a small, clean API test framework for CardVault, with reports, a load test and interview practice.',
    modules: [
      {
        title: 'Getting started',
        blurb: 'The Python and HTTP you need, and a first test.',
        lessons: [
          ['py-python-for-tests', 'The Python you need for tests', true],
          ['py-http-for-testers', 'HTTP for testers', true],
          ['py-first-test', 'Your first test', true],
        ],
      },
      {
        title: 'The framework',
        blurb: 'The folder map first, then each file and why it exists.',
        lessons: [
          ['py-framework-map', 'The framework map', true],
          ['py-config', 'Config: where URLs and users live', true],
          ['py-api-clients', 'API client classes', true],
          ['py-logging', 'Logging every request and response', true],
          ['py-fixtures', 'Fixtures and conftest.py', true],
          ['py-test-data', 'Test data', true],
        ],
      },
      {
        title: 'Writing good tests',
        blurb: 'Choosing cases, negative tests, many cases at once, shapes and whole flows.',
        lessons: [
          ['py-test-design', 'Test design techniques', true],
          ['py-negative-tests', 'Positive and negative tests', true],
          ['py-parametrize', 'Many cases with parametrize', true],
          ['py-response-shape', 'Checking the shape of a response', true],
          ['py-flow-test', 'A flow test', true],
        ],
      },
      {
        title: 'Behind the API',
        blurb: 'Looking past the responses: the database, the events, and the services you do not own.',
        lessons: [
          ['py-database-checks', 'Database checks in API tests', true],
          ['py-kafka-events', 'Testing Kafka and event flows', true],
          ['py-mocks-contracts', 'Mocks and contract tests', true],
        ],
      },
      {
        title: 'Running and reporting',
        blurb: 'Choosing what to run, reports, debugging a failure, flaky tests and CI.',
        lessons: [
          ['py-markers', 'Markers and running a subset', true],
          ['py-reports', 'Reports: pytest-html and JUnit', true],
          ['py-allure', 'Allure reports', true],
          ['py-debugging', 'Debugging a failed API test', true],
          ['py-flaky-and-parallel', 'Flaky tests, waits and parallel runs', true],
          ['py-ci', 'Running in CI', true],
        ],
      },
      {
        title: 'Performance testing with Locust',
        blurb: 'How fast is fast enough: load tests, the numbers that matter, and a pass or fail check.',
        lessons: [
          ['py-perf-basics', 'Performance testing basics', true],
          ['py-perf-locustfile', 'Your first locustfile', true],
          ['py-perf-running', 'Running Locust and reading the results', true],
          ['py-perf-pass-fail', 'Pass or fail: budgets and CI', true],
        ],
      },
      {
        title: 'Interview topics',
        blurb: 'What interviewers ask beyond the basics, each shown on CardVault.',
        lessons: [
          ['py-auth', 'Authentication and authorisation', true],
          ['py-security', 'API security basics', true],
          ['py-api-behaviours', 'Pages, safe retries, versions and limits', true],
        ],
      },
      {
        title: 'Interview practice',
        blurb: 'Saying it out loud and writing it on the spot.',
        lessons: [
          ['py-practice-framework', 'Tell me about your framework', true],
          ['py-practice-endpoint', 'Live coding: tests for an endpoint', true],
          ['py-practice-data', 'Live coding: working with response data', true],
          ['py-practice-fixtures', 'Live coding: fixtures, parametrize and a red CI log', true],
        ],
      },
    ],
  },
  {
    id: 'playwright',
    title: 'UI testing with TypeScript and Playwright',
    short: 'UI testing',
    blurb: 'Playwright from the ground up, every core concept shown on the CardVault web app, then a clean test framework, CI and interview practice.',
    modules: [
      {
        title: 'Getting started',
        blurb: 'What Playwright is, the TypeScript you need, and a first browser test.',
        lessons: [
          ['pw-what-is-playwright', 'What Playwright is', true],
          ['pw-typescript-basics', 'The TypeScript you need, part 1', true],
          ['pw-async-await', 'The TypeScript you need, part 2: async and await', true],
          ['pw-project', 'A Playwright project', true],
          ['pw-first-test', 'Your first Playwright test', true],
          ['pw-reading-failures', 'Reading a failure', true],
        ],
      },
      {
        title: 'Finding things and acting on them',
        blurb: 'Locators, actions, assertions that wait, and forms.',
        lessons: [
          ['pw-locators', 'Locators: finding things on the page', true],
          ['pw-narrowing', 'Narrowing a match', true],
          ['pw-actions', 'Actions and auto-waiting', true],
          ['pw-assertions', 'Web-first assertions', true],
          ['pw-waiting', 'Waiting the right way', true],
          ['pw-forms', 'Forms and uploads', true],
        ],
      },
      {
        title: 'The test runner',
        blurb: 'Hooks, isolation, built-in fixtures, the config file and the command line.',
        lessons: [
          ['pw-hooks-isolation', 'Hooks and test isolation', true],
          ['pw-builtin-fixtures', 'Built-in fixtures', true],
          ['pw-config', 'The config file and projects', true],
          ['pw-running-tests', 'Running what you want', true],
        ],
      },
      {
        title: 'Beyond one page',
        blurb: 'Frames, tabs, dialogs, downloads, the network, time, devices, API calls and saved logins.',
        lessons: [
          ['pw-frames', 'Frames', true],
          ['pw-tabs-dialogs-downloads', 'Tabs, dialogs and downloads', true],
          ['pw-network-mocking', 'Mocking the network', true],
          ['pw-time-devices', 'Time, places and devices', true],
          ['pw-api-requests', 'API requests in Playwright', true],
          ['pw-saved-login', 'Logging in once', true],
        ],
      },
      {
        title: 'Seeing what happened',
        blurb: 'Debugging, reports, flaky tests, screenshots that compare, and parallel runs.',
        lessons: [
          ['pw-debugging', 'Debugging: trace viewer and UI mode', false],
          ['pw-reports', 'Reports and evidence', false],
          ['pw-flaky-tests', 'Flaky tests', false],
          ['pw-visual', 'Visual comparisons', false],
          ['pw-parallel', 'Parallel runs and sharding', false],
        ],
      },
      {
        title: 'The CardVault framework',
        blurb: 'The folder map first, then each part and why it exists.',
        lessons: [
          ['pw-framework-map', 'The framework map', false],
          ['pw-page-objects', 'Page objects', false],
          ['pw-custom-fixtures', 'Custom fixtures', false],
          ['pw-api-setup', 'API set-up for UI tests', false],
          ['pw-test-data', 'Test data and config', false],
        ],
      },
      {
        title: 'Real tests',
        blurb: 'Whole customer journeys, on desktop and phone.',
        lessons: [
          ['pw-journey-wallet', 'Journey: add a card to the wallet', false],
          ['pw-journey-disputes', 'Journey: transactions and disputes', false],
          ['pw-phones-browsers', 'Phones and other browsers', false],
        ],
      },
      {
        title: 'CI and interview practice',
        blurb: 'Running in CI, then saying it out loud and writing it on the spot.',
        lessons: [
          ['pw-ci', 'Running in CI', false],
          ['pw-practice-framework', 'Tell me about your framework', false],
          ['pw-practice-live-coding', 'Live coding', false],
          ['pw-interview-questions', 'Playwright interview questions', false],
        ],
      },
    ],
  },
];

/** Flat list of every lesson with its position (numbered within its track). */
export function allLessons() {
  const out = [];
  for (const t of tracks) {
    let n = 0;
    t.modules.forEach((m, mi) => {
      for (const [id, title, ready] of m.lessons) {
        n += 1;
        out.push({ id, title, ready: !!ready, n, module: m.title, moduleNo: mi + 1, track: t.id, trackTitle: t.title });
      }
    });
  }
  return out;
}

export const lessonUrl = (id) => `/learn/${id}/`;
