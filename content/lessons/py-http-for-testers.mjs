import { code, interview, table, keyIdea, tryIt } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'An API test talks to a service the same way the web app does: over HTTP. Before writing one, it helps to see exactly what travels in each direction. This lesson takes one real CardVault call apart.',
  youWill: 'You will be able to read any request and response in the suite: method, URL, headers, body and status code.',
  body: `
<h2>Request and response</h2>
<p><strong>HTTP</strong> is the language web browsers and servers speak. Every exchange is a pair: the client sends a <strong>request</strong>, and the server sends back a <strong>response</strong>. An <strong>API</strong> (application programming interface) is a set of addresses on a server that programs, rather than people, are meant to call. Each CardVault service has one.</p>

<h2>A real request: logging in</h2>
<p>This is what the web app sends to the Login service when alice signs in.</p>
${code({ lang: 'http', title: 'Request', src: `
POST /v1/auth/login HTTP/1.1
Host: localhost:8001
Content-Type: application/json

{"username": "alice", "password": "CardVault-Demo-1"}
` })}
<ul>
<li><strong>Method</strong> (<code>POST</code>): what kind of action. <code>GET</code> reads, <code>POST</code> creates or performs an action, <code>PATCH</code> changes part of something, <code>DELETE</code> removes.</li>
<li><strong>URL</strong> (<code>localhost:8001/v1/auth/login</code>): which service (<code>localhost:8001</code>) and which address on it (the <strong>path</strong>). Values can also go in the URL, such as a card ID in <code>/v1/cards/{card_id}</code>, or after a <code>?</code> as <strong>query parameters</strong>, such as <code>?status=SETTLED</code>.</li>
<li><strong>Headers</strong>: extra facts about the request. <code>Content-Type</code> says the body is JSON.</li>
<li><strong>Body</strong>: the data, here written as <strong>JSON</strong>, a text format that looks just like a Python dictionary.</li>
</ul>

<h2>The response</h2>
${code({ lang: 'http', title: 'Response', src: `
HTTP/1.1 200 OK
Content-Type: application/json

{"access_token": "eyJhbGciOi...", "token_type": "Bearer", "expires_in": 900,
 "refresh_token": "...", "refresh_expires_in": 604800, "customer_id": "a11ce000-..."}
` })}
<p>The first line holds the <strong>status code</strong>, <code>200</code>, a three-digit number that says how it went. The body is JSON again. In Python, <code>response.json()</code> turns it into a dictionary, so <code>response.json()["token_type"]</code> is <code>"Bearer"</code>.</p>

<h2>Proving who you are</h2>
<p>Most CardVault calls need the access token from that response. It goes in a header on every later request:</p>
${code({ lang: 'http', title: 'Request', src: `
GET /v1/cards HTTP/1.1
Host: localhost:8002
Authorization: Bearer eyJhbGciOi...
` })}
<p>Without that header, the Cards service answers <code>401</code>. You met this token in <a href="/learn/flow-login/">Flow: logging in</a>.</p>

<h2>Status codes you will meet</h2>
<p>The first digit tells you the family: 2 means success, 4 means the client did something wrong, 5 means the server failed.</p>
${table(['Code', 'Name', 'In CardVault'], [
  ['200', 'OK', 'It worked; here is the result'],
  ['201', 'Created', 'A new thing was made, such as a dispute'],
  ['202', 'Accepted', 'Accepted, finishing later: adding a card to the wallet'],
  ['401', 'Unauthorized', 'No token, or a bad one'],
  ['404', 'Not Found', 'No such thing, or it belongs to someone else'],
  ['409', 'Conflict', 'Not allowed in its current state: reporting a closed card lost'],
  ['422', 'Unprocessable', 'The data is invalid, or a business rule says no'],
  ['423', 'Locked', 'Too many wrong passwords'],
  ['500', 'Server Error', 'Something broke inside the service: always a bug'],
])}

<h2>Errors have a body too</h2>
<p>When CardVault refuses a request, the body explains why, always in the same shape. Tests check the <code>error_code</code>, because the message is for people and may be reworded.</p>
${code({ lang: 'json', title: 'Response body for a wrong password (401)', src: `
{"error_code": "INVALID_CREDENTIALS",
 "message": "Username or password is incorrect",
 "correlation_id": "2111035b-6bb4-4b50-9bcc-c00bf1cc3673"}
` })}
<p>The <code>correlation_id</code> is an ID for this one request. Developers can search the service logs for it, so it is worth putting in a bug report.</p>

${keyIdea('<p>An API test checks three things in the response: the status code, the important values in the body, and, for errors, the <code>error_code</code>.</p>')}

<h2>Try it on the live app</h2>
<p>The panel below sends these requests to CardVault running on the server. Send them in order. The first one logs alice in, and the page keeps her access token as <code>{{token}}</code> and puts it into the requests that need it. Then change things and predict the answer before you press Send: delete the <code>Authorization</code> line, change one letter of the token, or ask for <code>/v1/cards/not-a-card</code>.</p>
${tryIt({ requests: [
  { label: 'Log in as alice', note: 'Expect `200` and a body with `access_token` and `refresh_token`.', method: 'POST', service: 'auth', path: '/v1/auth/login', body: { username: 'alice', password: 'CardVault-Demo-1' } },
  { label: 'List her cards, with the token', note: 'Expect `200` and her four cards in `items`.', method: 'GET', service: 'cards', path: '/v1/cards', headers: { Authorization: 'Bearer {{token}}' } },
  { label: 'The same request with no token', note: 'Expect `401` with `error_code` `UNAUTHORIZED`.', method: 'GET', service: 'cards', path: '/v1/cards' },
  { label: 'A wrong password', note: 'Expect `401` with `INVALID_CREDENTIALS`. Five in a row lock bob’s account (`423`); resetting the app unlocks him.', method: 'POST', service: 'auth', path: '/v1/auth/login', body: { username: 'bob', password: 'not-the-password' } },
] })}

${interview({
  say: `<p>“Each service exposes a REST API with JSON bodies. Customer calls carry a Bearer token in the Authorization header. In tests I check the status code first, then the fields in the JSON body, and for errors the stable error_code rather than the message text. Every response carries a correlation ID, which I include in bug reports so developers can find the request in the logs.”</p>`,
  qa: [
    ['What is the difference between PUT and PATCH?', '<p>PUT replaces the whole resource with what you send. PATCH changes only the fields you send. CardVault’s profile uses PATCH, so you can change just the email.</p>'],
    ['When would you expect 422 rather than 400?', '<p>Both mean the client sent something wrong. Many APIs use 400 for a request that cannot be read at all, and 422 for a readable request whose data breaks a rule. CardVault uses 422 for validation errors and for rules such as an ineligible card.</p>'],
    ['Why check error_code instead of the message?', '<p>The message is text for people and may be reworded or translated. The error code is a stable contract that programs rely on, so a test that checks it does not break when the wording changes.</p>'],
  ],
})}
`,
};
