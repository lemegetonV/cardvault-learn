// Diagrams for the API test suite track.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

const mono = (x, y, s, { size = 12.5, anchor = 'middle', ink = true } = {}) =>
  `<text class="t-mono" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;

/** The suite outside the stack, and the four ways it looks in. */
export function outsideIn() {
  let b = '';
  b += box(20, 140, 180, 120, 'the suite', { kind: 'plain', sub: 'tests/api', cls: 't-lg' });
  b += `<rect class="box-plain" x="290" y="14" width="610" height="350" rx="16"/>`;
  b += text(880, 40, 'a running CardVault (local or stage)', 't-sm t-muted', 'end');
  const bank = ['auth', 'card', 'enrollment', 'wallet-txn', 'profile'];
  bank.forEach((n, i) => { b += box(312 + i * 116, 58, 104, 44, n, { kind: 'bank', cls: 't-md' }); });
  b += box(312, 150, 220, 44, 'network mock', { kind: 'mock', cls: 't-md' });
  b += box(546, 150, 220, 44, 'operator mock', { kind: 'mock', cls: 't-md' });
  b += box(312, 250, 330, 44, 'Kafka topics', { kind: 'event', cls: 't-md' });
  b += box(660, 250, 220, 44, 'Postgres', { kind: 'plain', cls: 't-md' });
  // the four ways in, each leaving the suite's right edge
  b += arrow([[200, 152], [262, 152], [262, 80], [312, 80]], 'ln', 'ah');
  b += text(270, 124, 'HTTP', 't-sm', 'start');
  b += arrow([[200, 172], [312, 172]], 'ln-mock', 'ah-mock');
  b += text(208, 190, 'controls', 't-sm t-muted', 'start');
  b += arrow([[200, 226], [280, 226], [280, 272], [312, 272]], 'ln-event', 'ah-event');
  b += text(208, 218, 'events', 't-sm t-muted', 'start');
  b += arrow([[200, 248], [240, 248], [240, 330], [770, 330], [770, 294]], 'ln-faint', 'ah');
  b += text(320, 350, 'read-only SQL, for what no API shows', 't-sm t-muted', 'start');
  return svg(920, 372, 'The suite sits outside a running CardVault. It talks to the five bank services over HTTP, controls the two mocks, reads Kafka topics, and reads Postgres with a read-only role only for facts no API shows.', b);
}

/** The layers of tools, from the language up to the tests. */
export function toolLayers() {
  const rows = [
    ['tests/<area>/test_*.py', 'what to check, one file per area of the spec', 'bank'],
    ['cardvault_tests', 'the suite’s own code: clients, models, checks, waits', 'plain'],
    ['pytest', 'finds tests, runs them, fixtures, markers, reports', 'mock'],
    ['httpx · pydantic · uv', 'HTTP calls · response shapes · installs everything', 'mock'],
    ['Python 3.12+', 'the language', 'plain'],
  ];
  let b = '';
  rows.forEach(([t, d, k], i) => {
    const y = 14 + i * 58;
    b += `<rect class="box-${k}" x="20" y="${y}" width="820" height="48" rx="10"/>`;
    b += mono(40, y + 30, t, { size: 14, anchor: 'start' });
    b += text(330, y + 30, d, 't-sm t-muted', 'start');
  });
  return svg(860, 14 + rows.length * 58, 'Five layers. At the bottom, Python. Above it, three libraries: httpx for HTTP, pydantic for response shapes, uv to install it all. Then pytest, which runs tests. Then cardvault_tests, the suite’s own code. At the top, the test files.', b);
}

/** Where a setting comes from, first match wins. */
export function settingsOrder() {
  const rows = [
    ['environment variable', 'TEST_KEY=… uv run pytest', 'wins over everything'],
    ['.env.stage', 'untracked, for secrets', ''],
    ['envs/stage.env', 'committed, no secrets', ''],
    ['default in settings.py', 'e.g. http_timeout_seconds = 10', 'used when nothing else says'],
  ];
  let b = '';
  rows.forEach(([t, s, n], i) => {
    const y = 16 + i * 66;
    b += box(80, y, 300, 50, t, { kind: i === 1 ? 'stop' : 'plain', cls: 't-md' });
    b += mono(400, y + 31, s, { size: 12.5, anchor: 'start', ink: false });
    if (n) b += text(840, y + 31, n, 't-sm t-muted', 'end');
    if (i < rows.length - 1) b += arrow([[230, y + 50], [230, y + 66]], 'ln-faint', 'ah');
  });
  b += text(40, 40, '1st', 't-sm t-muted', 'start');
  b += text(40, 238, 'last', 't-sm t-muted', 'start');
  return svg(860, 16 + rows.length * 66, 'A setting is looked up in four places, first match wins: an environment variable, then the untracked secrets file .env.stage, then the committed envs/stage.env, then the default in settings.py.', b);
}

/** One request through the client: auth, correlation ID, send, record. */
export function requestHooks() {
  const steps = [
    ['client.get("/v1/cards")', 'plain', 'the test asks'],
    ['auth adds credentials', 'plain', 'Authorization: Bearer …'],
    ['request hook', 'plain', 'X-Correlation-ID: t-…'],
    ['card service', 'bank', '200 + JSON'],
    ['response hook', 'plain', 'record the exchange'],
  ];
  let b = '';
  steps.forEach(([t, k, sub], i) => {
    const x = 16 + i * 178;
    b += box(x, 30, 160, 56, t, { kind: k, cls: i === 0 ? 't-mono' : 't-sm' });
    b += text(x + 80, 112, sub, 't-sm t-muted');
    if (i < steps.length - 1) b += arrow([[x + 160, 58], [x + 178, 58]], 'ln', 'ah');
  });
  return svg(906, 126, 'A request leaves the test, the auth object adds the credentials, the request hook adds a fresh correlation ID, the service answers, and the response hook records the exchange as evidence.', b);
}

/** What happens once per run, then per test. */
export function runOrder() {
  let b = '';
  b += `<rect class="box-plain" x="20" y="14" width="430" height="176" rx="14"/>`;
  b += text(40, 42, 'once per run (pytest_sessionstart)', 't-md', 'start');
  const once = ['wait for every /ready', 'reset every service and mock', 'clear the clock offset', 'load the seed data'];
  once.forEach((s, i) => {
    const y = 74 + i * 30;
    b += `<circle class="dot" cx="50" cy="${y - 4}" r="9"/><text class="t-mono" x="50" y="${y}" text-anchor="middle" style="fill:var(--surface);font-size:11px">${i + 1}</text>`;
    b += text(70, y, s, 't-sm', 'start');
  });
  b += arrow([[450, 102], [510, 102]], 'ln', 'ah');
  b += `<rect class="box-bank" x="510" y="14" width="390" height="176" rx="14"/>`;
  b += text(530, 42, 'then, for every test', 't-md', 'start');
  const each = ['set up what it asks for (fixtures)', 'act: send the request', 'check the answer', 'tidy up, pass or fail'];
  each.forEach((s, i) => {
    const y = 74 + i * 30;
    b += `<circle class="dot" cx="540" cy="${y - 4}" r="9"/><text class="t-mono" x="540" y="${y}" text-anchor="middle" style="fill:var(--surface);font-size:11px">${i + 1}</text>`;
    b += text(560, y, s, 't-sm', 'start');
  });
  return svg(920, 204, 'Once per run, before any test: wait for every service to be ready, reset everything, clear the clock offset and load the seed data. Then every test sets up what it needs, acts, checks and tidies up.', b);
}

/** Fixture dependencies (not an order of execution). */
export function fixtureGraph() {
  const node = (x, y, w, label, kind, sub) => box(x, y, w, 46, label, { kind, sub, cls: 't-mono' });
  let b = '';
  b += node(20, 20, 150, 'settings', 'plain', 'session');
  b += node(230, 20, 150, 'services', 'plain', 'session');
  b += node(230, 110, 150, 'controls', 'plain', 'session');
  b += node(440, 110, 170, 'orchestrator', 'plain', 'session');
  b += node(440, 20, 170, 'alice', 'plain', 'session');
  b += node(680, 66, 190, 'make_customer', 'plain', 'function');
  b += node(680, 160, 190, 'shared_clock', 'plain', 'function');
  const a = (p) => { b += arrow(p, 'ln-faint', 'ah'); };
  a([[170, 43], [230, 43]]);
  a([[95, 66], [95, 133], [230, 133]]);
  a([[380, 43], [440, 43]]);
  a([[380, 133], [440, 133]]);
  a([[610, 133], [660, 133], [660, 100], [680, 100]]);
  a([[420, 43], [420, 88], [650, 88], [650, 78], [680, 78]]);
  a([[380, 150], [400, 150], [400, 183], [680, 183]]);
  b += text(20, 230, 'An arrow means “is given to”. pytest works out the order from these needs.', 't-sm t-muted', 'start');
  return svg(890, 242, 'Fixtures and what each one is given. settings feeds services and controls. services feeds alice and make_customer. controls feeds orchestrator, which feeds make_customer, and controls also feeds shared_clock. alice and the clients are created once per run; make_customer and shared_clock once per test.', b);
}
