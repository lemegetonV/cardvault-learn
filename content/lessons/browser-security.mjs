import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table } from '../../src/components.mjs';
import { csrfDouble, termsFrame } from '../diagrams/web.mjs';

export default {
  minutes: 12,
  lede: 'A browser runs code from many websites side by side, and it attaches cookies automatically. Both facts are convenient and both are dangerous. This lesson walks through the four classic browser attacks a banking web app must resist, and the specific defence CardVault uses against each.',
  youWill: 'You will learn how CardVault defends against script injection, forged requests, framing, and messages from the wrong window.',
  body: `
<h2>Four attacks, four defences</h2>
${table(['Attack', 'What the attacker wants', 'CardVault’s main defence'], [
  ['Cross-site scripting (XSS)', 'Run their script inside CardVault’s page', 'Text is always shown as text; a strict Content Security Policy'],
  ['Cross-site request forgery (CSRF)', 'Make the customer’s browser send a request they did not intend', 'SameSite cookies and a double-submit token'],
  ['Clickjacking', 'Show CardVault inside their page and trick clicks', 'CardVault refuses to be framed'],
  ['Spoofed messages', 'Fake a message from the operator’s terms frame', 'Check the sender’s origin'],
])}
<p>Each defence covers one attack. None of them alone makes the app safe; together they cover the common ground.</p>

<h2>Script injection (XSS)</h2>
<p>One of alice’s seed transactions has the merchant name <code>&lt;img src=x onerror=alert('cv-xss')&gt;&lt;script&gt;…&lt;/script&gt; Bistro</code>. If the transactions page inserted that name into the page as HTML, the browser would run it. That is <strong>cross-site scripting</strong>.</p>
<p>CardVault’s pages are written in React, which treats text as text: it escapes <code>&lt;</code> and <code>&gt;</code> so the browser displays them instead of reading them as tags. The merchant name appears on screen exactly as stored, angle brackets and all, and nothing runs.</p>
<p>As a second layer, every response carries a <strong>Content Security Policy</strong> (CSP), a header that tells the browser what the page may load. CardVault’s says, among other things, that scripts and data may only come from CardVault itself (<code>script-src 'self'</code>, <code>connect-src 'self'</code>), so an injected script could not load more code from elsewhere or send data to another site with <code>fetch</code>. The policy does allow inline scripts, which Next.js needs for its own start-up code, so it is a second layer behind React’s escaping, not a replacement for it.</p>
${keyIdea(`<p>Data from outside, such as a merchant name, is never code. Display it as text everywhere, and treat each place it appears (a page, a CSV export, a log) as a separate place to check.</p>`)}

<h2>Forged requests (CSRF)</h2>
<p>Suppose alice is signed in to CardVault and, in another tab, visits a malicious site. That site could try to submit a form to <code>localhost:3000/api/wallet/opt-out</code>. The browser might attach alice’s cookies automatically, and the request would arrive looking exactly like hers.</p>
<p>CardVault has two defences. First, its cookies are <strong>SameSite=Lax</strong>, which tells the browser not to attach them to requests that another site starts in the background, such as a form posted by script. Second, every state-changing call must pass a <strong>double-submit</strong> check:</p>
${figure({ svg: csrfDouble() })}
<p>The BFF compares the <code>cv_csrf</code> cookie with the <code>x-csrf-token</code> header and refuses any POST, PATCH, PUT or DELETE where they are missing or differ, with <code>403 CSRF_FAILED</code>. Only a script running on CardVault’s own page can read the cookie and copy it into the header; another site cannot read CardVault’s cookies at all. This is why <code>cv_csrf</code> is the one cookie scripts are allowed to read. GET requests are not checked, because they never change anything.</p>

<h2>Framing (clickjacking)</h2>
<p>A malicious page could load CardVault in an invisible frame and place its own buttons on top, so that alice thinks she is clicking “Play” but is really clicking “Opt out”. CardVault refuses to be displayed in a frame at all, with two headers that say the same thing for older and newer browsers: <code>X-Frame-Options: DENY</code> and the CSP rule <code>frame-ancestors 'none'</code>.</p>

<h2>Messages between windows</h2>
<p>CardVault itself does show one frame: the wallet operator’s terms, when a customer adds a card or opts in. The operator’s page cannot touch CardVault’s page directly, because they come from different origins, so it uses <code>postMessage</code>, the browser’s way for windows to send each other messages.</p>
${figure({ svg: termsFrame() })}
<p>Any window can send a message, so the receiver must check who sent it. CardVault accepts a <code>terms-accepted</code> message only if its origin is the operator’s, and only then enables the confirm button. The CSP allows frames only from the operator (<code>frame-src</code>), and the operator’s page in turn allows itself to be framed only by CardVault, and addresses its message only to CardVault’s origin.</p>
${testerEye(`<p>Open the transactions page and check the HTML merchant shows as text, with no alert. Send a state-changing BFF call without the <code>x-csrf-token</code> header, and with a wrong one, and expect <code>403 CSRF_FAILED</code> each time; then check that nothing changed. Read the response headers and assert <code>Content-Security-Policy</code>, <code>X-Frame-Options</code> and the cookie flags. In a browser test, post a fake <code>terms-accepted</code> message from the page itself (a different origin from the operator) and assert the confirm button stays disabled.</p>`)}
${realWorld(`<p>Real bank web apps add more: a nonce-based CSP with no inline scripts, Secure cookies on HTTPS only (CardVault turns this on outside localhost), strict transport headers, and regular penetration tests. The four attacks here are the core that every one of them must handle.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Cross-site scripting (XSS)', 'Getting a browser to run an attacker’s script as part of a trusted page.'],
  ['Content Security Policy (CSP)', 'A response header listing what a page may load and run.'],
  ['Cross-site request forgery (CSRF)', 'Tricking a signed-in browser into sending a request its user did not intend.'],
  ['SameSite', 'A cookie setting that stops the browser attaching it to requests started by other sites.'],
  ['Double-submit token', 'A value sent both as a cookie and as a header; only the real page can make them match.'],
  ['Clickjacking', 'Hiding a real page in a frame under fake controls to steal clicks.'],
  ['Origin', 'Scheme, host and port together, such as `http://localhost:8101`.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test sends `POST /api/wallet/opt-out` to the BFF with valid session cookies but no `x-csrf-token` header. What happens?',
  options: ['The customer is opted out', '`403 CSRF_FAILED`, and nothing changes', '`401`', '`400`'],
  answer: 1,
  why: '<p>Every state-changing BFF call needs the header to match the <code>cv_csrf</code> cookie. Without it, the call stops at the BFF and never reaches the service.</p>',
})}
${check({
  q: 'Why is `cv_csrf` readable by page scripts when the token cookies are not?',
  options: ['It is a mistake', 'The double-submit check needs the page’s own script to copy it into a header; another site still cannot read it', 'So the server can read it', 'Because it expires quickly'],
  answer: 1,
  why: '<p>Readable by scripts means readable by CardVault’s own scripts. Browsers never let one site read another site’s cookies, so an attacker’s page still cannot copy it.</p>',
})}
${check({
  q: 'A `terms-accepted` message arrives from `http://evil.example`. What does the consent dialog do?',
  options: ['Enables the confirm button', 'Ignores it, because the origin is not the operator’s', 'Shows an error', 'Closes the dialog'],
  answer: 1,
  why: '<p>The page checks the message’s origin before using it. Only the operator’s origin is trusted.</p>',
})}

<h2>Recap</h2>
${recap([
  'XSS: React shows data as text, and the CSP limits what any script could do.',
  'CSRF: SameSite=Lax cookies, plus a double-submit token on every state-changing call.',
  "Clickjacking: `X-Frame-Options: DENY` and `frame-ancestors 'none'`.",
  'postMessage: accept messages only from the expected origin.',
])}
`,
};
