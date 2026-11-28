import { sequence, interview, table, keyIdea, shot, testerEye, tryIt } from '../../src/components.mjs';

export default {
  minutes: 9,
  lede: 'Adding a card to the wallet is CardVault’s main feature, and its most interesting flow: the bank checks a set of rules, then has to ask an outside company and wait for its answer. This lesson follows it from the button to the final status.',
  youWill: 'You will be able to explain the wallet rules and the asynchronous add-card flow.',
  body: `
<h2>Who may join the wallet</h2>
<p>Before anything else, the Wallet service decides whether the card is <strong>eligible</strong>. It checks these rules in order and stops at the first one that fails. That failed rule becomes the reason the app shows next to the card.</p>
${table(['Rule', 'Reason shown if it fails'], [
  ['The card is active (not lost or closed)', '`CARD_NOT_ACTIVE`'],
  ['The card has not expired', '`CARD_EXPIRED`'],
  ['It is a credit or debit card (not prepaid)', '`PRODUCT_NOT_SUPPORTED`'],
  ['It was used in the last 90 days', '`NOT_RECENTLY_USED`'],
  ['The customer has not opted out of the wallet', '`CUSTOMER_OPTED_OUT`'],
  ['The customer has not removed this card themselves', '`CARD_REMOVED_BY_CUSTOMER`'],
  ['The customer’s email is verified', '`EMAIL_NOT_VERIFIED`'],
  ['The customer’s phone is verified', '`PHONE_NOT_VERIFIED`'],
])}
<p>You saw two of these on alice’s wallet screen: card 7380 has not been used recently, and card 5521 is prepaid.</p>

<h2>Adding a card, step by step</h2>
${sequence({
  id: 'add-card-flow',
  label: 'Adding a card to the wallet, from the button to ENROLLED',
  actors: [
    { id: 'b', label: 'Browser', kind: 'plain' },
    { id: 'w', label: 'Web app (BFF)', kind: 'bank' },
    { id: 'e', label: 'Wallet', kind: 'bank' },
    { id: 'o', label: 'Wallet company', kind: 'mock' },
    { id: 'c', label: 'Cards', kind: 'bank' },
  ],
  steps: [
    { from: 'b', to: 'w', label: 'add card, accept terms', note: 'The customer presses **Add to wallet** and accepts the wallet company’s terms in a short confirmation.' },
    { from: 'w', to: 'e', label: 'POST /v1/wallet/cards/{id}', note: 'The BFF asks the Wallet service to add the card, with the version of the terms the customer accepted.' },
    { from: 'e', to: 'e', label: 'check the rules', kind: 'self', note: 'Wallet checks the eligibility rules. If one fails, the answer is `422 CARD_INELIGIBLE` with the reason, and the flow stops here.' },
    { from: 'e', to: 'w', label: '202 PENDING', kind: 'reply', note: '`202 Accepted`: the request is accepted but not finished. The card shows **PENDING** straight away, because the bank does not wait for the wallet company.' },
    { from: 'e', to: 'o', label: 'enrol this card (signed)', note: 'Wallet asks the wallet company to add the card. The request carries a signature, so the wallet company knows it really came from the bank.' },
    { from: 'o', to: 'e', label: 'callback: ENROLLED', note: 'A moment later the wallet company calls the bank back with the result. Wallet checks the signature, then marks the card **ENROLLED**.' },
    { from: 'e', to: 'c', label: 'event: card enrolled', kind: 'event', note: 'Wallet announces the change on the message bus. Cards listens, so it knows this card may now be used for wallet purchases.' },
    { from: 'w', to: 'e', label: 'status? (every 2 s)', note: 'Meanwhile the wallet screen asks for the card’s status every two seconds.' },
    { from: 'e', to: 'w', label: 'ENROLLED', kind: 'reply', note: 'The answer is now ENROLLED, and the badge on the screen changes from PENDING to ENROLLED.' },
  ],
  caption: 'Green is CardVault Bank, the dashed box is the outside wallet company, and gold is an event on the message bus.',
})}

${keyIdea('<p>This flow is <strong>asynchronous</strong>: the first answer (PENDING) is not the final answer (ENROLLED). The final result arrives later, through a callback from another company.</p>')}

${shot({ src: 'wallet-pending.png', alt: 'The Checkout wallet screen: card 4417 is ENROLLED, card 2045 is PENDING, cards 7380 and 5521 are NOT ADDED with the reason Not recently used.', caption: 'Between steps 4 and 9: card 2045 has been added and shows PENDING until the wallet company confirms.' })}

<h2>See it on the live app</h2>
<p>alice’s debit card 2045 is already in the wallet, so the panel first takes it out and then adds it back. That runs the whole flow above. Send the requests in order.</p>
${tryIt({ title: 'Try it: remove a card, add it back, watch it change', requests: [
  { label: 'Sign alice in', method: 'POST', service: 'auth', path: '/v1/auth/login', body: { username: 'alice', password: 'CardVault-Demo-1' } },
  { label: 'Her wallet', note: 'Each card has `eligible`, an `ineligible_reason` when it may not join, and an `enrollment` with its status (or `null` if it was never added).', method: 'GET', service: 'wallet', path: '/v1/wallet', headers: { Authorization: 'Bearer {{token}}' } },
  { label: 'Remove card 2045', note: 'Expect `200`, status `REMOVED` at once, and `ineligible_reason: CARD_REMOVED_BY_CUSTOMER`, so the bank never adds it back on its own.', method: 'DELETE', service: 'wallet', path: '/v1/wallet/cards/ca4d0000-a11c-4000-8000-000000000002', headers: { Authorization: 'Bearer {{token}}' } },
  { label: 'Add it back', note: 'Expect `202` and status `PENDING`. The bank has asked the wallet company and not heard back yet.', method: 'POST', service: 'wallet', path: '/v1/wallet/cards/ca4d0000-a11c-4000-8000-000000000002', headers: { Authorization: 'Bearer {{token}}' }, body: { terms_version: '2026-01' } },
  { label: 'Ask again after two seconds', note: 'Now `ENROLLED`: the wallet company’s callback arrived. If it still says `PENDING`, wait a moment and send again. That is polling, by hand.', method: 'GET', service: 'wallet', path: '/v1/wallet/cards/ca4d0000-a11c-4000-8000-000000000002', headers: { Authorization: 'Bearer {{token}}' } },
  { label: 'Try to add the prepaid card 5521', note: 'Expect `422` with `CARD_INELIGIBLE` and `details.reason: PRODUCT_NOT_SUPPORTED`. It fails the third rule in the table above.', method: 'POST', service: 'wallet', path: '/v1/wallet/cards/ca4d0000-a11c-4000-8000-000000000004', headers: { Authorization: 'Bearer {{token}}' }, body: { terms_version: '2026-01' } },
] })}

<h2>The life of a card in the wallet</h2>
<p>After that first add, a wallet card moves between a few statuses:</p>
${table(['Status', 'What it means', 'Typical cause'], [
  ['PENDING', 'Waiting for the wallet company to confirm.', 'The customer just added it.'],
  ['ENROLLED', 'In the wallet and usable at checkout.', 'The wallet company confirmed.'],
  ['SUSPENDED', 'Paused: still in the wallet, but cannot pay.', 'The card was reported lost.'],
  ['REMOVED', 'Taken out of the wallet.', 'The customer removed it or opted out, the card was closed, or it stopped being eligible.'],
  ['FAILED', 'The wallet company could not add it.', 'The wallet company refused or did not answer.'],
])}
<p>Changes on other screens move these statuses too. Report a card lost and Cards announces it; Wallet then pauses the card. Reissue it and the card comes back. Change your email and it is no longer verified, so the cards leave the wallet.</p>

${testerEye(`<p>Asynchronous flows need a different kind of test:</p>
<ul>
<li>Check the first answer (<code>202</code> and <code>PENDING</code>), then <strong>wait</strong> for the final status, with a time limit. Never check once and fail, and never sleep for a fixed time.</li>
<li>Test each eligibility rule with a card that breaks exactly that rule, and one card that passes all of them.</li>
<li>Ask what happens if the wallet company never calls back, calls back twice, or says no. In test environments the simulator can be told to do each of these.</li>
</ul>`)}

${interview({
  say: `<p>“The core flow is adding a card to the wallet. The enrolment service first checks eligibility: active, not expired, credit or debit, used in the last 90 days, not opted out, and verified email and phone. If it passes, the service records the card as PENDING, returns 202, and sends a signed request to the external wallet operator.</p>
<p>The operator confirms later with a signed callback, the card becomes ENROLLED, and an event tells the card service the card can now be used for wallet payments. The UI polls until the status changes. Because it is asynchronous, our tests check the 202 and then wait for ENROLLED with a timeout.”</p>`,
  qa: [
    ['Why return 202 instead of waiting for the wallet company?', '<p>The wallet company can be slow or temporarily down. If the bank waited, the customer’s request would hang or fail for a reason outside the bank’s control. Returning 202 and finishing later keeps the app responsive, and the bank can retry the request in the background.</p>'],
    ['How do you test a flow that finishes later?', '<p>Poll: ask for the status repeatedly, with a short pause, until it reaches the expected value or a timeout is reached. A fixed sleep is either too short (flaky) or too long (slow).</p>'],
    ['Which eligibility tests would you write?', '<p>One test per rule, each with a card that fails only that rule, plus a card that passes everything. Then boundaries: a card used 89 days ago may join, one used 91 days ago may not. These fit well into one parametrized test.</p>'],
  ],
})}
`,
};
