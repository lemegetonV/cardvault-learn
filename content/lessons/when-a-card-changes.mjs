import { keyIdea, testerEye, realWorld, terms, check, recap, table, sequence } from '../../src/components.mjs';

const lostThenReissued = sequence({
  id: 'seq-reissue',
  label: 'alice reports her card lost. The card service publishes CARD_LOST; enrollment asks the operator to suspend, and the operator confirms. alice then reissues the card. The card service publishes CARD_ACTIVATED with the new last4; enrollment asks the operator to resume and to update the card details, and the operator confirms both.',
  actors: [
    { id: 'card', label: 'card service', kind: 'bank' },
    { id: 'enr', label: 'enrollment', kind: 'bank' },
    { id: 'op', label: 'operator mock', kind: 'mock' },
  ],
  steps: [
    { from: 'card', to: 'enr', kind: 'event', label: 'CARD_LOST', note: 'alice reports card 4417 lost. The event carries the card’s full state: status LOST.' },
    { from: 'enr', to: 'op', label: 'suspend', note: 'The card is LOST and the enrolment is heading for ENROLLED, so enrollment queues a suspend. The enrolment stays ENROLLED for now, waiting for the operator.' },
    { from: 'op', to: 'enr', kind: 'reply', label: 'callback: SUSPENDED', note: 'The operator confirms. The enrolment becomes SUSPENDED with reason CARD_LOST, and `enrollment.changed` tells the card service, which stops the token.' },
    { from: 'card', to: 'enr', kind: 'event', label: 'CARD_ACTIVATED (new last4)', note: 'alice reissues the card. Same `card_id`, new number and expiry, status ACTIVE again. `CARD_REISSUED` follows it.' },
    { from: 'enr', to: 'op', label: 'resume', note: 'The card is ACTIVE and eligible, but the enrolment is suspended, so enrollment queues a resume.' },
    { from: 'enr', to: 'op', label: 'update last4 + expiry', note: 'The last4 and expiry the operator has are the old ones, so enrollment also queues an update. Both calls go out in order, one behind the other.' },
    { from: 'op', to: 'enr', kind: 'reply', label: 'callbacks: ENROLLED', note: 'The operator confirms. The enrolment is ENROLLED again, with the same token and the new card details.' },
  ],
  caption: 'The wallet follows the card, one event at a time.',
});

