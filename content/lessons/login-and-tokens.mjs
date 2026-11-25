import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code, sequence } from '../../src/components.mjs';
import { tokenParts, refreshFamily, lockout } from '../diagrams/trust.mjs';

const session = sequence({
  id: 'seq-login',
  label: 'A customer logs in, uses the access token for 15 minutes, refreshes it, and later logs out.',
  actors: [
    { id: 'client', label: 'Client', kind: 'plain' },
    { id: 'auth', label: 'auth', kind: 'bank' },
    { id: 'card', label: 'card', kind: 'bank' },
  ],
  steps: [
    { from: 'client', to: 'auth', label: 'POST /v1/auth/login', note: 'The client sends alice’s username and password. Usernames are matched without regard to case or surrounding spaces, so `Alice ` and `alice` are the same person.' },
    { from: 'auth', to: 'auth', kind: 'self', label: 'check the password hash', note: 'auth never stores the password itself, only a salted hash of it. It hashes what was sent the same way and compares.' },
    { from: 'auth', to: 'client', kind: 'reply', label: '200 access + refresh token', note: 'A 15-minute access token and a 7-day refresh token come back. This login starts a new refresh-token family.' },
    { from: 'client', to: 'card', label: 'GET /v1/cards (Bearer)', note: 'For the next 15 minutes, the client sends the access token with every call. The card service checks it on its own, without asking auth.' },
    { from: 'card', to: 'client', kind: 'reply', label: '200 cards', note: 'The token says who the caller is, so the service returns only alice’s cards.' },
    { from: 'client', to: 'auth', label: 'POST /v1/auth/refresh', note: 'Before the access token runs out, the client swaps its refresh token for a new pair. No password is needed.' },
    { from: 'auth', to: 'client', kind: 'reply', label: '200 new access + new refresh', note: 'The old refresh token is now used up. Only the new one works for the next refresh.' },
    { from: 'client', to: 'auth', label: 'POST /v1/auth/logout', note: 'Logging out sends the refresh token. auth revokes it and every other token in its family. The answer is always `204`, even for a token it has never seen.' },
  ],
  caption: 'One session: log in, use, refresh, log out.',
});

