// The shape of the site: tracks, modules and lessons, plus facts the pages share.

export const site = {
  name: 'CardVault Learn',
  description: 'Learn how CardVault works: a simulated bank wallet built to be tested.',
  cardvaultCommit: 'fa94037',
  // The API test suite (tests/api) that the second track describes.
  suiteCommit: 'b9eb9d0',
  cardvaultRepo: 'https://github.com/lemegetonV/cardvault',
  stageApp: 'https://cardvault.140-245-206-220.sslip.io',
  stageDocs: 'https://docs.140-245-206-220.sslip.io',
  // Runs one test on stage and streams pytest's output (password-protected, the owner's tool).
  stageRunner: 'https://run.140-245-206-220.sslip.io',
};

// A lesson with `ready: false` shows in the contents as "soon" and is not built yet.
export const tracks = [
  {
    id: 'understand',
    title: 'Understanding CardVault',
    blurb: 'How the system is built, why, and what that means when you test it.',
    modules: [
      {
        title: 'The big picture',
        blurb: 'What CardVault is, the payments ideas it rests on, and how its parts fit together.',
        lessons: [
          ['what-is-cardvault', 'What CardVault is', true],
          ['payments-in-plain-words', 'Cards, wallets and payments in plain words', true],
          ['the-system-map', 'The system map', true],
          ['running-cardvault', 'Running CardVault yourself', true],
        ],
      },
      {
        title: 'Inside one service',
        blurb: 'The shared skeleton every service is built on, from the folder layout to the clock.',
        lessons: [
          ['one-codebase', 'One codebase, many services', true],
          ['journey-of-a-request', 'The journey of one request', true],
          ['each-service-owns-its-data', 'Each service owns its data', true],
          ['the-shared-clock', 'The shared clock', true],
        ],
      },
      {
        title: 'Identity and trust',
        blurb: 'How customers log in, how machines prove who they are, and the cryptography underneath.',
        lessons: [
          ['login-and-tokens', 'Customer login and tokens', true],
          ['machines-calling-machines', 'Machines that call machines', true],
          ['cryptography', 'The cryptography underneath (optional)', true],
        ],
      },
      {
        title: 'Cards and money',
        blurb: 'The card master, safe retries, and how a purchase is approved, held and cleared.',
        lessons: [
          ['card-lifecycle', 'The card and its lifecycle', true],
          ['idempotency-keys', 'Safe retries with idempotency keys', true],
          ['authorization', 'Deciding an authorization', true],
          ['holds-and-clearing', 'Holds and clearing', true],
          ['network-mock', 'The network mock', true],
        ],
      },
      {
        title: 'Events',
        blurb: 'Why services talk in events, and how CardVault makes sure no event is lost or applied twice.',
        lessons: [
          ['why-events', 'Why services talk in events', true],
          ['transactional-outbox', 'The transactional outbox', true],
          ['consumers-and-dead-letters', 'Consumers, retries and dead letters', true],
        ],
      },
      {
        title: 'The wallet',
        blurb: 'Contact details, eligibility, enrolment with the operator, callbacks and reconciliation.',
        lessons: [
          ['contact-details', 'Contact details and verification', true],
          ['eligibility', 'Who may join the wallet', true],
          ['enrolment', 'Enrolment and the wallet operator', true],
          ['callbacks', 'Callbacks in depth', true],
          ['when-a-card-changes', 'When a card changes', true],
          ['reconciliation', 'Reconciliation', true],
        ],
      },
      {
        title: 'Wallet transactions',
        blurb: 'A customer-facing record built from events, its lists and export, and disputes.',
        lessons: [
          ['record-from-events', 'A record built from events', true],
          ['lists-and-export', 'Lists, filters and the CSV export', true],
          ['disputes', 'Disputes', true],
        ],
      },
      {
        title: 'The web app',
        blurb: 'The Next.js app and its backend-for-frontend, browser security, and UI behaviour tests will meet.',
        lessons: [
          ['web-and-bff', 'Next.js and the BFF', true],
          ['browser-security', 'Browser security', true],
          ['ui-behaviour', 'What the UI does that tests will meet', true],
        ],
      },
      {
        title: 'Built for testing',
        blurb: 'The controls that make CardVault testable, and reading every design choice as a test idea.',
        lessons: [
          ['test-controls', 'Test controls', true],
          ['faults-and-seeded-bugs', 'Faults and seeded bugs', true],
          ['locks-and-concurrency', 'Locks and concurrency (optional)', true],
          ['ci-and-budget', 'CI and the resource budget (optional)', true],
          ['design-as-a-tester', 'Reading the design as a tester', true],
        ],
      },
    ],
  },
  {
    id: 'api-suite',
    title: 'The API test suite',
    blurb: 'How CardVault’s pytest suite is built, one idea at a time, and why each piece exists.',
    modules: [
      {
        title: 'Before the first test',
        blurb: 'What an outside-in API suite is for, the tools it is made of, and how it knows where to point.',
        lessons: [
          ['suite-what-and-why', 'What the suite is for', true],
          ['suite-tools', 'The tools and who does what', true],
          ['suite-settings', 'Settings and environments', true],
        ],
      },
      {
        title: 'The first tests',
        blurb: 'From one health check to clients, models and fixtures that every later test reuses.',
        lessons: [
          ['suite-first-test', 'The first test', true],
          ['suite-clients', 'Clients and credentials', true],
          ['suite-checks', 'Checking a response, and where the expectation comes from', true],
          ['suite-fixtures', 'Fixtures', true],
        ],
      },
      {
        title: 'Data, time and isolation',
        blurb: 'Fresh data for every test, running in parallel safely, moving the clock and waiting without sleeping.',
        lessons: [
          ['suite-fresh-customers', 'A fresh customer for every test', true],
          ['suite-parallel-serial', 'Parallel and serial tests', true],
          ['suite-moving-time', 'Moving the clock', true],
          ['suite-waiting', 'Waiting without sleeping', true],
        ],
      },
      {
        title: 'Testing the money',
        blurb: 'Tables of cases, arithmetic worked out by hand, and requests that repeat or race.',
        lessons: [
          ['suite-tables-of-cases', 'Tables of cases', true],
          ['suite-money-maths', 'Money worked out by hand', true],
          ['suite-retries-and-races', 'Retries and races', true],
        ],
      },
      {
        title: 'Testing the wallet',
        blurb: 'Rules with boundaries, a flow that finishes later, an operator that misbehaves on purpose, and reconciliation.',
        lessons: [
          ['suite-eligibility', 'Rules and their boundaries', true],
          ['suite-async-flows', 'A flow that finishes later', true],
          ['suite-playing-the-operator', 'Playing the operator', true],
          ['suite-reconciliation', 'Testing reconciliation', true],
        ],
      },
      {
        title: 'Beyond the response',
        blurb: 'Events, the database, security rules and whole customer journeys.',
        lessons: [
          ['suite-reading-events', 'Reading events', true],
          ['suite-messy-delivery', 'Messy delivery on purpose', true],
          ['suite-database', 'Looking in the database', true],
          ['suite-security', 'Who may call what', true],
          ['suite-journeys', 'Customer journeys', true],
        ],
      },
      {
        title: 'Running it for real',
        blurb: 'Evidence when a test fails, the CI pipeline, and running against stage.',
        lessons: [
          ['suite-evidence', 'Evidence when a test fails', true],
          ['suite-ci', 'The suite in CI', true],
          ['suite-stage', 'Running against stage', true],
        ],
      },
    ],
  },
  { id: 'ui-suite', title: 'The UI test suite', blurb: 'Building the Playwright suite for CardVault, step by step.', later: true, modules: [] },
];

/** Flat list of every lesson with its position. */
export function allLessons() {
  const out = [];
  for (const t of tracks) {
    let n = 0; // lessons are numbered within their track
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
