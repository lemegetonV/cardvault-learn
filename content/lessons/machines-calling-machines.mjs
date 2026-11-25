import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { trustMap, hmacFlow } from '../diagrams/trust.mjs';

export default {
  minutes: 11,
  lede: 'Customers prove who they are with a password and a token. But much of CardVault’s traffic has no customer behind it: the card network asking for an approval, or the wallet operator confirming that a card was added. This lesson shows the two ways machines prove who they are to each other, and why CardVault uses each one where it does.',
  youWill: 'You will learn which caller uses which proof, how service keys and HMAC signatures work, and what errors to expect when they are wrong.',
  body: `
<h2>Four kinds of proof</h2>
<p>Every arrow into a CardVault service carries some proof of who is calling. Which proof depends on who the caller is.</p>
${figure({ svg: trustMap(), caption: 'Green arrows are signed both ways; slate arrows carry a service key; the grey arrow is for tests only.' })}
${table(['Caller', 'Proof', 'Header', 'Rejected with'], [
  ['A customer, through the web app', 'Access token', '`Authorization: Bearer …`', '`401 UNAUTHORIZED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`'],
  ['The network mock, the operator mock, tests', 'Service key', '`X-Service-Key`', '`401 SERVICE_KEY_INVALID`'],
  ['Enrollment and the wallet operator, to each other', 'HMAC signature', '`X-Timestamp`, `X-Signature`', '`401 SIGNATURE_MISSING`, `SIGNATURE_INVALID`, `SIGNATURE_EXPIRED`'],
  ['Tests, on `/test/*`', 'Test key', '`X-Test-Key`', '`401 TEST_KEY_INVALID`'],
])}
<p>The browser never holds a token at all. The web app keeps it in an <code>HttpOnly</code> cookie that page scripts cannot read, and its server adds the <code>Bearer</code> header when it calls a service. <a href="/learn/web-and-bff/">Next.js and the BFF</a> covers that part.</p>

<h2>Service keys: a password for a program</h2>
<p>A service key is a long secret string that one calling program sends in the <code>X-Service-Key</code> header. Each caller has its <strong>own</strong> key: one for the network mock, one for the wallet operator mock, one for tests. The receiving service knows which keys it accepts on which endpoints, so the key also says <em>who</em> is calling.</p>
${table(['Endpoint', 'Accepts the key of'], [
  ['card: `POST /internal/v1/authorizations`, `POST /internal/v1/clearing`', 'network mock, tests'],
  ['network mock: `POST /v1/tokens`', 'wallet operator mock, tests'],
  ['enrollment: sweep and reconciliation', 'tests'],
])}
<p>The two kinds of caller are kept strictly apart. An internal endpoint rejects a customer’s token, and a customer endpoint rejects a service key, both with <code>401</code>. A customer who somehow learned an internal URL still cannot use it.</p>
${keyIdea(`<p>One key per caller means one key can be changed, or one caller shut out, without touching the others. It also means the logs can say which program made a call. A single shared key for everyone would lose both.</p>`)}

<h2>HMAC: signing the message itself</h2>
<p>A service key proves who sent a request, but it travels with every call and says nothing about the body. Between enrollment and the wallet operator, messages change real state: “add this card”, “this card is now active”. For those, CardVault <strong>signs each message</strong> with a secret both sides share, using HMAC-SHA256.</p>
${figure({ svg: hmacFlow(), caption: 'The secret itself is never sent. Only a signature that depends on it, on the time, and on every byte of the body.' })}
<p>Three properties fall out of that design:</p>
<ul>
<li><strong>Who sent it:</strong> only someone with the secret can produce a matching signature.</li>
<li><strong>Not changed:</strong> changing a single byte of the body changes the signature, so the receiver notices.</li>
<li><strong>Not replayed later:</strong> the timestamp is part of what is signed, and the receiver accepts it only within 5 minutes either side of its own time. Exactly 300 seconds is still accepted; 301 is not.</li>
</ul>
<p>The order of the checks is deliberate. The signature is checked <em>before</em> the timestamp, so a forger never learns whether their timestamp would have been accepted.</p>
${code({ lang: 'python', title: 'app/shared/hmac_auth.py', src: `def sign(secret: str | bytes, timestamp: int, body: bytes) -> str:
    key = secret.encode() if isinstance(secret, str) else secret
    message = f"{timestamp}.".encode() + body
    return hmac.new(key, message, hashlib.sha256).hexdigest()` })}
<p>The signature covers the <strong>raw bytes</strong> of the body, exactly as sent. If a test builds the body as JSON, signs it, and then lets its HTTP library re-serialise the JSON with different spacing, the bytes change and the signature no longer matches. Sign the exact bytes you send.</p>
${testerEye(`<p>The five-minute window is measured on <a href="/learn/the-shared-clock/">the shared clock</a>. To test a stale callback, a test can sign with the current time and then move the clock forward six minutes before sending, instead of hand-crafting an old timestamp. Test both edges: 300 seconds should pass and 301 should fail with <code>SIGNATURE_EXPIRED</code>.</p>`)}

<h2>Constant-time comparison</h2>
<p>Every key and signature in CardVault is compared with <code>hmac.compare_digest</code>, never with <code>==</code>. An ordinary comparison stops at the first different character, so it answers slightly faster for a wrong first character than for a wrong last one. With enough attempts, an attacker could measure that difference and guess a secret one character at a time. <code>compare_digest</code> always takes the same time.</p>

<h2>Where the secrets live</h2>
<p>On your computer, every key and the HMAC secret come from your <code>.env</code> file, which <code>make up</code> copies from <code>.env.example</code>. They are made-up local values. Stage has its own, different values. Tests read them from configuration, never from the code.</p>
${realWorld(`<p>Real card networks and wallet providers usually go further than a shared secret: mutual TLS, where both sides present certificates when the connection opens, plus signed messages on top. The ideas are the same ones you have seen here: prove the sender, protect the message, and refuse anything old.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Service key', 'A secret string one program sends in `X-Service-Key` to prove which program it is. One per caller.'],
  ['HMAC', 'A signature made from a message and a shared secret. Proves who sent it and that it was not changed.'],
  ['Shared secret', 'A value both sides know and never send. Here, the key for HMAC signatures.'],
  ['Replay', 'Sending a captured, valid message again later. The signed timestamp and 5-minute window stop it.'],
  ['Constant-time comparison', 'Comparing secrets in a way that takes the same time whatever the input, so timing leaks nothing.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test calls `POST /internal/v1/authorizations` on the card service using alice’s valid access token as `Authorization: Bearer …` and no service key. What comes back?',
  options: ['`200`, because the token is valid', '`401 SERVICE_KEY_INVALID`', '`403 FORBIDDEN`', '`404`'],
  answer: 1,
  why: '<p>Internal endpoints accept only service keys. A customer token, however valid, is not one, so the call is rejected with <code>401</code>.</p>',
})}
${check({
  q: 'A test signs a callback body, then its HTTP client re-serialises the JSON and adds a space after each colon before sending. What does enrollment answer?',
  options: ['`200`, because the JSON means the same thing', '`401 SIGNATURE_INVALID`', '`401 SIGNATURE_EXPIRED`', '`422 VALIDATION_ERROR`'],
  answer: 1,
  why: '<p>The signature covers the exact bytes. Extra spaces are different bytes, so the recomputed signature differs. The signature check runs before the timestamp check and before the body is parsed.</p>',
})}
${check({
  q: 'A callback is correctly signed with a timestamp exactly 300 seconds behind the shared clock. Is it accepted?',
  options: ['Yes, exactly 300 seconds is inside the window', 'No, it must be under 300 seconds', 'Only if the clock offset is zero', 'Only for enrolment callbacks'],
  answer: 0,
  why: '<p>The rule rejects a skew of <em>more than</em> 300 seconds, so 300 passes and 301 fails. Boundary values like this are exactly what a test should pin down.</p>',
})}

<h2>Recap</h2>
${recap([
  'Customers send a Bearer token; programs send a service key; enrollment and the operator sign messages with HMAC; tests use a test key.',
  'Each caller has its own service key, and internal and customer endpoints never accept each other’s proof.',
  'HMAC signs `timestamp.body` with a shared secret: it proves the sender, protects the body, and stops replays.',
  'Signatures cover raw bytes, and timestamps must be within 300 seconds on the shared clock.',
  'Secrets are compared in constant time and come from configuration, never from code.',
])}
`,
};
