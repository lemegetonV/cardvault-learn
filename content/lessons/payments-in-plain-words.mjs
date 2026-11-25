import { figure, keyIdea, testerEye, realWorld, terms, check, recap, sequence } from '../../src/components.mjs';
import { balance } from '../diagrams/basics.mjs';

const purchase = sequence({
  id: 'seq-purchase',
  label: 'One wallet purchase from tap to settlement',
  actors: [
    { id: 'alice', label: 'alice', kind: 'plain' },
    { id: 'shop', label: 'Shop', kind: 'mock' },
    { id: 'net', label: 'Card network', kind: 'mock' },
    { id: 'bank', label: 'Bank', kind: 'bank' },
  ],
  steps: [
    { from: 'alice', to: 'shop', label: 'Pay with wallet', note: 'alice taps **Pay**. Her wallet hands the shop a **token** that stands for her card. The shop never sees her real card number.' },
    { from: 'shop', to: 'net', label: 'charge token, $250', note: 'The shop passes the token and the amount to the card network.' },
    { from: 'net', to: 'bank', label: 'approve $250?', note: 'The network works out which bank issued the card and asks it to decide. This request is called an **authorization**.' },
    { from: 'bank', to: 'bank', label: 'check card, token, balance', note: 'The bank checks that the card is active, that the token belongs to this card and is still active in the wallet, and that there is enough money available.' },
    { from: 'bank', to: 'net', label: 'approved', kind: 'reply', note: 'The bank says yes and puts $250 **on hold**. The money has not moved yet, but alice can no longer spend it.' },
    { from: 'net', to: 'shop', label: 'approved', kind: 'reply', note: 'The shop shows “order confirmed”. For alice the purchase is over.' },
    { from: 'shop', to: 'net', label: 'settle $250', note: 'Later, often when the goods ship, the shop asks for the money for real. This second stage is called **clearing**.' },
    { from: 'net', to: 'bank', label: 'clearing: settle', note: 'The network sends the bank a clearing record. Other clearing records can **reverse** a hold or **refund** a settled charge instead.' },
    { from: 'bank', to: 'bank', label: 'hold becomes a charge', note: 'The bank turns the hold into a final charge. alice’s available balance does not change again, because the money was already set aside at step 5.' },
  ],
  caption: 'Press Start and step through. Solid arrows are requests, slate dashed arrows are responses. In CardVault the network mock plays both the shop and the card network.',
});

