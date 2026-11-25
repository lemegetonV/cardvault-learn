// The shape of the site: three tracks of short lessons, plus facts the pages share.

export const site = {
  name: 'CardVault Learn',
  description: 'Interview prep for QA and SDET roles: understand the CardVault app, then learn to test it with pytest and Playwright.',
  cardvaultCommit: '991fbdc',
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
          ['flow-login', 'Flow: logging in', false],
          ['flow-add-to-wallet', 'Flow: adding a card to the wallet', false],
          ['flow-purchase', 'Flow: a purchase', false],
        ],
      },
      {
        title: 'Talking about it',
        blurb: 'Explaining the architecture out loud, and deciding what to test.',
        lessons: [
          ['explain-the-architecture', 'Explaining the architecture in an interview', false],
          ['what-to-test', 'What I would test, and why', false],
        ],
      },
    ],
  },
  {
    id: 'pytest',
    title: 'API testing with Python and pytest',
    short: 'API testing',
    blurb: 'From your first line of Python to a small, clean API test framework for CardVault.',
    modules: [
      {
        title: 'Getting started',
        blurb: 'The Python and HTTP you need, and a first test.',
        lessons: [
          ['py-python-for-tests', 'The Python you need for tests', false],
          ['py-http-for-testers', 'HTTP for testers', false],
          ['py-first-test', 'Your first test', false],
        ],
      },
      {
        title: 'The framework',
        blurb: 'The folder map first, then each file and why it exists.',
        lessons: [
          ['py-framework-map', 'The framework map', false],
          ['py-config', 'Config: where URLs and users live', false],
          ['py-api-clients', 'API client classes', false],
          ['py-fixtures', 'Fixtures and conftest.py', false],
          ['py-test-data', 'Test data', false],
        ],
      },
      {
        title: 'Writing good tests',
        blurb: 'Negative cases, many cases at once, and whole flows.',
        lessons: [
          ['py-negative-tests', 'Positive and negative tests', false],
          ['py-parametrize', 'Many cases with parametrize', false],
          ['py-flow-test', 'A flow test', false],
        ],
      },
      {
        title: 'Running it',
        blurb: 'Choosing what to run, reading failures, and CI.',
        lessons: [
          ['py-markers', 'Markers and running a subset', false],
          ['py-reports', 'Reports and reading a failure', false],
          ['py-ci', 'Running in CI', false],
        ],
      },
    ],
  },
  {
    id: 'playwright',
    title: 'UI testing with TypeScript and Playwright',
    short: 'UI testing',
    blurb: 'The TypeScript you need and a clean Playwright framework that tests the CardVault web app.',
    modules: [
      {
        title: 'Getting started',
        blurb: 'TypeScript basics and a first browser test.',
        lessons: [
          ['pw-typescript-for-tests', 'The TypeScript you need for tests', false],
          ['pw-first-test', 'Your first Playwright test', false],
          ['pw-framework-map', 'The framework map', false],
        ],
      },
      {
        title: 'The building blocks',
        blurb: 'Finding things on the page, checking them, and organising the code.',
        lessons: [
          ['pw-locators', 'Locators: finding things on the page', false],
          ['pw-assertions', 'Assertions and auto-waiting', false],
          ['pw-page-objects', 'Page objects', false],
          ['pw-fixtures', 'Fixtures and logging in once', false],
        ],
      },
      {
        title: 'Real tests',
        blurb: 'Journeys, API set-up, evidence and CI.',
        lessons: [
          ['pw-journey', 'A full user journey', false],
          ['pw-api-setup', 'Using the API to set up a UI test', false],
          ['pw-evidence', 'Screenshots, traces and reports', false],
          ['pw-ci', 'Running in CI', false],
          ['pw-interview', 'Explaining it in an interview', false],
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
