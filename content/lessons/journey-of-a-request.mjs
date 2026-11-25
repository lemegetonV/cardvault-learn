import { figure, keyIdea, testerEye, realWorld, terms, check, recap, code, sequence } from '../../src/components.mjs';
import { layers } from '../diagrams/inside.mjs';

const journey = sequence({
  id: 'seq-list-cards',
  label: 'A test asks the card service for alice’s cards. The request passes the request context, the fault layer and the token check, the handler reads the database, and the response goes back with the correlation ID.',
  actors: [
    { id: 'test', label: 'Your test', kind: 'plain' },
    { id: 'ctx', label: 'Request context', kind: 'plain' },
    { id: 'faults', label: 'Faults', kind: 'mock' },
    { id: 'card', label: 'Card handler', kind: 'bank' },
    { id: 'auth', label: 'auth (keys)', kind: 'bank' },
    { id: 'db', label: 'card database', kind: 'plain' },
  ],
  steps: [
    { from: 'test', to: 'ctx', label: 'GET /v1/cards', note: 'Your test sends `GET /v1/cards` to port 8002 with alice’s access token in `Authorization: Bearer …` and its own `X-Correlation-ID: run-42-cards`.' },
    { from: 'ctx', to: 'ctx', kind: 'self', label: 'keep or create the ID', note: 'The request context checks the correlation ID. `run-42-cards` uses only safe characters and is short enough, so it is kept. A missing or unsafe ID would be replaced with a fresh UUID.' },
    { from: 'ctx', to: 'faults', label: 'pass on', note: 'From now on, every log line this request writes carries `run-42-cards`.' },
    { from: 'faults', to: 'faults', kind: 'self', label: 'any fault for this path?', note: 'The fault layer checks whether a test has switched on a fault that matches `GET /v1/cards`. None is on, so the request carries on untouched.' },
    { from: 'faults', to: 'card', label: 'pass on', note: 'FastAPI finds the `list_cards` handler for this method and path.' },
    { from: 'card', to: 'auth', label: 'public keys (first time)', note: 'Before the handler runs, the token must be checked. The card service needs auth’s public keys to verify the signature. It fetches them once and keeps them, so most requests skip this step.' },
    { from: 'auth', to: 'card', kind: 'reply', label: 'keys', note: 'With the keys, the card service checks the token’s signature, issuer, audience and expiry itself. It does not ask auth about each request.' },
    { from: 'card', to: 'db', label: 'SELECT … alice’s cards', note: 'The token says the caller is alice, so the query only asks for cards whose `customer_id` is hers, newest first.' },
    { from: 'db', to: 'card', kind: 'reply', label: 'rows', note: 'The rows come back, and the handler turns each into the public card shape, which shows only the last four digits.' },
    { from: 'card', to: 'ctx', kind: 'reply', label: '200 { items, next_cursor }', note: 'The handler returns a page of cards, plus a cursor if there are more.' },
    { from: 'ctx', to: 'ctx', kind: 'self', label: 'add header, write log line', note: 'On the way out, the request context adds `X-Correlation-ID: run-42-cards` to the response and writes one access log line with the method, path, status and time taken.' },
    { from: 'ctx', to: 'test', kind: 'reply', label: '200 + X-Correlation-ID', note: 'Your test receives the response. If it fails an assertion, `run-42-cards` is the thread that ties its report to the service’s logs.' },
  ],
  caption: 'One read request, from your test to the database and back.',
});