export default {
  minutes: 11,
  lede: 'Card payments use a handful of words that sound alike but mean different things: authorization, hold, clearing, settlement. This lesson follows one purchase from start to finish so each word has a picture attached.',
  youWill: 'You will learn the payment and wallet words every later lesson uses.',
  body: `
<h2>The card and its number</h2>
<p>A payment card has a long number printed on it, usually 16 digits. Its official name is the <strong>PAN</strong>, short for primary account number. Anyone who has the PAN and the expiry date can try to pay with the card, so banks guard it closely.</p>
<p>CardVault never shows a PAN to anyone. Its APIs and screens use only the <strong>last four digits</strong> and the expiry month, such as “ending 4417, expires 06/2029”. The full number exists in one place only, encrypted, inside the card service.</p>
<p>Cards also come in kinds, called <strong>products</strong>. CardVault has three:</p>
<ul>
<li><strong>Credit</strong>: the bank lends the money up to a limit, and the customer pays it back later.</li>
<li><strong>Debit</strong>: the money comes from the customer’s own account.</li>
<li><strong>Prepaid</strong>: the money was loaded onto the card in advance.</li>
</ul>
<p>Only credit and debit cards may join CardVault’s wallet. That is a CardVault rule, not a law of nature, and it is why alice’s prepaid card is not in her wallet.</p>

<h2>What a wallet adds</h2>
<p>A digital wallet lets you pay without typing your card number. To make that safe, the wallet does not store the PAN. It stores a <strong>token</strong>: a stand-in value that the card network knows how to map back to the real card. In CardVault a token looks like <code>tok_a11ce0c4ed170000000001</code>.</p>
<p>A token is useful because it can be switched off without touching the card. If alice loses her phone, the bank can pause the token in the wallet while her plastic card keeps working.</p>
<p>Putting a card into the wallet is called <strong>enrolment</strong>. It takes three steps:</p>
<ol>
<li>The bank checks that the card is <strong>eligible</strong>: active, the right product, used recently, and owned by a customer with a verified email and phone.</li>
<li>The bank asks the wallet operator to add the card.</li>
<li>The operator issues a token and confirms, a couple of seconds later, with a message back to the bank.</li>
</ol>
<p>The full eligibility rules and the enrolment flow have their own lessons later in the course.</p>

<h2>One purchase, step by step</h2>
<p>Now alice spends $250 on headphones with her wallet. Follow the messages one at a time.</p>
${purchase}
${keyIdea(`<p>A card payment happens in <strong>two stages</strong>. First the <strong>authorization</strong>: the bank decides and puts the money on hold, in a fraction of a second. Then <strong>clearing</strong>: later, the shop settles the charge, or releases it, or refunds it. Many payment bugs hide in the gap between the two.</p>`)}

<h2>What happens to the money</h2>
<p>The number a customer cares about is the <strong>available balance</strong>: how much they can still spend. Here is alice’s card through the purchase, starting from an example balance of $1,000.</p>
${figure({ svg: balance(), caption: 'The available balance drops at approval, not at settlement. Settling only changes what kind of money the $250 is: from held to charged.' })}
<p>Two other endings are possible. If the shop cancels the order before settling, it sends a <strong>reverse</strong>, and the hold is released so the $250 is available again. If the shop has already settled and then takes the headphones back, it sends a <strong>refund</strong>, and the money returns as in the last column above.</p>

${testerEye(`<p>Each stage is a place to check. After an approval, is the available balance lower by exactly the amount? After a settle, did it stay the same? After a reverse, is the hold gone? A test that only checks “the purchase was approved” misses most of what can go wrong.</p>`)}

<h2>When things go wrong, or need checking</h2>
<p>Two more words complete the picture.</p>
<ul>
<li>A <strong>dispute</strong> is the customer saying “this charge is wrong”. In CardVault a customer can dispute a wallet purchase from the transaction screen and attach a receipt.</li>
<li><strong>Reconciliation</strong> is comparing two records that should agree. Every day the wallet operator publishes a file listing the cards it holds, and the bank compares it with its own records to catch any differences.</li>
</ul>

${realWorld(`<p>Real authorizations carry many more checks: fraud scoring, merchant categories, currency conversion, and holds that expire after some days if the shop never settles. CardVault keeps the core of the flow and leaves those out. For example, its holds never expire.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['PAN', 'The full card number. CardVault keeps it encrypted in one service and only ever shows the last four digits.'],
  ['Card product', 'The kind of card: credit, debit or prepaid.'],
  ['Wallet token', 'A stand-in for the card number that the wallet stores, such as `tok_a11ce0…`. It can be paused or removed without affecting the card.'],
  ['Enrolment', 'Adding a card to the wallet: check eligibility, ask the operator, get confirmation.'],
  ['Authorization', 'The network asking the bank to approve a purchase, and the bank’s yes or no.'],
  ['Hold', 'Money set aside by an approved authorization. It lowers the available balance until it is settled or released.'],
  ['Available balance', 'How much the customer can still spend on the card right now.'],
  ['Clearing', 'The later stage that settles, reverses or refunds an authorization.'],
  ['Dispute', 'A customer’s claim that a charge is wrong.'],
  ['Reconciliation', 'Comparing two records that should agree, and listing the differences.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A card has $1,000 available. A $250 wallet purchase is approved, then settled for $250. What is the available balance after the settle?',
  options: ['$1,000', '$750', '$500', 'It depends on how long the settle took'],
  answer: 1,
  why: '<p>The $250 left the available balance at approval, when it went on hold. Settling turns that hold into a charge without taking the money a second time, so the balance stays at $750. $500 is what you get if you subtract the amount twice, which is a classic bug.</p>',
})}
${check({
  q: 'A shop cancels an order before it settles. Which clearing record does it send?',
  options: ['Refund', 'Reverse', 'Settle', 'Dispute'],
  answer: 1,
  why: '<p>A reverse releases a hold that has not been settled. A refund is for money that was already settled. A dispute comes from the customer, not the shop.</p>',
})}
${check({
  q: 'Why does the wallet store a token instead of the card number?',
  options: ['Tokens are shorter to type', 'So the wallet can be paused without touching the card, and the real number is never handed to shops', 'Because card numbers change every month', 'So the bank does not need to check anything'],
  answer: 1,
  why: '<p>The token keeps the PAN away from shops and wallets, and it can be suspended or removed on its own. The card number itself stays the same until the card is reissued.</p>',
})}

<h2>Recap</h2>
${recap([
  'The PAN is the full card number. CardVault shows only the last four digits.',
  'A wallet stores a token, not the PAN. Adding a card to the wallet is called enrolment.',
  'A payment has two stages: authorization (decide and hold) and clearing (settle, reverse or refund).',
  'The available balance drops at approval. Settling does not lower it again.',
  'A dispute is the customer objecting to a charge. Reconciliation compares two records that should agree.',
])}
`,
};
