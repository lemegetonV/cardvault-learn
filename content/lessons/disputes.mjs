import { keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';

export default {
  minutes: 9,
  lede: 'Sometimes a customer looks at a purchase and says “that wasn’t me”, or “I was charged twice”. Raising a dispute is how they tell the bank. CardVault keeps disputes deliberately small, but even a small form with a file upload brings its own set of rules worth testing.',
  youWill: 'You will learn which transactions can be disputed, what a dispute holds, and how CardVault checks an uploaded receipt.',
  body: `
<h2>Opening a dispute</h2>
<p>A customer opens a dispute on one of their wallet transactions with <code>POST /v1/wallet/transactions/{txn_id}/disputes</code>. Unlike every other CardVault endpoint, this one takes a <strong>multipart form</strong> instead of JSON, because it can carry a file.</p>
${table(['Form field', 'Required', 'Rules'], [
  ['`reason`', 'yes', 'One of `UNRECOGNISED`, `DUPLICATE`, `WRONG_AMOUNT`, `NOT_RECEIVED`'],
  ['`note`', 'no', 'At most 500 characters'],
  ['`receipt`', 'no', 'A PDF, PNG or JPEG file of at most 5,242,880 bytes (5 MB)'],
])}
${code({ lang: 'text', title: 'Example · opening a dispute with curl', src: `curl -X POST http://localhost:8004/v1/wallet/transactions/$TXN/disputes \\
  -H "Authorization: Bearer $TOKEN" \\
  -F reason=WRONG_AMOUNT \\
  -F note="Charged 42.50, menu price was 24.50" \\
  -F receipt=@receipt.pdf` })}
<p>A successful dispute returns <code>201</code> with status <code>OPEN</code>. In CardVault that is where its life ends: there is no investigation or resolution, and opening a dispute does not change the transaction or the card’s money. The transaction now shows <code>open_dispute_id</code>.</p>

<h2>Which transactions can be disputed</h2>
${table(['Status', 'Disputable?', 'Why'], [
  ['`AUTHORIZED`, `SETTLED`, `PARTIALLY_REVERSED`, `PARTIALLY_REFUNDED`', 'yes', 'Money was, or still is, taken'],
  ['`DECLINED`', 'no', 'No money moved'],
  ['`REVERSED`, `REFUNDED`', 'no', 'All the money is already back'],
])}
<p>A transaction that is not disputable returns <code>422 TRANSACTION_NOT_DISPUTABLE</code>. A transaction may have only one open dispute at a time; a second returns <code>409 DISPUTE_ALREADY_OPEN</code> with the existing <code>dispute_id</code>. Another customer’s transaction, as everywhere in this service, returns <code>404</code>.</p>
<p>Two requests for the same transaction at the same instant could both pass the “already open?” check. The database has a unique index that allows one open dispute per transaction, so the second insert fails and is turned into the same <code>409</code>. The rule holds even under a race. <a href="/learn/locks-and-concurrency/">Locks and concurrency</a> looks at races like this one.</p>

<h2>Trusting the file, not its name</h2>
<p>A file’s name and the <code>Content-Type</code> the browser sends are both chosen by the client, so neither proves anything. CardVault decides the type from the file’s first bytes, its <strong>magic number</strong>.</p>
${table(['Type', 'File starts with'], [
  ['PDF', '`%PDF-`'],
  ['PNG', '`89 50 4E 47 0D 0A 1A 0A` (`\\x89PNG` and four more bytes)'],
  ['JPEG', '`FF D8 FF`'],
])}
<p>So a PNG renamed <code>receipt.pdf</code> is stored as a PNG, and a text file renamed <code>receipt.pdf</code> is refused with <code>422 RECEIPT_TYPE_NOT_ALLOWED</code>. A file over the limit is refused with <code>422 RECEIPT_TOO_LARGE</code>; exactly 5,242,880 bytes is allowed. The file itself is never returned by the API, only its name, detected type and size.</p>
${keyIdea(`<p>Anything that arrives from the client is a claim until the server checks it. For a file, that means its content, not the label on it.</p>`)}

<h2>Safe to retry</h2>
<p>Opening a dispute accepts an <a href="/learn/idempotency-keys/">idempotency key</a>. For a multipart form, the fingerprint is built from the reason, the note and the SHA-256 hash of the receipt, rather than from the raw request body, whose layout can differ between two sends of the same form. Re-sending the same form with the same key replays the first answer; changing the note or the file under the same key is a <code>422 IDEMPOTENCY_KEY_REUSED</code>.</p>
<p>The seed includes one open dispute on one of alice’s transactions, so the “already open” case can be tested without setup. <code>GET /v1/wallet/disputes</code> lists a customer’s disputes, newest first, with the same cursor paging as transactions.</p>
${testerEye(`<p>Build test files on purpose: a real PDF, a PNG named <code>.pdf</code>, a text file named <code>.pdf</code>, and files of exactly 5,242,880 and 5,242,881 bytes. Check every non-disputable status, the second dispute, and alice trying bob’s transaction. Fire two identical requests at once without an idempotency key and assert exactly one <code>201</code> and one <code>409</code>.</p>`)}
${realWorld(`<p>A real dispute starts a process with deadlines set by the card network: the bank may refund the customer provisionally, ask the merchant for evidence, and decide weeks later. Uploaded files are virus-scanned and kept in separate storage. CardVault stops at “opened”, which is enough to test the front door of that process.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Dispute', 'A customer’s formal challenge to a transaction. In CardVault, it only reaches OPEN.'],
  ['Multipart form', 'A request body in several parts, used to send fields and files together.'],
  ['Magic number', 'The first bytes of a file, which identify its real type.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A customer disputes a REFUNDED transaction. What is the answer?',
  options: ['`201`, any transaction can be disputed', '`422 TRANSACTION_NOT_DISPUTABLE`', '`409 DISPUTE_ALREADY_OPEN`', '`404`'],
  answer: 1,
  why: '<p>A fully refunded transaction has nothing left to dispute. Only AUTHORIZED, SETTLED, PARTIALLY_REVERSED and PARTIALLY_REFUNDED are disputable.</p>',
})}
${check({
  q: 'A test uploads a JPEG photo named `receipt.pdf` with `Content-Type: application/pdf`. How is it stored?',
  options: ['As a PDF', 'As `image/jpeg`, detected from its first bytes', 'Refused, the name and content disagree', 'As `application/octet-stream`'],
  answer: 1,
  why: '<p>The type comes from the content. JPEG is allowed, so the dispute is created with the receipt recorded as <code>image/jpeg</code>.</p>',
})}
${check({
  q: 'Two identical dispute requests for the same transaction, without an idempotency key, arrive at the same instant. What should happen?',
  options: ['Two disputes are created', 'One gets 201; the other gets 409 DISPUTE_ALREADY_OPEN', 'Both get 409', 'Both get 201 with the same dispute'],
  answer: 1,
  why: '<p>The unique index allows only one open dispute per transaction, so the slower insert fails and is answered with 409.</p>',
})}

<h2>Recap</h2>
${recap([
  'A dispute is a multipart form: reason, optional note, optional receipt.',
  'Only transactions where money is still taken can be disputed, one open dispute at a time.',
  'The receipt’s type comes from its first bytes; PDF, PNG and JPEG up to 5 MB.',
  'A unique index keeps “one open dispute” true even under a race.',
  'Idempotency for the form fingerprints the fields and the receipt’s hash.',
])}
`,
};
