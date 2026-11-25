import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table } from '../../src/components.mjs';
import { bffMap } from '../diagrams/web.mjs';

export default {
  minutes: 9,
  lede: 'Everything so far has been APIs. Customers, though, use the web app: a set of pages in the browser, at localhost:3000. This lesson shows how those pages reach the services, and why there is a small server in between that holds the customer’s login on their behalf.',
  youWill: 'You will learn what the backend-for-frontend does, where the customer’s tokens live, and how a page’s request reaches the right service.',
  body: `
<h2>Two parts in one app</h2>
<p>The web app is built with <strong>Next.js</strong>, a framework for React. It has two parts that run in different places. The <strong>pages</strong> run in the customer’s browser: they draw the screens and react to clicks. A small <strong>server</strong> runs next to them, inside the same app, and answers requests to <code>/api/…</code>. That server is the <a href="/learn/the-system-map/">BFF</a>, the backend for frontend.</p>
<p>The pages never call a service directly. They call the BFF, and the BFF calls the service.</p>
${figure({ svg: bffMap() })}

<h2>Why put a server in between?</h2>
<p>The main reason is where the login is kept. After a customer signs in, someone has to hold their <a href="/learn/login-and-tokens/">access and refresh tokens</a>. If the page’s script held them, any script running on the page, including one injected by an attacker, could read them and send them anywhere.</p>
<p>So the BFF stores them in <strong>HttpOnly cookies</strong>. The browser sends these cookies back to the BFF with every request, but page scripts cannot read them at all. When the BFF forwards a call, it takes the access token from the cookie and adds it as <code>Authorization: Bearer …</code>.</p>
${table(['Cookie', 'Holds', 'Readable by page script?', 'Sent to'], [
  ['`cv_access`', 'The access token', 'No (HttpOnly)', 'Every path'],
  ['`cv_refresh`', 'The refresh token', 'No (HttpOnly)', 'Only `/api/auth/…`'],
  ['`cv_session_exp`', 'When the 15-minute session ends', 'No (HttpOnly)', 'Every path'],
  ['`cv_csrf`', 'A random anti-forgery value', 'Yes, on purpose', 'Every path'],
])}
<p>The refresh token is sent only to <code>/api/auth/…</code>, the one place that needs it, so it travels as rarely as possible. Why <code>cv_csrf</code> must be readable is the subject of <a href="/learn/browser-security/">Browser security</a>.</p>
${keyIdea(`<p>The browser holds the login but cannot see it. Only the BFF, a server under the bank’s control, ever handles the tokens themselves.</p>`)}

<h2>Signing in</h2>
<p>The login form posts to <code>/api/auth/login</code>. The BFF passes the username and password to the auth service. On success it puts the tokens into cookies and tells the page only the customer’s ID and how long the session lasts; the tokens are never in the response body. On failure it passes the auth service’s answer through unchanged, so a wrong password is still a <code>401</code> and a locked account is still a <code>423 ACCOUNT_LOCKED</code>.</p>
<p>Three more routes complete the set: <code>/api/auth/refresh</code> rotates the refresh token and restarts the session, <code>/api/auth/session</code> says how many seconds are left, and <code>/api/auth/logout</code> revokes the refresh token and clears the cookies, even if the auth service is down.</p>

<h2>Forwarding everything else</h2>
<p>Every other <code>/api/…</code> call goes through one route, a <strong>proxy</strong> that maps the first part of the path to a service:</p>
${table(['Page calls', 'BFF forwards to'], [
  ['`/api/cards/…`', 'card service, `/v1/cards/…`'],
  ['`/api/profile/…`', 'profile service, `/v1/profile/…`'],
  ['`/api/wallet/transactions/…`, `/api/wallet/disputes/…`', 'wallet-txn service'],
  ['`/api/wallet/…` (anything else)', 'enrollment service'],
])}
<p>The proxy passes on a few request headers (<code>Content-Type</code>, <code>If-Match</code>, <code>Idempotency-Key</code>) and returns the service’s status and body unchanged, with a few of its headers, such as <code>ETag</code> and <code>Idempotent-Replayed</code>. It adds a correlation ID if the page did not send one. Any path it does not know returns <code>404</code>, and an unreachable service returns <code>502 UPSTREAM_UNAVAILABLE</code>.</p>
<p>One more piece runs on the server for every page request, the <strong>middleware</strong>. It sends a visitor without a session to <code>/login</code>, remembering where they were going, sends a signed-in visitor away from <code>/login</code> to <code>/wallet</code>, sets the <code>cv_csrf</code> cookie if it is missing, and adds the security headers.</p>
${testerEye(`<p>Because the BFF passes answers through unchanged, most business rules are best tested at the service APIs, and UI tests can focus on what the browser adds: the pages, the cookies and the flows. A useful check sits in between: call the BFF the way the page does, with the cookie and CSRF header, and assert it gives the same status and body as calling the service with a Bearer token.</p>`)}
${realWorld(`<p>Banks often put an API gateway in front of everything as well, handling rate limits, routing and token checks. A BFF is narrower: one per front end, shaped for that front end’s needs. Mobile apps, which cannot use cookies in the same way, usually have their own.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Next.js', 'A React framework whose apps have browser pages and server code together.'],
  ['HttpOnly cookie', 'A cookie the browser sends with requests but page scripts cannot read.'],
  ['Proxy', 'Server code that forwards a request to another server and passes the answer back.'],
  ['Middleware', 'Code that runs on the server before every page or API request.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'An attacker manages to run a script on a CardVault page. Can that script read the customer’s access token?',
  options: ['Yes, from localStorage', 'No: the token is in an HttpOnly cookie, which scripts cannot read', 'Yes, from document.cookie', 'Only after login'],
  answer: 1,
  why: '<p>The access token lives only in the <code>cv_access</code> HttpOnly cookie. The script could still act within the page, which is why the other defences in the next lesson matter too.</p>',
})}
${check({
  q: 'The page calls `GET /api/wallet/transactions?status=SETTLED`. Which service answers?',
  options: ['enrollment, because the path starts with wallet', 'wallet-txn: `wallet/transactions` and `wallet/disputes` go there; other `wallet` paths go to enrollment', 'card', 'The BFF answers itself'],
  answer: 1,
  why: '<p>The proxy checks the second path segment for <code>wallet</code> paths. Transactions and disputes belong to wallet-txn.</p>',
})}
${check({
  q: 'The card service answers `409 INVALID_STATE_TRANSITION`. What does the page receive from the BFF?',
  options: ['500', 'The same 409 with the same body', '200 with an error flag', '502'],
  answer: 1,
  why: '<p>The proxy passes the status and body through unchanged, so the page can show the service’s own error.</p>',
})}

<h2>Recap</h2>
${recap([
  'The web app has browser pages and a server, the BFF, under `/api/…`.',
  'Tokens live in HttpOnly cookies; the BFF adds the Bearer header.',
  'The refresh token is sent only to `/api/auth/…`.',
  'One proxy route maps paths to services and passes answers through unchanged.',
  'Middleware guards pages, sets the CSRF cookie and adds security headers.',
])}
`,
};