export default {
  minutes: 12,
  lede: 'Between your test sending a request and the service’s own code running, several layers have already looked at it. This lesson follows one request through all of them, so that an error code tells you how far the request got before something said no.',
  youWill: 'You will follow a request step by step, read CardVault’s error shape, and trace a request through the logs.',
  body: `
<h2>One request, step by step</h2>
<p>The request is simple: alice’s test asks the card service for her cards. Press <strong>Start</strong> and step through it.</p>
${journey}
<p>Most of that journey is the same for every service, because <code>create_app</code> from <a href="/learn/one-codebase/">the previous lesson</a> adds the request context, the fault layer, the error handling and the health checks to each one. Only the handler and its database query are specific to the card service.</p>

<h2>The layers, and who can say no</h2>
<p>Each layer can stop a request and answer on its own. The order matters, because it decides which error you see when more than one thing is wrong.</p>
${figure({ svg: layers(), caption: 'Outer layers run first. Errors on the right are the ones each layer can return.' })}
<p>Two consequences are worth remembering:</p>
<ul>
<li>A request with <em>no token and a bad body</em> gets <code>401</code>, not <code>422</code>, because the caller check runs before the input checks. A body that is not valid JSON at all is the exception: FastAPI rejects it with <code>422</code> before reading the token.</li>
<li>A request for <em>someone else’s card</em> gets <code>404 CARD_NOT_FOUND</code>, not <code>403</code>. The service does not even admit that the card exists, so a caller cannot probe for other people’s card IDs.</li>
</ul>

<h2>One error shape everywhere</h2>
<p>Whichever layer answers, an error always has the same JSON shape. That is true in all five services, for every error, including validation failures and injected faults.</p>
${code({ lang: 'json', title: 'A wrong password at POST /v1/auth/login', src: `{
  "error_code": "INVALID_CREDENTIALS",
  "message": "Username or password is incorrect",
  "correlation_id": "run-42-login"
}` })}
<ul>
<li><code>error_code</code> is stable and made for machines. Tests should assert on it.</li>
<li><code>message</code> is for people, and its wording may change. Tests should not depend on it.</li>
<li><code>correlation_id</code> is the same ID as in the response header and the logs.</li>
<li><code>details</code> appears only when it adds something. For a <code>422</code> it lists each problem with its location, so you can tell which field was wrong.</li>
</ul>
<p>Every error code and its HTTP status is listed in the repository’s <code>docs/errors.md</code>.</p>
${keyIdea(`<p>Assert on the status <em>and</em> the <code>error_code</code>. Two different failures can share a status: a missing token and an expired token are both <code>401</code>, but one is <code>UNAUTHORIZED</code> and the other <code>TOKEN_EXPIRED</code>. Checking only the status cannot tell them apart.</p>`)}

<h2>The correlation ID</h2>
<p>A correlation ID is a label that travels with a piece of work, so you can find everything that work did. CardVault takes it from the <code>X-Correlation-ID</code> request header if it is safe to use, which means 1 to 128 characters made of letters, digits, dots, underscores, colons and hyphens. Otherwise it creates a new one.</p>
<p>It then goes everywhere the work goes: into every log line, onto every call to another service, into the header of every event, and into callbacks. So a single ID can follow a purchase from the network mock, through the card service, onto the event bus and into the transaction history.</p>
${testerEye(`<p>Send your own correlation ID with every request, made from the test’s name or run number. When a test fails, you can search the logs for that one ID and see exactly what each service did, instead of guessing from timestamps.</p>`)}

<h2>What a log line looks like</h2>
<p>Every service writes its logs as one JSON object per line. Here is the access log line for the request you stepped through:</p>
${code({ lang: 'json', title: 'docker compose logs card (one line, wrapped here)', src: `{"ts": "2026-11-25T09:14:03.512+00:00", "level": "INFO", "service": "card",
 "logger": "access", "msg": "GET /v1/cards 200", "correlation_id": "run-42-cards",
 "method": "GET", "path": "/v1/cards", "status": 200, "duration_ms": 8.4}` })}
<p>Because each line is JSON, you can filter by any field. The timestamp and duration above are examples; yours will differ. Before a line is written, anything that looks like a card number, a login token or a wallet token reference is replaced with a marker such as <code>[REDACTED_PAN]</code>, so the logs never hold those secrets.</p>
${realWorld(`<p>A real bank ships these lines to a central log store and keeps them for months. Card numbers in logs would bring the log store into the scope of card-industry audits, which is why masking happens before the line is written, not afterwards.</p>`)}

<h2>Two health checks</h2>
<p>Every service answers two extra endpoints that are not part of its business API.</p>
<ul>
<li><code>GET /health</code> returns <code>200</code> while the process is running. It answers “is it alive?”.</li>
<li><code>GET /ready</code> returns <code>200</code> only when the service can reach its database, and Redpanda if it uses events. Otherwise it returns <code>503</code> with a <code>checks</code> object saying which dependency failed. It answers “can it do its job?”.</li>
</ul>
<p>Docker Compose watches <code>/ready</code>, as you saw in <a href="/learn/running-cardvault/">Running CardVault yourself</a>. Neither endpoint writes an access log line, so they do not flood the logs.</p>

<h2>Words from this lesson</h2>
${terms([
  ['Middleware', 'Code that wraps every request: it runs before the handler and again on the way out.'],
  ['Correlation ID', 'A label that travels with a piece of work through logs, calls and events. Header: `X-Correlation-ID`.'],
  ['Error shape', 'CardVault’s one error body: `error_code`, `message`, `correlation_id`, and sometimes `details`.'],
  ['`error_code`', 'The stable, machine-readable name of an error. Tests assert on it instead of on the message.'],
  ['Liveness and readiness', '`/health` says the process is up; `/ready` says it can reach what it depends on.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test calls `GET /v1/cards/{card_id}` with alice’s valid token, using the ID of one of bob’s cards. What does the card service return?',
  options: ['`403 FORBIDDEN`', '`404 CARD_NOT_FOUND`', '`200` with bob’s card', '`401 TOKEN_INVALID`'],
  answer: 1,
  why: '<p>The handler looks the card up and treats a card that belongs to someone else exactly like one that does not exist. A <code>403</code> would confirm that the ID is real, which leaks information.</p>',
})}
${check({
  q: 'A test sends `POST /v1/profile/verify` with **no** `Authorization` header and a JSON body that is missing a required field. Which response comes back?',
  options: ['`422 VALIDATION_ERROR`', '`401 UNAUTHORIZED`', '`400 BAD_REQUEST`', '`500 INTERNAL_ERROR`'],
  answer: 1,
  why: '<p>The caller check runs before FastAPI reports missing fields, so the request is turned away for having no token. Only a body that is not valid JSON at all would be rejected with <code>422</code> first.</p>',
})}
${check({
  q: 'Your test sends `X-Correlation-ID: checkout test #7`. What happens to it?',
  options: ['It is used as is', 'The request is rejected with 400', 'It is replaced with a new UUID, which comes back in the response header', 'It is shortened to fit'],
  answer: 2,
  why: '<p>Spaces and <code>#</code> are not allowed, so the service ignores the value and creates its own ID. The request still succeeds, and the new ID is in the <code>X-Correlation-ID</code> response header, so a test can always read the ID that was really used.</p>',
})}

<h2>Recap</h2>
${recap([
  'Every request passes the same layers: request context, faults, routing, the caller check, input checks, then the service’s own rules.',
  'The layer order decides which error you see: a missing token wins over a missing field.',
  'Every error has the same shape. Assert on the status and `error_code`, not the message.',
  'The correlation ID follows the work through logs, calls and events. Send your own from tests.',
  'Logs are JSON lines with secrets masked. `/health` means alive; `/ready` means able to work.',
])}
`,
};