export default {
  minutes: 12,
  lede: 'Every customer request has to answer one question first: who is asking? This lesson shows how a CardVault customer proves who they are once, with a password, and then carries that proof around as a token, and what stops someone from guessing passwords or reusing a stolen token.',
  youWill: 'You will follow a login session, read an access token, and see how refresh tokens, lockout and logout behave.',
  body: `
<h2>A password once, a token after that</h2>
<p>Sending a password with every request would be slow and risky, because the password would travel and be checked hundreds of times. Instead, the customer logs in once. The auth service checks the password and hands back a <strong>token</strong>: a short piece of text that says “this is alice” and that nobody can forge. Every later request carries the token instead of the password.</p>
${session}
<p>Two tokens come back from a login, and they do different jobs:</p>
${table(['', 'Access token', 'Refresh token'], [
  ['Looks like', 'A long `eyJ…` string (a JWT)', '`rt_` followed by random characters'],
  ['Lasts', '900 seconds (15 minutes)', '604,800 seconds (7 days)'],
  ['Sent to', 'Every service, in `Authorization: Bearer …`', 'Only `/v1/auth/refresh` and `/v1/auth/logout`'],
  ['Checked by', 'Each service, on its own', 'auth only, against its database'],
])}

<h2>What is inside an access token</h2>
<p>An access token is a <strong>JWT</strong>, short for JSON Web Token. It is three pieces of text joined by dots. The first two are plain JSON, only encoded, so anyone can read them. The third is a signature that proves the first two have not been changed.</p>
${figure({ svg: tokenParts(), caption: 'The values shown are examples. <code>sub</code> is alice’s customer ID; <code>iat</code> and <code>exp</code> are Unix seconds, here 09:00 and 09:15 UTC.' })}
${table(['Claim', 'Means', 'In CardVault'], [
  ['`sub`', 'Subject: who the token is about', 'The customer ID'],
  ['`iss`', 'Issuer: who made it', '`cardvault-auth`'],
  ['`aud`', 'Audience: who it is meant for', '`cardvault`'],
  ['`iat`, `exp`', 'Issued at, expires at', '`exp` is 900 seconds after `iat`'],
  ['`jti`', 'A unique ID for this one token', 'A random UUID'],
])}
<p>Each service checks the signature, the issuer, the audience and the expiry, all against <a href="/learn/the-shared-clock/">the shared clock</a>. If any check fails, the answer is <code>401</code> with <code>TOKEN_INVALID</code> or <code>TOKEN_EXPIRED</code>. How the signature works is in <a href="/learn/cryptography/">the cryptography lesson</a>.</p>
${keyIdea(`<p>The customer ID always comes from the token, never from the request. A request cannot say “I am bob” in its body or URL and be believed. That is why alice asking for bob’s card gets <code>404</code>: the service only looks among alice’s cards.</p>`)}

<h2>Refresh tokens rotate</h2>
<p>A refresh token can be used <strong>once</strong>. Each refresh returns a new pair and kills the old refresh token. All the refresh tokens that come from one login form a <strong>family</strong>.</p>
${figure({ svg: refreshFamily(), caption: 'Normal use only ever presents the newest token. An old one turning up means two parties hold the same session.' })}
<p>Why treat reuse as theft? If an attacker copied alice’s refresh token, then either alice or the attacker will be the second one to use it. auth cannot tell which is which, so it ends the whole session and forces a fresh login with the password.</p>
<p>The possible refresh failures each have their own code: <code>REFRESH_TOKEN_INVALID</code> (unknown or revoked), <code>REFRESH_TOKEN_REUSED</code> (already used) and <code>REFRESH_TOKEN_EXPIRED</code> (older than 7 days on the shared clock).</p>

<h2>Lockout</h2>
<p>Without a limit, someone could try thousands of passwords against alice’s username. CardVault counts failed logins per username.</p>
${figure({ svg: lockout() })}
<ul>
<li>An unknown username and a wrong password get the same answer, <code>401 INVALID_CREDENTIALS</code>, so the response never reveals which usernames exist. Unknown usernames are counted and locked too, for the same reason.</li>
<li>The lock lasts 15 minutes on the shared clock, so a test can end it by moving time instead of waiting.</li>
<li><code>/test/reset</code> on auth clears every lockout.</li>
</ul>
${code({ lang: 'json', title: 'Sixth attempt, any password', src: `{
  "error_code": "ACCOUNT_LOCKED",
  "message": "Too many failed logins. Try again later.",
  "correlation_id": "…",
  "details": { "locked_until": "2026-11-25T09:15:04.120000+00:00" }
}` })}
${testerEye(`<p>Lockout has a precise edge. Four failures then a success should reset the count; five failures should lock; the right password during the lock should still get <code>423</code>; and one second after <code>locked_until</code> on the shared clock, login should work again. Each of those is a separate test, and none of them needs to wait 15 real minutes.</p>`)}

<h2>Logging out, and what it cannot do</h2>
<p><code>POST /v1/auth/logout</code> revokes the refresh token and its whole family, so the session cannot be renewed. It always answers <code>204</code>, even for a made-up token, so it cannot be used to test whether a token is real.</p>
<p>The access token is a different matter. Services check it on their own and never ask auth, so they have no way to know about the logout. <strong>An access token keeps working until it expires</strong>, at most 15 minutes after logout. That is a deliberate trade-off: services stay fast and independent, at the cost of a short window after logout.</p>
${realWorld(`<p>Banks that cannot accept that window keep access tokens very short, or keep a shared list of revoked token IDs (the <code>jti</code> claim) that every service checks. Both cost something: more refreshes, or one more lookup on every request.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Access token', 'A signed, 15-minute JWT sent as `Authorization: Bearer …` on every customer call.'],
  ['JWT', 'JSON Web Token: header, claims and signature, joined by dots. Readable by anyone, forgeable by no one without the key.'],
  ['Claim', 'One fact inside a JWT, such as `sub` (who) or `exp` (until when).'],
  ['Refresh token', 'A 7-day, single-use token that gets a new token pair without the password.'],
  ['Token family', 'All refresh tokens descended from one login. Reusing any used one revokes them all.'],
  ['Lockout', 'After 5 failed logins, a username gets `423 ACCOUNT_LOCKED` for 15 minutes.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'alice logs out, then immediately calls `GET /v1/cards` with the access token she had before logging out. What happens?',
  options: ['`401 TOKEN_INVALID`, because logout revoked it', '`200` with her cards, because the access token is still within its 15 minutes', '`423 ACCOUNT_LOCKED`', '`404`'],
  answer: 1,
  why: '<p>Logout revokes refresh tokens only. The card service checks the access token’s signature and expiry by itself and never learns about the logout, so the token works until <code>exp</code>.</p>',
})}
${check({
  q: 'A test refreshes with `rt_A` and gets `rt_B`. It then refreshes with `rt_A` again by mistake. What does the second call return, and can `rt_B` still be used?',
  options: ['`200`; yes', '`401 REFRESH_TOKEN_REUSED`; no, the whole family is revoked', '`401 REFRESH_TOKEN_INVALID`; yes', '`409`; yes'],
  answer: 1,
  why: '<p><code>rt_A</code> was already used, so auth treats the second use as theft and revokes every token in the family, including <code>rt_B</code>.</p>',
})}
${check({
  q: 'A test tries to log in as `nobody` five times with any password. What does the sixth attempt return?',
  options: ['`401 INVALID_CREDENTIALS`, because `nobody` does not exist', '`423 ACCOUNT_LOCKED`', '`404 NOT_FOUND`', '`422 VALIDATION_ERROR`'],
  answer: 1,
  why: '<p>Unknown usernames are counted and locked exactly like real ones. If they were not, a locked answer would reveal which usernames exist.</p>',
})}

<h2>Recap</h2>
${recap([
  'A login returns a 15-minute access token (a JWT) and a 7-day refresh token.',
  'Every service checks the access token itself: signature, issuer, audience and expiry on the shared clock.',
  'The customer ID always comes from the token’s `sub` claim.',
  'Refresh tokens are single-use. Reusing one revokes the whole family.',
  'Five failed logins lock a username for 15 minutes. Logout revokes refresh tokens, not access tokens.',
])}
`,
};
