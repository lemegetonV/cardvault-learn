import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { journeySteps } from '../diagrams/suite.mjs';

export default {
  minutes: 11,
  lede: 'Almost every test so far checks one rule in one place, starting from a fresh customer built for that rule. That makes failures easy to locate, but it never checks that the rules work together, in the order a real customer meets them. Journey tests do that. The suite has three, and they are deliberately few.',
  youWill: 'You will learn what a journey test adds to area tests, how its steps hand state to each other, how to read a failure in one, and why a suite should have only a handful.',
  body: `
<h2>Rules in isolation, and together</h2>
<p>The area tests each build exactly the situation they need: a card already enrolled, a purchase already approved. That shortcut is what makes them fast and precise. But it skips the hand-overs. In a real visit, the card is enrolled <em>by the customer</em>, the token reaches the card service <em>through an event</em>, the transaction appears <em>because</em> the clearing was published. If one of those hand-overs breaks, every area test can still pass.</p>
<p>A <strong>journey test</strong> follows one customer through a whole story, each step starting from what the step before left behind.</p>
${figure({ svg: journeySteps(), caption: 'The first journey. It crosses three bank services and the operator mock, and each step depends on the one before.' })}

<h2>A journey, step by step</h2>
${code({ title: 'tests/api/tests/journeys/test_customer_journeys.py (part)', src: `
def test_add_a_card_pay_with_it_and_dispute_the_charge(make_customer, card_network, enrolments):
    someone = make_customer(customer(card(limit=50_000)))
    card_id = someone.card_ids[0]

    # 1. Add the card to the wallet; the operator confirms by callback.
    expect(someone.wallet.add(card_id), 202, WalletCard)
    wait_for_enrolment(someone, card_id, "ENROLLED")
    token_ref = enrolments.record(card_id)["token_ref"]

    # 2. Pay with the wallet token. card-service learns of the token from an event.
    auth = wait_until(
        lambda: expect(card_network.purchase(card_id, 12_345, token_ref), 200, Authorization),
        lambda a: a.decision == "APPROVED",
        timeout=10,
        what="the first wallet purchase to be approved",
    )
    assert expect(someone.cards.get(card_id), 200, Card).available == 50_000 - 12_345

    # 3. The merchant settles for less (a partial shipment); the difference comes back.
    expect(card_network.settle(auth.trace_id, 10_000), 200, Clearing)
    txn = wait_for_transaction(someone, auth.trace_id, lambda t: t.status == "SETTLED")
    assert (txn.amount, txn.cleared_amount) == (12_345, 10_000)
    assert expect(someone.cards.get(card_id), 200, Card).available == 50_000 - 10_000

    # 4. The customer disputes the charge; the transaction shows the open dispute.
    dispute = expect(someone.transactions.open_dispute(txn.txn_id, "WRONG_AMOUNT"), 201, Dispute)
    assert wait_for_transaction(someone, auth.trace_id).open_dispute_id == dispute.dispute_id
` })}
<p>The card starts <em>not</em> enrolled, so the token in step 2 is one the flow itself produced. The numbered comments make the story readable, and every step ends with a check, so a failure says which step broke. Nothing here is new: <a href="/learn/suite-waiting/">waits</a> for the later work, <a href="/learn/suite-money-maths/">hand-worked</a> balances from a chosen limit, the transaction history from <a href="/learn/suite-reading-events/">events</a>. What is new is that the state flows from one step to the next.</p>
<p>The other two journeys follow the same pattern. One loses a card and gets a new one: the token is suspended at once, resumes after the reissue carrying the new last four digits, and pays again. The other leaves the wallet and comes back: opting out stops every token, opting in enrols both cards again with new tokens.</p>

<h2>Reading a journey failure</h2>
<p>When a journey fails, compare it with the area tests. If an area test for the same rule fails too, the fault is in that rule, and the area test is the better place to study it. If only the journey fails, the fault is in a hand-over: an event not published, a projection not updated, a status not passed on. The file’s docstring says exactly this, because it is the main reason the journeys exist.</p>
${keyIdea(`<p>Area tests check each rule from a prepared state; journeys check that the rules hand over to each other in a real order. A failure only in a journey points at the hand-over between services.</p>`)}

<h2>Why only three</h2>
<p>Journeys are slow, because they wait for every asynchronous step in turn, and broad, because one failure anywhere fails the whole story. A suite made mostly of journeys would be slow and hard to diagnose. So they are kept to the stories that matter most to a customer, and everything they touch is also covered by precise area tests.</p>
${testerEye(`<p>Choose journeys from what customers actually do most, and from the places where the most services hand over to each other. Leave edge cases to area tests, where a failure names its rule.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Journey test', 'A test that follows one customer through a whole story across services, each step using the state left by the last.'],
  ['Area test', 'A test of one rule in one area, starting from a state prepared for that rule.'],
  ['Hand-over', 'The point where one service’s result becomes another’s input, often through an event.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'Every area test passes, but the “add a card, pay and dispute” journey fails at step 2: the purchase with the new token is never approved. Where would you look first?',
  options: ['The authorization rules', 'The hand-over that tells the card service about the new token, the enrollment.changed event', 'The dispute code', 'The test data'],
  answer: 1,
  why: '<p>The area tests show the authorization rules work when a token is already known. Only the journey depends on the token arriving through an event, so that hand-over is the likely cause.</p>',
})}
${check({
  q: 'Why does the journey create a card that is not yet enrolled, instead of `card(enrolled=True)`?',
  options: ['Enrolled cards are slower to create', 'So the token comes from the real enrolment flow, which is part of what the journey tests', 'Enrolled cards cannot be disputed', 'There is no reason'],
  answer: 1,
  why: '<p>A prepared enrolment would skip the flow the journey exists to check. Area tests use the shortcut; the journey deliberately does not.</p>',
})}

<h2>Recap</h2>
${recap([
  'Journeys follow one customer through a whole story, each step using the last one’s state.',
  'They catch broken hand-overs that area tests, starting from prepared states, cannot.',
  'A failure only in a journey points at a hand-over between services.',
  'Keep journeys few; leave edge cases to area tests.',
])}
`,
};
