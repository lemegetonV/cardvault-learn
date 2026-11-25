import { sequence, interview, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 8,
  lede: 'Every other feature depends on knowing who the customer is. This lesson follows one sign-in from the form to the first screen of cards, and shows how each service knows who is asking.',
  youWill: 'You will be able to explain how sign-in and tokens work in CardVault, step by step.',
  body: `
<h2>The problem sign-in solves</h2>
<p>The Cards service must only ever show alice her own cards. But services do not see the browser or the sign-in form. Each request just arrives at the service. So every request needs to carry proof of who sent it, and every service needs a quick way to check that proof.</p>
<p>That proof is a <strong>token</strong>: a short piece of text the Login service hands out after a correct password. Think of it as a wristband at an event. You show your ticket once at the gate, get a wristband, and from then on every stall just looks at the wristband.</p>

<h2>One sign-in, step by step</h2>
${sequence({
  id: 'login-flow',
  label: 'Sign-in from the browser to the first screen of cards',
  actors: [
    { id: 'b', label: 'Browser', kind: 'plain' },
    { id: 'w', label: 'Web app (BFF)', kind: 'bank' },
    { id: 'a', label: 'Login', kind: 'bank' },
    { id: 'c', label: 'Cards', kind: 'bank' },
  ],
  steps: [
    { from: 'b', to: 'w', label: 'username, password', note: 'alice fills in the sign-in form. The browser sends it to the web app’s server part, the BFF, never straight to a service.' },
    { from: 'w', to: 'a', label: 'POST /v1/auth/login', note: 'The BFF passes the username and password on to the Login service.' },
    { from: 'a', to: 'a', label: 'check password', kind: 'self', note: 'Login checks the password. A wrong one counts as a failure, and five failures in a row lock the account for 15 minutes.' },
    { from: 'a', to: 'w', label: 'access + refresh token', kind: 'reply', note: 'A correct password gets two tokens back: an **access token**, valid for 15 minutes, and a **refresh token**, used to get a new access token later.' },
    { from: 'w', to: 'b', label: 'cookie set', kind: 'reply', note: 'The BFF keeps both tokens in cookies that the page’s JavaScript cannot read, which protects them from malicious scripts. The browser never sees the tokens themselves.' },
    { from: 'b', to: 'w', label: 'show my cards', note: 'alice opens the Cards screen. The browser asks the BFF, and the cookie travels with the request automatically.' },
    { from: 'w', to: 'c', label: 'GET /v1/cards + token', note: 'The BFF takes the access token from the cookie and adds it to the request as an `Authorization: Bearer ...` header.' },
    { from: 'c', to: 'c', label: 'check the token', kind: 'self', note: 'Cards checks the token’s signature and expiry itself, using Login’s public key. It does not need to call Login for every request.' },
    { from: 'c', to: 'w', label: 'alice’s cards', kind: 'reply', note: 'The token says which customer this is, so Cards returns only alice’s cards. The BFF passes them back to the screen.' },
  ],
  caption: 'Press Start and step through. Green boxes are CardVault Bank; the browser is the customer.',
})}

<h2>What is inside a token</h2>
<p>CardVault’s access token is a <strong>JWT</strong> (JSON Web Token, said “jot”). It holds a few facts, such as the customer’s ID and when the token expires, and a digital signature made with a private key that only the Login service has. Anyone can read the facts, but nobody can change them without breaking the signature. That is why every service can trust a token after checking the signature with Login’s public key.</p>

${keyIdea('<p>Sign in once, then show the token on every request. Each service checks the token itself, so the Login service is not asked again for every screen.</p>')}

<h2>When the 15 minutes run out</h2>
<p>An access token only lives for 15 minutes, which limits the damage if one is stolen. The web app keeps track of the time. At 14 minutes it shows a warning with a <strong>Stay signed in</strong> button, which uses the refresh token to get a fresh access token. If the customer does nothing, the app signs them out at 15 minutes.</p>

${testerEye(`<p>Sign-in gives you plenty of test ideas:</p>
<ul>
<li>A correct password returns a token. A wrong one returns an error, and the error must look the same for an unknown username, so attackers cannot discover which usernames exist.</li>
<li>Five wrong passwords lock the account, and then even the correct password is refused.</li>
<li>A request with no token, or a made-up token, is refused with <code>401 Unauthorized</code>.</li>
<li>One customer’s token never shows another customer’s data.</li>
</ul>
<p>You will write each of these as a pytest test in the API track.</p>`)}

${interview({
  say: `<p>“Customers sign in through the web app, which forwards the credentials to the auth service. It returns a short-lived JWT access token and a refresh token. The web app’s backend-for-frontend keeps them in HttpOnly cookies and adds the access token as a Bearer header on every call to a backend service.</p>
<p>Each service validates the token’s signature locally with the auth service’s public key, so there is no extra call per request. Access tokens last 15 minutes; the UI warns at 14 and can refresh. Five failed logins lock the account for 15 minutes.”</p>`,
  qa: [
    ['What is the difference between 401 and 403?', '<p><strong>401 Unauthorized</strong> means “I don’t know who you are”: no token, or a bad one. <strong>403 Forbidden</strong> means “I know who you are, but you may not do this”. For another customer’s card, CardVault returns <strong>404 Not Found</strong>, so it does not even reveal that the card exists.</p>'],
    ['Why keep the token in an HttpOnly cookie instead of in the page?', '<p>JavaScript on the page cannot read an HttpOnly cookie. If an attacker ever managed to run a script in the page, they still could not steal the token.</p>'],
    ['How would you test that tokens expire?', '<p>At API level: get a token, wait until it has expired (or use an environment where tokens are short-lived), call a service with it, and expect 401. At UI level: check that the warning appears before expiry and that the customer is signed out after it.</p>'],
  ],
})}
`,
};