export default {
  minutes: 10,
  lede: 'A card in the wallet does not stand still. It gets lost, reissued, closed; it stops being used; its owner changes their phone number. Each time, the wallet must follow. This lesson shows how the enrollment service reacts to events, and the one idea that keeps it from sending the same request twice.',
  youWill: 'You will learn what the wallet does for each kind of change, and how the enrollment service decides whether a change is needed.',
  body: `
<h2>Following the card</h2>
<p>The enrollment service listens to <code>card.lifecycle</code> and <code>contact.updated</code>. For every event it first updates its own copy of the card or contact, then asks one question about each affected card: <em>does the wallet match what the card now needs?</em> If not, it asks the operator to change it.</p>
${lostThenReissued}

<h2>What each change leads to</h2>
${table(['What changed', 'Enrollment asks the operator to', 'Enrolment afterwards'], [
  ['Card reported LOST', 'suspend', 'SUSPENDED, reason `CARD_LOST`'],
  ['Card reissued after being lost', 'resume, then update last4 and expiry', 'ENROLLED, same token'],
  ['Card reissued while active', 'update last4 and expiry', 'ENROLLED'],
  ['Card CLOSED', 'remove', 'REMOVED, reason `CARD_CLOSED`'],
  ['Card no longer eligible (expired, not used in 90 days, contact unverified…)', 'remove', 'REMOVED, with the eligibility reason'],
  ['Contact details changed, still verified', 'update contact', 'ENROLLED'],
])}
<p>For these bank-driven changes, the enrolment changes status only when the operator’s <a href="/learn/callbacks/">callback</a> confirms it. Until then it keeps its old status, with the request waiting. That is different from a customer’s own removal, which <a href="/learn/enrolment/">takes effect at once</a>.</p>
<p>Notice that a reissue keeps the token. The <code>card_id</code> does not change when a card is reissued, and the token belongs to the card, so the wallet only needs the new last four digits and expiry to show.</p>

<h2>Intent: where the operator is heading</h2>
<p>Events can arrive in quick succession, and a request to the operator takes a few seconds to be confirmed. If the service compared the card only with the enrolment’s current status, it could ask for the same thing twice: two events for the same lost card while a suspend is still waiting would each trigger another suspend.</p>
<p>So the service compares the card with the <strong>intent</strong> instead: the status the operator will have once every request already sent has been applied. If the enrolment is ENROLLED but a suspend is waiting, the intent is SUSPENDED, and a second suspend is not needed.</p>
${table(['Status', 'Request waiting', 'Intent'], [
  ['ENROLLED', 'none', 'ENROLLED'],
  ['ENROLLED', 'suspend', 'SUSPENDED'],
  ['SUSPENDED', 'resume', 'ENROLLED'],
  ['ENROLLED', 'remove', 'REMOVED'],
])}
${keyIdea(`<p>React to the difference between what is needed and where things are already heading, not where they are now. That makes reactions idempotent: the same event, or a burst of similar ones, leads to at most one request.</p>`)}

<h2>Contact changes</h2>
<p>A <code>contact.updated</code> event can affect every card the customer has. The service checks each one. If the customer’s phone is now unverified, every card becomes ineligible and is removed. If the details changed but are still verified, each enrolled card gets an “update contact” request, so the operator has the new email or phone. An event with an older profile <code>version</code> than the copy already held is ignored.</p>
${testerEye(`<p>The interesting tests chain two or three changes quickly. Report a card lost and reissue it straight away; assert that the wallet ends ENROLLED, with the new last4 at the operator (<code>GET /test/state</code> on the operator mock) and no extra suspend requests. Close a suspended card and assert it ends REMOVED. Change a verified phone to a new number: every enrolled card should be removed, because the new number is unverified. Each of these needs a bounded wait, since every step goes through an event and a callback.</p>`)}
${realWorld(`<p>A real wallet may also be told about card replacements by the card network, which can update the token’s card details directly. CardVault routes every change through the bank’s enrollment service so there is one place to observe and test.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Reaction', 'What the enrollment service asks the operator to do after a card or contact event.'],
  ['Intent', 'The status the operator will have once every request already sent is applied.'],
  ['Bank-driven change', 'A suspend, resume, update or removal the bank starts because the card changed; confirmed by callback.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'An ENROLLED card is reported lost. One second later, before the operator’s callback, a second `card.lifecycle` event for the same card arrives, still showing LOST. How many suspend requests are sent?',
  options: ['Two', 'One: the intent is already SUSPENDED, so no second request is needed', 'None', 'One per partition'],
  answer: 1,
  why: '<p>The first event queued a suspend. The second sees the intent is SUSPENDED and does nothing. (A repeat of the very same event would be skipped even earlier, by its <code>event_id</code>.)</p>',
})}
${check({
  q: 'A card that is in the wallet is reissued. Does the customer get a new wallet token?',
  options: ['Yes, a reissue always creates a new token', 'No: the card_id stays the same, so the token stays; the operator gets the new last4 and expiry', 'Only for DEBIT cards', 'The card is removed from the wallet'],
  answer: 1,
  why: '<p>The token maps to the <code>card_id</code>, which a reissue keeps. Only the details shown in the wallet change.</p>',
})}
${check({
  q: 'The card service closes a card that is in the wallet. Right after the close, before the operator answers, what is the enrolment’s status?',
  options: ['REMOVED', 'Still ENROLLED, with a removal waiting; REMOVED when the callback arrives', 'SUSPENDED', 'FAILED'],
  answer: 1,
  why: '<p>Bank-driven removals wait for the operator’s confirmation. Only the customer’s own removal is immediate.</p>',
})}

<h2>Recap</h2>
${recap([
  'The enrollment service updates its copies from events, then checks each affected card.',
  'Lost: suspend. Reissued: resume and update. Closed or ineligible: remove. Contact changed: update or remove.',
  'Bank-driven changes take effect when the operator’s callback confirms them.',
  'Reactions compare the card with the intent, so no request is sent twice.',
  'A reissue keeps the `card_id`, and so keeps the token.',
])}
`,
};
