import { shot, interview, table, testerEye } from '../../src/components.mjs';

export default {
  minutes: 8,
  lede: 'Before you test an app, use it. This page walks through every screen of the CardVault web app as alice, the main demo customer, and says what each one lets her do.',
  youWill: 'You will know every screen well enough to describe it, and to picture the tests each one needs.',
  body: `
<h2>Signing in</h2>
<p>Everything starts at the sign-in page: a username, a password and a <strong>Sign in</strong> button. Wrong details show an error message. After too many wrong attempts the account is locked for a while, which protects customers from someone guessing their password.</p>
${shot({ src: 'login.png', alt: 'The CardVault sign-in page with username and password fields.', caption: 'Try it yourself with <code>alice</code> and <code>CardVault-Demo-1</code>.' })}
<p>Once signed in, a menu at the top leads to the four main screens: <strong>Wallet</strong>, <strong>Transactions</strong>, <strong>Cards</strong> and <strong>Profile</strong>, plus <strong>Sign out</strong>.</p>

<h2>Cards</h2>
${shot({ src: 'cards.png', alt: 'The Cards screen listing alice’s cards with expiry, available amount, limit and last used date.', caption: 'Each card shows its type, the last four digits, its status, and three actions.' })}
<p>Each card shows its type (credit, debit or prepaid), the last four digits of the number, its status, expiry date, limit, the amount still <strong>available</strong> to spend, and when it was last used. Three buttons change the card:</p>
<ul>
<li><strong>Report lost</strong> marks the card as lost. If it was in the wallet, its place there is paused, so nobody can pay with it.</li>
<li><strong>Reissue</strong> replaces the card with a new number and expiry date, and makes it active again.</li>
<li><strong>Close card</strong> closes it for good.</li>
</ul>

<h2>Checkout wallet</h2>
${shot({ src: 'wallet.png', alt: 'The Checkout wallet screen: two cards enrolled, two cards not added with a reason.', caption: 'Two of alice’s cards are in the wallet. The other two may not join, and each says why.' })}
<p>The wallet screen lists every card with its wallet status. <strong>ENROLLED</strong> means the card is in the wallet and can be used at checkout. A card that is not in the wallet either has an <strong>Add to wallet</strong> button or a reason why it may not join. Here, one card has not been used recently and the other is prepaid, which the wallet does not accept.</p>
<p>Adding a card opens a short confirmation where the customer accepts the wallet company’s terms. The card then shows <strong>PENDING</strong> until the wallet company confirms, which usually takes a moment. The customer can also remove a card, or opt out of the wallet completely, which takes all their cards out of it.</p>

<h2>Transactions</h2>
${shot({ src: 'transactions.png', alt: 'The Wallet transactions screen with card, status and date filters and a list of purchases.', caption: 'The list filtered to one card. Each purchase shows the shop, date, card, amount and status.' })}
<p>This screen lists every purchase made with a wallet card, newest first. Filters narrow it down by card, status and date range, and <strong>Export CSV</strong> downloads the same list as a spreadsheet file.</p>
<p>The status badge tells the story of each purchase. These are the ones you will meet most:</p>
${table(['Status', 'What it means'], [
  ['AUTHORIZED', 'The bank approved it and is holding the money, but the shop has not been paid yet.'],
  ['SETTLED', 'The final amount has been charged.'],
  ['DECLINED', 'The bank refused it, for example because there was not enough available.'],
  ['REVERSED', 'The shop cancelled it before it was settled, so the held money came back.'],
  ['REFUNDED', 'Charged first, then given back. **PARTIALLY_** in front means only part of it.'],
])}

<h2>A transaction and its dispute</h2>
${shot({ src: 'dispute.png', alt: 'A transaction detail page for Fabrikam Fuel with the dispute form open below it.', caption: 'The detail page with the dispute form open.' })}
<p>Clicking a purchase opens its detail page: the amounts (authorised, settled, reversed, refunded), the dates and a reference. If the customer does not recognise a charge, <strong>Dispute</strong> opens a form with a reason, an optional note and an optional receipt upload. After sending it, the purchase shows a <strong>DISPUTE OPEN</strong> badge. A purchase can only have one open dispute at a time, and a declined purchase cannot be disputed at all.</p>

<h2>Profile</h2>
${shot({ src: 'profile.png', alt: 'The Profile screen with email and phone fields, both marked verified.', caption: 'Both of alice’s contact details are verified.' })}
<p>The profile holds the customer’s email and phone number, each with a <strong>VERIFIED</strong> badge or a way to verify it with a one-time code. This screen looks small, but it matters: an unverified email or phone stops every card from joining the wallet. Changing a contact detail makes it unverified again, and the customer’s cards leave the wallet until it is verified.</p>

${testerEye('<p>Notice how the screens depend on each other. A change on Profile affects Wallet. Reporting a card lost on Cards affects Wallet too. These links between features are where bugs like to hide, so they make good test ideas.</p>')}

${interview({
  say: `<p>“The web app has four main areas. <strong>Cards</strong> shows each card with its balance and lets the customer report it lost, reissue or close it. <strong>Wallet</strong> shows which cards are in the checkout wallet, lets them add or remove cards, and explains why a card is not eligible. <strong>Transactions</strong> lists wallet purchases with filters, a CSV export, a detail page and disputes. <strong>Profile</strong> holds the email and phone, which must be verified before cards can join the wallet.”</p>`,
  qa: [
    ['Which screen would you test first, and why?', '<p>Sign-in, because every other screen depends on it. After that, the wallet, because it is the core business feature and depends on several others: card status, card type, recent use and verified contact details.</p>'],
    ['Give an example of a test that crosses two screens.', '<p>Report a card lost on the Cards screen, then check that the same card’s place in the wallet is paused on the Wallet screen. Or change the phone number on Profile and check that the customer’s cards leave the wallet.</p>'],
    ['What would you check on the transactions list?', '<p>That each filter narrows the list correctly, that combining filters works, that the CSV export matches what the screen shows, and that each status badge matches the purchase’s amounts on its detail page.</p>'],
  ],
})}
`,
};
