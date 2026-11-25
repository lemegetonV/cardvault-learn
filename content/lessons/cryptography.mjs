import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table } from '../../src/components.mjs';
import { threeTools, keyPair } from '../diagrams/trust.mjs';

export default {
  minutes: 10,
  lede: 'This lesson is optional. The last two lessons used words like “hash”, “signature” and “key” without opening them up. Here is what each tool does, where CardVault uses it, and the one or two facts about each that matter when you test. You do not need any mathematics.',
  youWill: 'You will tell hashing, encryption and signing apart, and know which one protects each secret in CardVault.',
  body: `
<h2>Three different tools</h2>
<p>People often say “encrypted” for anything secret-looking, but there are three separate tools, and each answers a different question.</p>
${figure({ svg: threeTools(), caption: 'Hashing hides a value for good. Encryption hides it until someone with the key needs it back. Signing hides nothing, but makes changes detectable.' })}
${table(['Secret in CardVault', 'Tool', 'Why that tool'], [
  ['Customer passwords', 'Hashing (scrypt)', 'auth only needs to check a password, never to read it'],
  ['Refresh tokens in the database', 'Hashing (SHA-256)', 'auth only needs to recognise a token it is shown'],
  ['Full card numbers', 'Encryption (AES-256-GCM)', 'A bank must be able to get the number back when it needs it'],
  ['Access tokens', 'Signing (RS256)', 'Every service must read the claims and trust them'],
  ['Messages between enrollment and the operator', 'Signing (HMAC-SHA256)', 'Both sides must trust the body and its time'],
])}

<h2>Passwords: slow on purpose</h2>
<p>auth stores each password as an <strong>scrypt</strong> hash. Two details make it strong:</p>
<ul>
<li><strong>A salt.</strong> Before hashing, auth adds 16 random bytes, different for every user, and stores them beside the hash. Two customers with the same password therefore get different hashes, and a precomputed table of common passwords is useless.</li>
<li><strong>Deliberately slow.</strong> scrypt is designed to need a lot of memory and time. One check takes a noticeable fraction of a second, which nobody notices at login, but which makes trying billions of guesses against a stolen database impractical.</li>
</ul>
<p>The stored value records its own settings, <code>scrypt$16384$8$1$&lt;salt&gt;$&lt;hash&gt;</code>, so the settings can be raised later without breaking old passwords.</p>
<p>Refresh tokens are hashed too, with plain SHA-256. They are long random strings, not human-chosen words, so a slow hash is not needed. Storing only the hash means that a copy of auth’s database does not contain any token an attacker could use.</p>

<h2>Card numbers: encrypted, and tied to their card</h2>
<p>A bank must be able to recover a full card number, for example to produce a replacement card, so it is encrypted, not hashed. (CardVault’s current features never need to read it back, but the design keeps that door open.) CardVault uses <strong>AES-256-GCM</strong> with a key from configuration. The stored value looks like <code>v1:</code> followed by random-looking text.</p>
<p>GCM also lets you attach extra data that must match on decryption. CardVault attaches the card’s own ID. If someone copied the encrypted number from one card’s row onto another card’s row, decryption would fail. The <code>v1:</code> prefix leaves room for a new scheme later.</p>
${keyIdea(`<p>The full card number never leaves the card service. Every API, every event and every log line uses only the last four digits. If a test ever sees 13 to 19 digits in a row in a response, an event or a log line, that is a finding.</p>`)}

<h2>Access tokens: a key pair</h2>
<p>HMAC, from <a href="/learn/machines-calling-machines/">the last lesson</a>, uses one secret that both sides share. That works for two parties. For access tokens it would mean giving the signing secret to every service, and then any service could create tokens. Instead, auth uses a <strong>key pair</strong>:</p>
${figure({ svg: keyPair(), caption: 'Signing needs the private key; checking needs only the public one. Publishing the public key is safe.' })}
<ul>
<li>The <strong>private key</strong> stays inside auth and is the only thing that can create a valid signature. auth generates a 2048-bit RSA key the first time it starts and keeps it in its own database.</li>
<li>The <strong>public key</strong> is published as a JWKS (JSON Web Key Set) at <code>/.well-known/jwks.json</code>. It can check signatures but cannot make them.</li>
<li>Each key has an ID, the <code>kid</code>, which every token names in its header. A service caches the keys it has seen. When a token names a <code>kid</code> it does not know, it fetches the set again, at most once every 5 seconds. That is how a new key can be introduced without restarting anything.</li>
</ul>
${testerEye(`<p>Useful token tests change one thing at a time: a token with one character of the signature changed, a token naming a <code>kid</code> that does not exist, a token with <code>"alg": "none"</code>, a token for another audience. Each must get <code>401 TOKEN_INVALID</code>. A test that only checks good tokens never finds out whether bad ones are refused.</p>`)}

<h2>Not cryptography: the check digit</h2>
<p>A card number’s last digit is a <strong>Luhn check digit</strong>, calculated from the others. It catches typing mistakes, such as two swapped digits. It is not a security measure: anyone can calculate it. CardVault’s seed data generates numbers that pass the Luhn check, so they look like real card numbers to any software that checks them, while using a prefix that no real card has.</p>
${realWorld(`<p>Real banks keep keys like <code>CARD_PAN_KEY</code> in a hardware security module (HSM) or a cloud key service, so the key itself never appears in a configuration file, and they often replace the card number with a meaningless token everywhere except one tightly controlled vault. CardVault keeps the shape of that design while staying small enough to run on a laptop.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Hash', 'A one-way fingerprint of some data. You can check a guess against it but cannot reverse it.'],
  ['Salt', 'Random bytes added to each password before hashing, so equal passwords get different hashes.'],
  ['Encryption', 'Scrambling data with a key so that only someone with the key can get it back.'],
  ['Key pair', 'A private key that signs and a public key that checks. Used for RS256 access tokens.'],
  ['JWKS', 'JSON Web Key Set: the published list of public keys, each with a `kid`.'],
  ['Luhn check digit', 'The last digit of a card number, which catches typing errors. Not a security feature.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'Why does the auth service sign access tokens with a private key instead of a shared HMAC secret?',
  options: ['RSA is faster than HMAC', 'So that the other services can check tokens without being able to create them', 'Because HMAC cannot sign JSON', 'So that tokens are encrypted'],
  answer: 1,
  why: '<p>With a shared secret, every service that can check a token could also forge one. With a key pair, only auth holds the private key, and everyone else gets the public key, which can only check.</p>',
})}
${check({
  q: 'A test reads a card row with the read-only database role and sees `pan_encrypted` starting with `v1:`. It copies that value onto a different card’s row in a scratch copy of the database. What happens when the card service tries to decrypt it?',
  options: ['It decrypts to the first card’s number', 'Decryption fails, because the card ID is bound into the encryption', 'It decrypts to the second card’s number', 'The `v1:` prefix is stripped and it works'],
  answer: 1,
  why: '<p>AES-GCM checks the attached card ID as part of decryption. A different card ID means the check fails, so the moved value is useless.</p>',
})}

<h2>Recap</h2>
${recap([
  'Hashing is one way, encryption is two way, signing makes changes detectable.',
  'Passwords use salted, deliberately slow scrypt; refresh tokens are stored only as SHA-256 hashes.',
  'Card numbers use AES-256-GCM, bound to the card ID, and never leave the card service.',
  'Access tokens are signed with auth’s private key and checked with the public JWKS, found by `kid`.',
  'The Luhn digit catches typos. It is not security.',
])}
`,
};
