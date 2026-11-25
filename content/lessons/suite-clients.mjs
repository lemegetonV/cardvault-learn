import { figure, keyIdea, testerEye, terms, check, recap, code, table } from '../../src/components.mjs';
import { requestHooks } from '../diagrams/suite.mjs';

export default {
  minutes: 12,
  lede: 'A test that builds every URL and header by hand is long, and it repeats the same details hundreds of times. Once there are more than a few tests, the suite needs one place that knows how to reach each service and how to prove who is calling. This lesson builds that place out of httpx.',
  youWill: 'You will learn how one httpx client per service works, how the three kinds of credential are added, how every request gets a correlation ID, and what a client class adds on top.',
  body: `
<h2>One client per service</h2>
<p>httpx sends a request with a <strong>client</strong>, an object that holds settings shared by every request it sends: a base address, a timeout, connection reuse, and hooks. The suite makes one client per service, once per run:</p>
${code({ title: 'tests/api/src/cardvault_tests/http.py (part)', src: `
def make_client(base_url: str, timeout: float, record: bool = True) -> httpx.Client:
    return httpx.Client(
        base_url=base_url,
        timeout=timeout,
        event_hooks={"request": [_add_correlation_id], "response": [_record] if record else []},
    )
` })}
<ul>
<li><code>base_url</code> comes from the settings, so a test writes only the path: <code>client.get("/v1/cards")</code>.</li>
<li><code>timeout</code> limits how long one call may wait. Without it, a hung service would hang the test forever. It is 10 seconds locally and 20 on stage.</li>
<li><code>event_hooks</code> are functions httpx calls around every request: one just before it is sent, one as soon as the response arrives.</li>
</ul>

<h2>The journey of one call</h2>
${figure({ svg: requestHooks(), caption: 'What happens between a test writing one line and the answer coming back. Only the card service is CardVault; everything else is the suite.' })}
<p>The <strong>request hook</strong> adds an <code>X-Correlation-ID</code> header: <code>t-</code> followed by 12 random hexadecimal characters. CardVault copies that ID into every log line and every event it produces for the request (the first track’s <a href="/learn/journey-of-a-request/">journey of one request</a> showed how). So when a test fails, its ID finds everything each service did for it. The <strong>response hook</strong> records the exchange as evidence, which <a href="/learn/suite-evidence/">Evidence when a test fails</a> puts to use.</p>

<h2>Credentials as Auth objects</h2>
<p>CardVault has three kinds of caller, and each proves itself with a different header:</p>
${table(['Caller', 'Header', 'Used for'], [
  ['A customer', '`Authorization: Bearer <access token>`', 'The customer APIs'],
  ['A machine (here, “tests”)', '`X-Service-Key: <key>`', 'Internal endpoints such as card authorizations'],
  ['A test harness', '`X-Test-Key: <key>`', 'The `/test/*` controls'],
])}
<p>httpx has a standard way to add credentials: an <strong>Auth</strong> class, whose <code>auth_flow</code> method receives each request just before it leaves and may change it. The suite defines one per kind of caller:</p>
${code({ title: 'tests/api/src/cardvault_tests/auth.py (part)', src: `
class BearerAuth(httpx.Auth):
    """Sends \`\`Authorization: Bearer <token>\`\`. \`\`token\`\` can be replaced after a refresh."""

    def __init__(self, token: str) -> None:
        self.token = token

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        request.headers["Authorization"] = f"Bearer {self.token}"
        yield request
` })}
<p><code>yield request</code> hands the changed request back to httpx to send. (A <code>yield</code> makes the method a generator, which lets a more complex Auth class look at the response and send a second request; these three never need to.) <code>ServiceKeyAuth</code> and <code>TestKeyAuth</code> are the same idea with a fixed header name.</p>
<p>Because credentials are an object passed with the call, a test can swap the caller in one place. Sending alice’s request with no auth, or with a service key instead of her token, is how <a href="/learn/suite-security/">Who may call what</a> checks that each door refuses the wrong proof.</p>

<h2>Client classes: one method per endpoint</h2>
<p>On top of the raw httpx client, each API area has a small class with one method per endpoint. It knows the paths and optional headers, and nothing about tests:</p>
${code({ title: 'tests/api/src/cardvault_tests/clients/cards.py (part)', src: `
class CardsClient:
    """card-service customer API. Every call is made as the customer whose auth it holds."""

    def __init__(self, http: httpx.Client, auth: httpx.Auth) -> None:
        self.http = http
        self.auth = auth

    def get(self, card_id: object) -> httpx.Response:
        return self.http.get(f"/v1/cards/{card_id}", auth=self.auth)

    def report_lost(self, card_id: object, idempotency_key: str | None = None) -> httpx.Response:
        return self._post(f"/v1/cards/{card_id}/report-lost", idempotency_key)
` })}
<p>Each method returns the raw <code>httpx.Response</code>. It does not check the status or unpack the body, because the test decides what counts as right: the same call is expected to give <code>200</code> in one test and <code>409</code> in another. A client that raised on anything other than <code>200</code> would make the second test impossible to write.</p>
${keyIdea(`<p>Clients know <em>how to reach</em> CardVault; tests know <em>what should happen</em>. Keeping those apart is what lets one client method serve both the happy path and every refusal.</p>`)}
${testerEye(`<p>Every failure message in the suite includes the correlation ID of each request the test sent. Search the services’ logs for it and you see the request from CardVault’s side, across every service it touched.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['httpx client', 'An object that sends requests with shared settings: base URL, timeout, hooks.'],
  ['Event hook', 'A function httpx calls just before a request is sent or just after a response arrives.'],
  ['Correlation ID', 'The `X-Correlation-ID` the suite puts on every request, followed through CardVault’s logs and events.'],
  ['Auth class', 'An `httpx.Auth` that adds a caller’s credentials to each request.'],
  ['Client class', 'The suite’s wrapper with one method per endpoint, returning the raw response.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'Why does `CardsClient.report_lost` return the raw response instead of checking that it is `200`?',
  options: ['To save time', 'Because some tests expect a refusal such as `409`, and the test should decide what is right', 'httpx cannot check status codes', 'Because the card service never fails'],
  answer: 1,
  why: '<p>A closed card cannot be reported lost, and a test checks exactly that by expecting <code>409</code>. If the client decided <code>200</code> was the only right answer, that test could not exist.</p>',
})}
${check({
  q: 'A test fails and the message shows `[X-Correlation-ID: t-3f9c01a2b7de]`. What is that ID good for?',
  options: ['Re-running the test', 'Finding every log line and event CardVault produced for that request', 'Logging in as the same customer', 'Nothing; it is random'],
  answer: 1,
  why: '<p>The suite chose the ID and CardVault carries it through every service, log line and event caused by the request, so it connects the test’s view with the system’s.</p>',
})}

<h2>Recap</h2>
${recap([
  'One httpx client per service holds the base URL, a timeout and two hooks.',
  'The request hook adds a correlation ID; the response hook records evidence.',
  'Customer tokens, service keys and the test key are three `httpx.Auth` classes.',
  'Client classes have one method per endpoint and return the raw response for the test to judge.',
])}
`,
};
