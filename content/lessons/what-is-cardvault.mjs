import { figure, interview, keyIdea, table } from '../../src/components.mjs';
import { business } from '../diagrams/app.mjs';

export default {
  minutes: 6,
  lede: 'CardVault is the online banking app of a made-up bank, CardVault Bank. Customers use it to look after their cards, keep cards in a checkout wallet for paying online, and check what they spent.',
  youWill: 'You will be able to describe the product and its four main features in two minutes.',
  body: `
<h2>The product in one paragraph</h2>
<p>Think of the app your own bank gives you for your cards. You sign in, you see each card with its balance, and you can report one lost. CardVault does that, and adds one more thing: a <strong>checkout wallet</strong>. A checkout wallet keeps your cards ready at online checkouts, so you pay with one tap instead of typing a card number. CardVault Bank decides which of its cards may go into that wallet, and it approves or declines every purchase made with them.</p>

<h2>What a customer can do</h2>
<div class="features">
<div class="feature"><h3>Cards</h3><p>See every card, what is available to spend, and report a card lost, reissue it or close it.</p></div>
<div class="feature"><h3>Checkout wallet</h3><p>Add a card to the wallet, remove it, or opt out of the wallet completely. Cards that may not join say why.</p></div>
<div class="feature"><h3>Transactions</h3><p>A list of wallet purchases with filters, a detail page for each one, a CSV export, and a way to dispute a charge.</p></div>
<div class="feature"><h3>Profile</h3><p>Email and phone number, each of which must be verified before cards can join the wallet.</p></div>
</div>
<p>You will see each of these screens in <a href="/learn/screen-tour/">A tour of the screens</a>.</p>

<h2>Who is involved</h2>
${figure({ svg: business(), caption: 'CardVault Bank sits in the middle and is what you test. The wallet company and the card network are other companies the bank works with.' })}
<p>A bank never works alone, and two outside companies matter here.</p>
<ul>
<li><strong>The wallet company</strong> runs the checkout wallet itself. When a customer adds a card, the bank asks the wallet company to put it in, and the wallet company confirms a little later.</li>
<li><strong>The card network</strong> sits between shops and banks. When the customer pays at a shop, the network asks the bank whether to approve the purchase. Days later it tells the bank the final amount, which is called <strong>settling</strong> the purchase.</li>
</ul>
<p>In our test environment both companies are <strong>simulators</strong>: small programs that act like the real companies. That is normal in real projects too, because you cannot run tests against another company’s live system.</p>

${keyIdea('<p>Only the bank is the system under test. When a test finds a problem, it is a problem in CardVault Bank, not in the simulators around it.</p>')}

<h2>The demo customers</h2>
<p>The app comes with four demo customers. They all share the password <code>CardVault-Demo-1</code>, and each one shows a different situation, which makes them useful starting points for tests.</p>
${table(['Customer', 'What is special about them'], [
  ['alice', 'The main demo account: four cards, two of them in the wallet, and a long list of purchases.'],
  ['bob', 'One card in the wallet and one card reported lost.'],
  ['charlie', 'Has opted out of the wallet.'],
  ['dana', 'Has not verified her phone number, so her cards may not join the wallet.'],
])}

<h2>Where it runs</h2>
<p>CardVault runs in two places. A <strong>stage</strong> copy runs on a server on the internet: it is the one behind every Try it panel and Run button on this site, and you can open its screens in your browser. You can also run your own copy in Docker on your computer. Both run the same code with the same demo customers. <a href="/learn/environments/">Where it runs</a> lists the stage pages and shows how to start your own copy.</p>

${interview({
  say: `<p>“The app I tested is the card and wallet app of a bank. Customers sign in, see their cards and balances, add cards to a checkout wallet for one-tap online payments, and review or dispute their wallet transactions.</p>
<p>Behind the screens the bank works with two outside companies: the wallet company that runs the wallet, and the card network that sends purchases to the bank for approval. In test environments those two are simulated, so we can control what they send back.”</p>`,
  qa: [
    ['What was the application you tested?', '<p>Use the spoken answer above. Lead with the business purpose (cards, wallet, transactions), then the main features, then who else is involved. Keep the technical parts for when they ask.</p>'],
    ['Why would a bank decide which cards can go in a wallet?', '<p>Risk. The bank only wants active, recently used credit and debit cards in the wallet, and only for customers whose email and phone are verified. A prepaid card, an expired card or an unverified customer is refused, and the app shows the reason.</p>'],
    ['How did you test against outside companies you do not control?', '<p>Through simulators of the wallet company and the card network. They behave like the real companies, and tests can tell them how to respond, for example slowly or with an error, to check that the bank copes.</p>'],
  ],
})}
`,
};
