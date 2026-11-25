import { figure, keyIdea, testerEye, terms, check, recap } from '../../src/components.mjs';
import { actors } from '../diagrams/basics.mjs';

export default {
  minutes: 8,
  lede: 'When you pay online with a digital wallet, a bank somewhere decides in a fraction of a second whether to let the payment through. CardVault is a pretend version of that bank, built so you can learn how it works and then test it.',
  youWill: 'You will meet the four parties in the story and the four seeded customers.',
  body: `
<h2>A payment you never see</h2>
<p>Picture alice, a customer of a bank. She is buying headphones on a shop’s website. At the checkout she picks her digital wallet, taps <strong>Pay</strong>, and a moment later the shop says the order is confirmed.</p>
<p>That tap starts a short conversation between several companies. The shop asks the card network to charge alice. The network asks alice’s bank whether the charge is allowed. The bank checks her card, says yes, and puts the money aside. Days later the charge is settled for good.</p>
<p>CardVault plays <strong>the bank’s side</strong> of that conversation. Everything the bank must get right lives inside it: who alice is, which cards she has, which of them may be used in the wallet, and whether a purchase is approved.</p>

<h2>The story in one picture</h2>
${figure({ svg: actors(), caption: 'Four parties. The bank in the middle is CardVault itself. The wallet operator and the card network are outside companies, played here by mocks.' })}
<p>Read the picture from left to right.</p>
<ul>
<li><strong>The customer</strong> uses the bank’s web app to see cards, manage the wallet and check purchases.</li>
<li><strong>CardVault Bank</strong> is a set of small services that work together: one for logins, one for cards, one for the wallet, and so on. You will meet each one in <a href="/learn/the-system-map/">The system map</a>.</li>
<li><strong>The wallet operator</strong> is the company that runs the digital wallet. The bank asks it to add, pause or remove cards, and it confirms each change a little later.</li>
<li><strong>The card network</strong> carries purchases from shops to banks. When alice pays, the network asks the bank: approve this, or not?</li>
</ul>

${keyIdea(`<p>Only the bank is <strong>under test</strong>. The wallet operator and the card network are <strong>mocks</strong>: simple stand-ins that behave like the real companies and that tests can control. A test can tell the operator mock to answer slowly, answer twice, or not answer at all, and then check that the bank copes.</p>`)}

<h2>Why build a pretend bank?</h2>
<p>To learn test automation you need something worth testing. A to-do app is too simple: it has no money, no outside partners and nothing that can go wrong between two systems. A real bank is impossible: you cannot reset it, move its clock or ask its partners to misbehave.</p>
<p>CardVault sits between the two. It is an <strong>application under test</strong>: an app that exists so tests can be written against it. That shapes how it is built.</p>
<ul>
<li><strong>It behaves like the real thing.</strong> Logins with tokens that expire, money that is held and settled, messages between services, signed calls to partners, and failures that need handling.</li>
<li><strong>It can be controlled.</strong> Tests can reset it to a known state, move its clock forward, and switch on faults such as a slow response.</li>
<li><strong>It starts the same every time.</strong> The same customers, cards and purchases are loaded on every reset, so a test knows exactly what to expect.</li>
<li><strong>Everything is fictional.</strong> The bank, the operator, the network, the people and the card numbers are all made up.</li>
</ul>

<h2>Meet the customers</h2>
<p>Every reset loads the same four customers. Each one is set up to show a different situation, so you can reach it without building it yourself first.</p>
${terms([
  ['alice', 'The busy one. Four cards: two in the wallet, one unused for 120 days, and one prepaid. About 55 wallet purchases in every possible state.'],
  ['bob', 'One card in the wallet, and one card reported lost, so its place in the wallet is paused.'],
  ['charlie', 'Has opted out of the wallet altogether, so his eligible card is not in it.'],
  ['dana', 'Has not verified her phone number, so none of her cards may join the wallet.'],
])}
${testerEye(`<p>When a later lesson describes a rule, ask which customer already shows it. “Unused for 120 days” is alice’s third card. “Phone not verified” is dana. The seed data is the starting point for most of your tests, so it pays to know it well.</p>`)}

<h2>Two places it runs</h2>
<p>You can run CardVault on your own computer, where it behaves exactly as designed. There is also a hosted copy on a stage server, which deliberately has some known bugs switched on, so you have real defects to find. <a href="/learn/running-cardvault/">Running CardVault yourself</a> covers both.</p>

<h2>Words from this lesson</h2>
${terms([
  ['Application under test', 'An app built or deployed so that tests can be written and run against it.'],
  ['Mock', 'A stand-in for an outside system. It behaves like the real one and can be told to misbehave.'],
  ['Wallet operator', 'The outside company that runs the digital wallet the bank’s cards join.'],
  ['Card network', 'The outside company that carries purchases from shops to the bank that issued the card.'],
  ['Seed data', 'The fixed customers, cards and purchases loaded every time CardVault is reset.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test wants to see what CardVault does when the wallet operator never confirms a change. Where does the test make that happen?',
  options: ['It changes CardVault’s code before the run', 'It tells the wallet operator mock to drop its confirmation', 'It waits until the real operator has an outage', 'It cannot be tested'],
  answer: 1,
  why: '<p>The operator is a mock, so tests can control it. Changing the code under test would mean you are no longer testing the real app, and waiting for a real outage is neither possible nor repeatable.</p>',
})}
${check({
  q: 'Which of these is under test: the bank’s services, the wallet operator, or the card network?',
  options: ['All three', 'Only the bank’s services', 'Only the wallet operator and the card network', 'Only the card network'],
  answer: 1,
  why: '<p>The bank is the system under test. The other two are mocks that play outside companies, so a bug in them would not be a bug in the product.</p>',
})}
${check({
  q: 'You need a customer whose cards cannot join the wallet because a contact detail is not verified. Who do you start from?',
  options: ['alice', 'bob', 'charlie', 'dana'],
  answer: 3,
  why: '<p>dana has not verified her phone number, which makes every one of her cards ineligible. charlie is also outside the wallet, but for a different reason: he opted out.</p>',
})}

<h2>Recap</h2>
${recap([
  'CardVault plays one bank’s side of a digital wallet: logins, cards, the wallet, purchase decisions.',
  'The wallet operator and the card network are mocks: outside companies that tests can control.',
  'It is an application under test: realistic, controllable and identical after every reset.',
  'Four seed customers each show a different situation: alice, bob, charlie and dana.',
])}
`,
};
