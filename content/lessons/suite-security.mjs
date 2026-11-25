import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { doorsAndProofs } from '../diagrams/suite.mjs';

export default {
  minutes: 13,
  lede: 'Every earlier lesson tested what CardVault does for the right caller. Security tests ask the opposite question: does every door refuse the wrong caller, and does nothing leak that should not? This lesson shows how the suite turns “who may call what” into a table it checks for every route, and how it notices a new route nobody has decided about.',
  youWill: 'You will learn how one table of endpoints drives dozens of access tests, why each door is tried with the wrong kind of proof as well as none, how the suite compares its table with each service’s published API, and what it checks must never be exposed.',
  body: `
<h2>Three doors, three keys</h2>
<p>The first track’s <a href="/learn/machines-calling-machines/">Machines that call machines</a> lesson described CardVault’s three kinds of caller. Each kind of endpoint accepts exactly one kind of proof, which <a href="/learn/suite-clients/">Clients and credentials</a> turned into three <code>httpx.Auth</code> classes:</p>
${figure({ svg: doorsAndProofs(), caption: 'Only the matching pair opens. The tests cover the empty proof and the wrong kind of proof for every route.' })}
<p>The grid makes the testing problem plain. It is not enough that a customer endpoint refuses a request with no token; it must also refuse a valid service key, because a service key proves something real, just not the right thing. Mixing up two kinds of proof is a classic access-control bug.</p>

<h2>A table of every route</h2>
${code({ title: 'tests/api/tests/security/test_who_may_call_what.py (part, most rows left out)', src: `
ANY = str(uuid.uuid4())  # an ID nobody owns: authentication is checked before the lookup

# service, method, path, who may call it
ENDPOINTS = [
    ("auth", "GET", "/v1/auth/me", "customer"),
    ("card", "GET", "/v1/cards", "customer"),
    ("card", "POST", f"/v1/cards/{ANY}/report-lost", "customer"),
    ("card", "POST", "/internal/v1/authorizations", "service"),
    ("enrollment", "POST", "/internal/v1/reconciliation/runs", "service"),
]
` })}
<p>The full table has 22 customer routes and 5 internal ones. Paths that contain an ID use <code>ANY</code>, a random UUID nobody owns. That works because the caller is checked before the service looks anything up: a request with no proof must get <code>401</code>, not <code>404</code>, whether or not the ID exists. (An <code>f"…{ANY}…"</code> string is an <strong>f-string</strong>, which puts the value of <code>ANY</code> into the text.)</p>
<p>The tests are short, because the table carries the knowledge:</p>
${code({ title: 'tests/api/tests/security/test_who_may_call_what.py (part)', src: `
@pytest.mark.parametrize("endpoint", CUSTOMER, ids=label)
def test_a_customer_endpoint_refuses_a_service_key(services, settings, endpoint):
    service, method, path, _ = endpoint
    key = ServiceKeyAuth(settings.service_key_tests)

    expect_error(call(services, service, method, path, auth=key), 401, "UNAUTHORIZED")


@pytest.mark.parametrize("endpoint", SERVICE, ids=label)
def test_an_internal_endpoint_refuses_a_customer_token(services, alice, endpoint):
    service, method, path, _ = endpoint

    resp = call(services, service, method, path, auth=BearerAuth(alice.tokens.access_token))

    expect_error(resp, 401, "SERVICE_KEY_INVALID")
` })}
<p><code>ids=label</code> passes a function instead of a list: pytest calls it for each row to make the test’s name, such as <code>POST /v1/cards/{id}/report-lost</code>. Five such tests over the table give 59 checks, from three lines of logic each. The expected error codes come from CardVault’s published error list: customer doors say <code>UNAUTHORIZED</code>, internal doors say <code>SERVICE_KEY_INVALID</code>.</p>

<h2>Catching the route nobody decided about</h2>
<p>A table of routes has a weakness: a route added next month will not be in it, so nothing will test it. The suite closes that gap with one more test. Every service publishes an OpenAPI document listing its routes; the test fetches it and compares:</p>
${code({ title: 'tests/api/tests/security/test_who_may_call_what.py (part)', src: `
    assert published - known == set(), "routes with no row in ENDPOINTS"
` })}
<p><code>published</code> is the set of routes the service says it has (leaving out its <code>/test/</code> controls and health checks), <code>known</code> is the set the suite has a decision for: every row of the table, plus a short list of routes with their own protection, such as login and the signed operator callback, tested in their own files. Subtracting one set from the other leaves the undecided routes. When that is not empty, the suite fails until someone adds a row and so decides how the new route is protected.</p>
${keyIdea(`<p>Write access rules as a table of every route and who may call it, test each route with no proof and with the wrong kind of proof, and compare the table with the service’s own list of routes so a new one cannot slip past untested.</p>`)}

<h2>What must never come out</h2>
<p>A second file tests exposure: things no response should ever contain.</p>
<ul>
<li><strong>No CORS permission.</strong> Browsers reach CardVault only through the web app’s server, so no service should tell a browser on another site that it may call it. The test sends the browser’s pre-flight question and expects no <code>Access-Control-</code> headers at all.</li>
<li><strong>No card numbers.</strong> The suite’s <code>pan_like</code> finds runs of 13 to 19 digits standing on their own and keeps those that pass the <strong>Luhn check</strong>, the checksum every real card number satisfies. Requiring a valid checksum avoids false alarms on long IDs. Every list a customer can read, including the CSV export, is scanned.</li>
<li><strong>No stack traces.</strong> An unknown route is a plain <code>404 NOT_FOUND</code>, and a broken JSON body is <code>422 VALIDATION_ERROR</code> in CardVault’s normal error shape, never a crash that shows the code’s insides.</li>
</ul>
${testerEye(`<p>For each door, a security test asks three questions: no proof, the wrong kind of proof, and a proof that is right in kind but wrong in value (a guessed service key, a token for another customer). Each catches a different mistake.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Access control', 'The rules about which caller may use which endpoint.'],
  ['OpenAPI document', 'A machine-readable list of a service’s routes, which each CardVault service publishes.'],
  ['CORS', 'The browser rule that lets a server say which other websites may call it from a page.'],
  ['Luhn check', 'The checksum every real card number passes; used to tell card numbers from other long numbers.'],
  ['f-string', 'A Python string starting with `f` in which `{name}` is replaced by the value of `name`.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'An internal endpoint refuses requests with no service key, but accepts alice’s customer token. Which test catches it?',
  options: ['The no-proof test', 'The test that sends a customer token to every internal endpoint and expects SERVICE_KEY_INVALID', 'The OpenAPI comparison', 'None'],
  answer: 1,
  why: '<p>The no-proof test passes, because the endpoint does refuse empty requests. Only trying the wrong kind of proof shows that the door checks for “some proof” instead of “a service key”.</p>',
})}
${check({
  q: 'A developer adds `GET /v1/cards/{card_id}/pin` and forgets authentication. No security test was written for it. What happens in the next run?',
  options: ['Nothing; it is not in the table', 'The OpenAPI comparison fails, listing the new route as undecided', 'Every security test fails', 'The route is skipped'],
  answer: 1,
  why: '<p>The service publishes the new route in its OpenAPI document. It is not in the table or the own-protection list, so the set difference is not empty and the test fails until someone decides how it is protected.</p>',
})}
${check({
  q: 'Why does `pan_like` require a valid Luhn checksum, not just 16 digits in a row?',
  options: ['To run faster', 'Long numeric IDs and other numbers would cause false alarms; real card numbers always pass the checksum', 'Card numbers always have 16 digits', 'Luhn is required by Kafka'],
  answer: 1,
  why: '<p>A check that cries wolf gets ignored. Requiring the checksum keeps it sensitive to real card numbers while staying quiet for ordinary long numbers.</p>',
})}

<h2>Recap</h2>
${recap([
  'Three kinds of door, three kinds of proof; only the matching pair may open.',
  'One table of every route drives tests with no proof and with the wrong proof.',
  'Comparing the table with each OpenAPI document catches routes nobody decided about.',
  'Exposure tests: no CORS, no card numbers (Luhn-checked), no stack traces.',
])}
`,
};
