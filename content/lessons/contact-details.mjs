import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { verifyFlow, ifMatch } from '../diagrams/wallet.mjs';

export default {
  minutes: 10,
  lede: 'Before a bank puts a card into a phone wallet, it wants to know it can reach the customer: an email address and a phone number it has checked. The profile service holds those details and the proof that each one works. This module starts here, because every wallet rule later depends on it.',
  youWill: 'You will learn how a contact detail becomes verified, why changing it resets that, and how CardVault stops two edits from overwriting each other.',
  body: `
<h2>Why contact details matter to the wallet</h2>
<p>When a card is in a phone wallet, the wallet operator may need to contact the customer: to confirm the card was added, or to warn them it was suspended. A wrong address means those messages go to a stranger. So CardVault only lets a card into the wallet if the customer’s email <em>and</em> phone are <strong>verified</strong>, which means the customer proved they receive messages there.</p>
<p>The <strong>profile service</strong> owns these details. Each customer has one profile:</p>
${table(['Field', 'Example (alice)', 'Meaning'], [
  ['`email`', '`alice@example.com`', 'The address'],
  ['`email_verified`', '`true`', 'Has she proved she reads it?'],
  ['`phone`', '`+15550100101`', 'In E.164 format: a plus, the country code, then the number'],
  ['`phone_verified`', '`true`', 'Has she proved she receives texts there?'],
  ['`version`', '`1`', 'Goes up by one with every change'],
])}
<p>All seed customers have verified details except dana, whose phone is not verified. You will see in the next lesson what that does to her cards.</p>

<h2>Proving you own a contact</h2>
<p>Verification is a short exchange. The customer asks for a code, the bank sends a six-digit one-time code to the address, and the customer types it back.</p>
${figure({ svg: verifyFlow() })}
${table(['Call', 'Success', 'Refusals'], [
  ['`POST /v1/profile/verify/send` `{"channel": "EMAIL"}`', '`202`, with the destination masked, such as `a***@example.com`', '`429 OTP_COOLDOWN` within 30 s of the last code; `409 ALREADY_VERIFIED`; `422 CONTACT_MISSING`'],
  ['`POST /v1/profile/verify` `{"channel": "EMAIL", "code": "000000"}`', '`200` with the updated profile', '`422 OTP_INVALID` with `attempts_remaining`; `423 OTP_LOCKED` on the fifth wrong code'],
])}
<p>CardVault does not really send emails or texts. In test mode the code is always <code>000000</code>, so a test can verify a contact without reading an inbox. The 30-second cooldown and the 15-minute lock run on the <a href="/learn/the-shared-clock/">shared clock</a>, so a test can move time forward instead of waiting.</p>
<p>Each channel, email and phone, has its own cooldown and its own wrong-code counter. Locking the email does not lock the phone.</p>
${keyIdea(`<p>A verified flag belongs to a value, not to a customer. Changing the email to a new address makes it unverified again, because nobody has proved the new address works. Setting the same address again keeps the flag.</p>`)}

<h2>Two edits at once</h2>
<p>Imagine alice has the profile page open in two browser tabs. In one she changes her email; in the other, opened earlier, she changes her phone and saves. Without care, the second save could quietly undo the first, because it was based on an older copy. This is called a <strong>lost update</strong>.</p>
<p>CardVault prevents it with <strong>optimistic locking</strong>. Every read returns the profile’s <code>version</code>, also in the <code>ETag</code> response header. When saving, the client sends that version back in an <code>If-Match</code> header. If someone changed the profile in the meantime, the versions no longer match and the save is refused.</p>
${figure({ svg: ifMatch() })}
${code({ lang: 'http', title: 'Changing the phone safely', src: `PATCH /v1/profile
If-Match: 3
Content-Type: application/json

{"phone": "+15550100199"}` })}
<p>It is called “optimistic” because nothing is locked while the customer is typing; the service only checks for a clash at the moment of saving. <code>If-Match</code> is optional: a request without it simply saves.</p>

<h2>Telling the rest of CardVault</h2>
<p>Every change to a profile, including a successful verification, publishes a <code>contact.updated</code> event through the <a href="/learn/transactional-outbox/">outbox</a>, keyed by <code>customer_id</code>. The event carries the full current contact details and their flags. The enrollment service keeps its own copy from these events and reacts to them, as <a href="/learn/when-a-card-changes/">When a card changes</a> shows. A PATCH that changes nothing publishes nothing.</p>
${testerEye(`<p>Good tests here are small and sharp. Change the email and assert it is unverified, then set the same value again and assert the flag is untouched. Send five wrong codes and check the fourth answer says one attempt remains and the fifth answers <code>423</code>. Move the clock 15 minutes and verify again. Use two reads and two <code>If-Match</code> saves to prove the second gets <code>412</code>. Then look further: did each change publish exactly one <code>contact.updated</code>?</p>`)}
${realWorld(`<p>Real banks send the code through an SMS or email provider, expire it after a few minutes, and keep only a hash of it. Outside test mode CardVault stores a hash too, but since there is no delivery channel, only test mode’s fixed code can actually be used.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Verified contact', 'An email or phone the customer has proved they receive messages at, by returning a one-time code.'],
  ['One-time code (OTP)', 'A short code sent to a contact to prove ownership. `000000` in test mode.'],
  ['Cooldown', 'The minimum wait between two codes for the same channel: 30 seconds.'],
  ['Lost update', 'A save based on an old copy that silently overwrites a newer change.'],
  ['Optimistic locking', 'Detecting a clash at save time by comparing versions, here with `If-Match` and `412`.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'alice’s email `alice@example.com` is verified. A test sends `PATCH /v1/profile` with `{"email": "Alice@Example.com"}`. Is her email still verified?',
  options: ['No, any PATCH resets the flag', 'Yes: the email is stored in lower case, so it is the same value and the flag is kept', 'No, the case changed', 'The PATCH is refused with 422'],
  answer: 1,
  why: '<p>The service lower-cases the email before comparing. The value is unchanged, so the flag stays and no event is published.</p>',
})}
${check({
  q: 'A customer has entered 4 wrong codes for the phone. What does the 5th wrong code return, and can they still verify the email?',
  options: ['`422`; no', '`423 OTP_LOCKED`; yes, each channel has its own counter', '`429`; yes', '`423`; no, the whole profile is locked'],
  answer: 1,
  why: '<p>The fifth wrong code locks that channel for 15 minutes. Email and phone keep separate counters.</p>',
})}
${check({
  q: 'Tab A and tab B both read version 7. Tab A saves with `If-Match: 7`. Tab B then saves with `If-Match: 7`. What does tab B get?',
  options: ['`200`, and tab A’s change is lost', '`412 VERSION_MISMATCH` with `current_version: 8`', '`409 CONFLICT`', '`200`, both changes merged'],
  answer: 1,
  why: '<p>Tab A’s save moved the profile to version 8. Tab B’s version is stale, so it is refused and told the current version.</p>',
})}

<h2>Recap</h2>
${recap([
  'The profile service owns email and phone, each with a verified flag.',
  'A changed value is unverified; the same value keeps its flag.',
  'Codes have a 30-second cooldown and five tries before a 15-minute lock, per channel. Test mode uses `000000`.',
  '`If-Match` with the version turns a lost update into a `412`.',
  'Every real change publishes `contact.updated`, keyed by `customer_id`.',
])}
`,
};
