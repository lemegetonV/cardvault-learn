import { code, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'Three techniques come up in almost every API testing interview, even though this suite uses none of them directly: mocking a dependency, checking the database, and contract testing. This lesson explains what each is for, when a team uses it, and how it relates to CardVault.',
  youWill: 'You will be able to explain mocks, database checks and contract tests, and when you would choose each.',
  body: `
<h2>Three tools, three questions</h2>
${table(['Technique', 'Question it answers', 'Typical use'], [
  ['Mock or stub', 'How does my code behave when a dependency says X?', 'A partner is slow, costly, or cannot be made to fail on demand'],
  ['Database check', 'Did the right data really get stored?', 'Something the API does not show, such as an audit record'],
  ['Contract test', 'Do two services still agree on the shape of their messages?', 'Many teams, each changing their own service'],
])}

<h2>Mocks and stubs</h2>
<p>A <strong>stub</strong> is a stand-in that returns canned answers. A <strong>mock</strong> is a stand-in that also records how it was called, so a test can check it was called correctly. People often use “mock” for both.</p>
<p>CardVault already relies on the idea at the level of whole systems. In its test environment the card network and the wallet company are <strong>simulators</strong>: small services that behave like the real partners. That is how a test can make a purchase whenever it wants: the card network simulator plays the shop.</p>
<p>Inside Python code, mocks replace a function or an HTTP call. For code that uses requests, the <code>responses</code> library intercepts calls and returns what you set:</p>
${code({ title: 'Example · faking a partner with the responses library', src: `
import responses
import requests


@responses.activate
def test_shows_a_friendly_message_when_the_rates_service_is_down():
    responses.get("https://rates.example.com/usd", status=503)

    result = get_exchange_rate("usd")     # our code, which calls the URL above

    assert result == "Rates are unavailable right now"
` })}
<p>The cost: a mock only behaves the way you told it to. If the real partner changes, tests against the mock keep passing. That gap is what contract tests close.</p>

<h2>Database checks</h2>
<p>Each CardVault service owns its own database, and the suite checks everything through the API, the same way a customer or another service sees it. That is deliberate: the API is the contract, and tests that read tables break whenever a developer renames a column.</p>
<p>A database check is worth it when the API cannot show the fact you need: an audit record, a value that must be stored encrypted, or proof that a refused request wrote nothing. In Python, a library such as psycopg runs a SQL query and the test asserts on the rows. Use a read-only database user, so a test can never change data by mistake.</p>

<h2>Contract tests</h2>
<p>A <strong>contract</strong> is the agreement between a service and its callers: the endpoints, fields, types and status codes. Every CardVault service publishes its contract as an <strong>OpenAPI</strong> document, a standard machine-readable description of an API, at <code>/openapi.json</code>, with a readable version at <code>/docs</code>.</p>
<p>There are two common styles of contract testing:</p>
<ul>
<li><strong>Provider checks against the published contract.</strong> Validate real responses against the OpenAPI document. The <a href="/learn/py-response-shape/">schema checks</a> you saw are a hand-written version of this.</li>
<li><strong>Consumer-driven contracts</strong>, usually with a tool called <strong>Pact</strong>. Each calling team records the requests it makes and the answers it relies on. The providing team runs those recordings against its service before every release, so it learns at once if a change would break a caller.</li>
</ul>

${keyIdea('<p>Mock a dependency to control it; check the database only for facts the API cannot show; use contract tests so services and their callers find out about breaking changes before release.</p>')}

${testerEye('<p>The three fit together: mocks make tests fast and controllable, contract tests keep the mocks honest, and a few end-to-end tests, like the flow tests, prove the real pieces work together.</p>')}

${interview({
  say: `<p>“In CardVault’s test environment the external partners, the card network and the wallet company, are simulators, which lets tests trigger purchases and partner answers. In unit-level Python tests I would mock HTTP with a library like responses. I check through the API by default and query the database only for facts the API cannot show. For contracts, each service publishes OpenAPI, so responses can be validated against it, and with many teams I would add consumer-driven contracts with Pact.”</p>`,
  qa: [
    ['What is the difference between a mock and a stub?', '<p>A stub returns canned answers. A mock also records how it was called so the test can verify the interaction. In practice people use “mock” for both.</p>'],
    ['Should API tests check the database?', '<p>Mostly no: the API is the contract, and table checks are brittle. Yes for facts the API cannot show, such as audit records or that nothing was written, using a read-only user.</p>'],
    ['What is consumer-driven contract testing?', '<p>Callers publish the interactions they depend on, and the provider verifies them in its own pipeline, usually with Pact, so a breaking change is caught before release instead of in a shared environment.</p>'],
  ],
})}
`,
};
