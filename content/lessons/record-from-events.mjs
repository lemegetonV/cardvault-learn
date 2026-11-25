import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table } from '../../src/components.mjs';
import { foldEvents } from '../diagrams/history.mjs';

export default {
  minutes: 10,
  lede: 'When alice opens her wallet history, she sees a list of purchases: where, how much, and whether each one went through, was refunded or is still pending. No single service ever wrote that list. The wallet-txn service builds it, one event at a time, from what the card service announces.',
  youWill: 'You will see how one transaction record is built from two topics, why the order of events does not matter, and how its status is worked out.',
  body: `
<h2>A record nobody writes directly</h2>
<p>The card service decides authorizations and applies clearing, as you saw in <a href="/learn/authorization/">Deciding an authorization</a> and <a href="/learn/holds-and-clearing/">Holds and clearing</a>. It publishes each outcome: <code>auth.decided</code> for every decision and <code>txn.cleared</code> for every clearing record. The <strong>wallet-txn service</strong> reads both topics and turns them into a customer-friendly history, one row per purchase.</p>
${figure({ svg: foldEvents() })}
<p>This is called a <strong>read model</strong>: data shaped for reading, rebuilt from events, owned by a service that never makes the business decisions itself. It keeps the card service simple, and the history can be rebuilt or changed without touching how money is handled.</p>
<p>Only wallet purchases are kept. Each event carries a <code>token_requestor</code>; a purchase made with the plain card (<code>CARD</code>) is ignored, because this is the <em>wallet’s</em> history.</p>

<h2>Order does not matter</h2>
<p><code>auth.decided</code> and <code>txn.cleared</code> are both keyed by <code>card_id</code>, but they are different topics, and <a href="/learn/why-events/">order is only kept within a partition of one topic</a>. So a settlement can arrive before the authorization it settles. The network mock’s <code>clearing_before_auth_event</code> control makes this happen on purpose.</p>
<p>The service copes by matching both events on <code>trace_id</code>. Whichever arrives first creates the row; the other fills in its part.</p>
${table(['Arrives first', 'The row then has', 'When the other arrives'], [
  ['`auth.decided`', 'merchant, amount, decision; nothing cleared yet', 'The clearing amounts are added'],
  ['`txn.cleared`', 'clearing amounts, but no merchant or amount yet', 'The merchant, amount and decision are filled in, and the purchase time is corrected'],
])}
${keyIdea(`<p>Build the record so that the end state is the same whatever order the events arrive in. Store the facts each event brings, and work out everything else from those facts, rather than reacting to “what happened last”.</p>`)}

<h2>Status is worked out, not stored as an event</h2>
<p>No event says “this purchase is now partially refunded”. Instead, after every event, the service works the status out from the amounts it holds. Because it is recomputed from the facts each time, it cannot drift out of step with them.</p>
${table(['Status', 'When'], [
  ['`DECLINED`', 'The decision was a decline'],
  ['`REVERSED`', 'Not settled, and the reversed amount covers the whole authorization'],
  ['`PARTIALLY_REVERSED`', 'Not settled, and part of it was reversed'],
  ['`REFUNDED`', 'Settled, and the whole settled amount was refunded'],
  ['`PARTIALLY_REFUNDED`', 'Settled, and part of it was refunded'],
  ['`SETTLED`', 'Settled, nothing refunded'],
  ['`AUTHORIZED`', 'Approved, nothing cleared yet'],
])}
<p>The rules are checked in that order, top to bottom. A purchase that was partly reversed and then settled for the rest is SETTLED, because reversals only count before settlement.</p>
<p>Because the wallet-txn service only reads events, its history is <a href="/learn/why-events/">eventually consistent</a>: a purchase appears a moment after the card service decided it. Each event is applied once, however many times it is delivered, by the <a href="/learn/consumers-and-dead-letters/">event_id check</a> you met in Module 5.</p>

<h2>What the seed gives you</h2>
<p>alice starts with 55 wallet transactions: 46 on her credit card and 9 on her debit card, covering every status, and one with an open dispute. bob has 3, which is enough to check that alice can never see them. A few of alice’s merchants have deliberately awkward names, such as one that looks like HTML with a script tag and one that starts with <code>=</code> like a spreadsheet formula. <code>merchant_name</code> is free text from the merchant and is stored exactly as sent. Making it safe is the job of whatever displays it, as the next lesson and <a href="/learn/browser-security/">Browser security</a> show.</p>
${testerEye(`<p>Test each status by driving real purchases and clearing through the network mock, then reading the history with a bounded wait. Test order independence twice: once in the normal order, once with <code>clearing_before_auth_event</code>, and assert the two rows end identical. Then check what should <em>not</em> appear: a purchase made with the plain card must never show up in the wallet history.</p>`)}
${realWorld(`<p>Banks build many read models from the same events: the statement, the mobile app’s list, fraud features, accounting. Each can be rebuilt from the event history if its logic changes. CardVault has one, which is enough to see the pattern and its main risk, events arriving in an unexpected order.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Read model', 'Data shaped for reading, built from events by a service that does not make the decisions.'],
  ['`trace_id`', 'The network’s ID for one purchase, shared by its authorization and every clearing record.'],
  ['Derived status', 'A status worked out from stored amounts after every event, never set directly.'],
  ['`token_requestor`', 'Who made the purchase: `WALLET` (with a token) or `CARD` (with the card itself).'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A `txn.cleared` SETTLE arrives for a trace_id that wallet-txn has never seen. What happens?',
  options: ['It is dropped, because there is no authorization', 'A row is created with the settled amount, and filled in when auth.decided arrives', 'It goes to the DLQ', 'It waits in Redpanda until auth.decided arrives'],
  answer: 1,
  why: '<p>Whichever event comes first creates the row. The authorization later adds the merchant, amount and decision, and the status is recomputed.</p>',
})}
${check({
  q: 'A purchase of 5000 was approved, 1000 was reversed, and the rest settled at 4000. What status does the history show?',
  options: ['PARTIALLY_REVERSED', 'SETTLED: reversals only count before settlement', 'REVERSED', 'AUTHORIZED'],
  answer: 1,
  why: '<p>Once settled, the purchase is SETTLED unless something was refunded. The earlier partial reversal no longer decides the status.</p>',
})}
${check({
  q: 'alice pays in a shop by tapping her physical card, not her phone. Does the purchase appear in her wallet history?',
  options: ['Yes, all purchases do', 'No: only wallet purchases (`token_requestor` WALLET) are recorded', 'Only after settlement', 'Only if she has the wallet enabled'],
  answer: 1,
  why: '<p>The wallet-txn service ignores events whose <code>token_requestor</code> is <code>CARD</code>. This history is for the wallet only.</p>',
})}

<h2>Recap</h2>
${recap([
  'wallet-txn builds a read model from `auth.decided` and `txn.cleared`.',
  'One row per `trace_id`; wallet purchases only.',
  'Either event may arrive first; the row ends the same.',
  'Status is recomputed from the amounts after every event.',
  'The seed has 55 transactions for alice, including awkward merchant names, and 3 for bob.',
])}
`,
};
