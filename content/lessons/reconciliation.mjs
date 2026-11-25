import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { reconCompare } from '../diagrams/wallet.mjs';

export default {
  minutes: 9,
  lede: 'The bank and the wallet operator each keep a list of enrolments. Every request, callback and retry so far has been designed to keep the two lists the same. Reconciliation is how the bank checks that they really are: it compares its list with the operator’s, line by line, and reports every difference.',
  youWill: 'You will learn how a reconciliation run works, the four kinds of finding, and why some enrolments are deliberately left out.',
  body: `
<h2>Why check at all?</h2>
<p>Two systems that talk over a network can drift apart despite careful design. A callback can be lost, someone can fix a record by hand on one side, or a defect can apply a change on one side only. Each such difference is invisible until a customer notices: a card that should be suspended still pays, or a card they added is missing from their phone.</p>
<p><strong>Reconciliation</strong> catches these differences by comparing the two sides directly, independently of all the messages in between. The bank’s side is its <a href="/learn/enrolment/">system of record</a>. The operator’s side is its <strong>daily enrolment file</strong>: a CSV with one line per enrolment it holds.</p>
${code({ lang: 'text', title: 'The operator’s file: GET /v1/files/enrollments/2026-11-25 (first lines)', src: `operator_ref,enrollment_id,card_id,token_ref,status,last4,expiry,operator_version,updated_at
op_e4400000a11c40008000000000000001,e4400000-a11c-4000-8000-000000000001,ca4d0000-a11c-4000-8000-000000000001,tok_a11ce0c4ed170000000001,ENROLLED,4417,2029-06,…` })}

<h2>A run, step by step</h2>
<p>A test starts a run with <code>POST /internal/v1/reconciliation/runs</code> and the tests service key, optionally naming a <code>file_date</code> (by default, today on the shared clock). The enrollment service then:</p>
<ol>
<li>fetches the operator’s file for that date, with an HMAC-signed request;</li>
<li>reads every enrolment in its own table;</li>
<li>matches the two by <code>enrollment_id</code> and compares them;</li>
<li>stores the run and every finding, and returns them with <code>201</code>.</li>
</ol>
<p>If the file cannot be fetched, the run is stored as FAILED and the answer is <code>502 OPERATOR_FILE_UNAVAILABLE</code>, with the <code>run_id</code> so it can be looked up later at <code>GET /internal/v1/reconciliation/runs/{run_id}</code>.</p>

<h2>Four kinds of finding</h2>
${figure({ svg: reconCompare() })}
${table(['Finding', 'Bank', 'Operator', 'A customer would notice'], [
  ['`MISSING_AT_OPERATOR`', 'ENROLLED or SUSPENDED', 'no record', 'The card is not on the phone'],
  ['`MISSING_IN_SOR`', 'no record', 'any record', 'The bank cannot explain a card on the phone'],
  ['`STATUS_MISMATCH`', 'one status', 'another', 'For example, a lost card still pays'],
  ['`DATA_MISMATCH`', 'same status, ENROLLED or SUSPENDED', 'different last4 or expiry', 'The phone shows the old card'],
])}
<p>A <code>DATA_MISMATCH</code> finding lists each field that differs, with both values, in <code>details</code>. When the status already differs, the last4 and expiry are not compared as well: one finding per enrolment is enough to send someone to look.</p>
${keyIdea(`<p>Enrolments that are in flight are skipped: those still PENDING, and those waiting for a callback. The two sides are <em>expected</em> to differ until the callback lands, so comparing them would only produce noise. The run counts them in <code>skipped_in_flight</code>.</p>`)}

<h2>What a run returns</h2>
${code({ lang: 'json', title: 'A run with one finding (shortened)', src: `{
  "run_id": "…",
  "file_date": "2026-11-25",
  "status": "COMPLETED",
  "sor_records": 5,
  "file_records": 5,
  "skipped_in_flight": 0,
  "finding_count": 1,
  "findings": [
    {
      "type": "DATA_MISMATCH",
      "enrollment_id": "e4400000-a11c-4000-8000-000000000001",
      "sor_status": "ENROLLED",
      "operator_status": "ENROLLED",
      "details": { "last4": { "sor": "4417", "operator": "0000" } }
    }
  ]
}` })}
<p>Reconciliation only reports. It does not repair anything, because deciding which side is right needs a person, or at least a rule much more careful than “the bank wins”.</p>

<h2>Creating a difference on purpose</h2>
<p>Straight after a reset, the operator mock’s records match the bank’s seed, so a run finds nothing. To test each finding, a test changes the operator’s side directly with <code>POST /test/state</code> on the operator mock, which edits or deletes records without sending any callback.</p>
${code({ lang: 'json', title: 'POST /test/state on the operator mock: make one record disagree', src: `{
  "upsert": [
    { "enrollment_id": "e4400000-a11c-4000-8000-000000000001", "last4": "0000" }
  ]
}` })}
${testerEye(`<p>Write one test per finding type, each changing exactly one record and asserting exactly one finding of the expected type, with the right IDs and values. Then test the quiet paths: a clean run finds nothing, an enrolment held PENDING with <code>callback_delay</code> is counted in <code>skipped_in_flight</code> and not reported, and an operator that answers with an error produces a stored FAILED run and a <code>502</code>.</p>`)}
${realWorld(`<p>Banks reconcile everything that crosses a boundary: card transactions against the network’s settlement files, payments against ledger entries, balances against partner banks. Mismatches open cases for an operations team, and the size of each day’s list is watched closely. CardVault’s run is the same idea at the size of one table.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Reconciliation', 'Comparing two independent records of the same thing and reporting every difference.'],
  ['Daily enrolment file', 'The operator’s CSV list of every enrolment it holds.'],
  ['Finding', 'One difference found by a reconciliation run, with its type and both sides’ values.'],
  ['In flight', 'An enrolment PENDING or waiting for a callback; skipped by reconciliation.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'The bank shows an enrolment as SUSPENDED and the operator’s file shows it ENROLLED, with a different last4. How many findings does the run report for it, and of what type?',
  options: ['Two: STATUS_MISMATCH and DATA_MISMATCH', 'One: STATUS_MISMATCH; data is compared only when the statuses match', 'One: DATA_MISMATCH', 'None, it is in flight'],
  answer: 1,
  why: '<p>A status difference is reported on its own. last4 and expiry are compared only when both sides agree on the status.</p>',
})}
${check({
  q: 'A card was just added and is PENDING. The operator already holds a record for it. Is that a finding?',
  options: ['Yes, STATUS_MISMATCH', 'No: PENDING enrolments are in flight and skipped', 'Yes, MISSING_IN_SOR', 'Yes, MISSING_AT_OPERATOR'],
  answer: 1,
  why: '<p>Until the callback arrives the two sides are expected to differ, so in-flight enrolments are counted in <code>skipped_in_flight</code>, not compared.</p>',
})}
${check({
  q: 'The bank has an enrolment as REMOVED, and the operator’s file has no record for it. Is that a finding?',
  options: ['Yes, MISSING_AT_OPERATOR', 'No: MISSING_AT_OPERATOR applies only to ENROLLED or SUSPENDED enrolments', 'Yes, STATUS_MISMATCH', 'Yes, MISSING_IN_SOR'],
  answer: 1,
  why: '<p>A removed enrolment has no reason to be in the wallet, so its absence at the operator is consistent.</p>',
})}

<h2>Recap</h2>
${recap([
  'Reconciliation compares the bank’s enrolments with the operator’s daily file.',
  'Four findings: missing at the operator, missing at the bank, status mismatch, data mismatch.',
  'In-flight enrolments are skipped and counted.',
  'A run only reports; a failed fetch is stored and answered with 502.',
  'Tests create differences with the operator mock’s `POST /test/state`.',
])}
`,
};
