import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { usageBoundary } from '../diagrams/suite.mjs';

export default {
  minutes: 12,
  lede: 'Whether a card may join the wallet depends on eight rules, checked in a fixed order. Testing them brings together two ideas from earlier lessons: a table of cases, and moving the clock. It adds a third, the one testers use most for any rule with a number in it: test at the boundaries, where the answer changes.',
  youWill: 'You will learn how to split a rule’s inputs into groups with the same answer, where to put test values around a boundary, and how one boundary can be checked across two services at once.',
  body: `
<h2>Eight rules, one reason</h2>
<p>The first track’s <a href="/learn/eligibility/">Who may join the wallet</a> lesson listed the rules: the card must be active, not expired, not prepaid, used in the last 90 days; the customer must not have opted out or removed the card; email and phone must be verified. The wallet shows the <em>first</em> rule that fails as the card’s reason.</p>
<p>The suite tests this exactly as <a href="/learn/suite-tables-of-cases/">Tables of cases</a> tested the authorization decision: one row per rule, plus rows where two rules fail together, each building a fresh customer with exactly those conditions.</p>
${code({ title: 'tests/api/tests/eligibility/test_eligibility_rules.py (part, some rows left out)', src: `
RULES = [
    # id, customer template, expected reason (None = eligible)
    ("eligible", customer(card()), None),
    ("debit-eligible", customer(card("DEBIT")), None),
    ("lost", customer(card(status="LOST")), "CARD_NOT_ACTIVE"),
    ("prepaid", customer(card("PREPAID")), "PRODUCT_NOT_SUPPORTED"),
    ("used-91-days-ago", customer(card(used_days_ago=91)), "NOT_RECENTLY_USED"),
    ("never-used", customer(card(used_days_ago=None)), "NOT_RECENTLY_USED"),
    ("opted-out", customer(card(), opted_out=True), "CUSTOMER_OPTED_OUT"),
    # Several rules fail at once: the earliest one is the reason.
    ("expired-prepaid", customer(card("PREPAID", expiry=EXPIRED)), "CARD_EXPIRED"),
]


@pytest.mark.parametrize(("template", "reason"), [r[1:] for r in RULES], ids=[r[0] for r in RULES])
def test_eligibility_and_reason(make_customer, template, reason):
    someone = make_customer(template)

    view = wallet_card(someone, someone.card_ids[0])

    assert (view.eligible, view.ineligible_reason) == (reason is None, reason)
` })}
<p>The excerpt shows some of the rows; the file has 17. <code>None</code> is Python’s “no value”, used here for “eligible, so no reason”. The assertion compares both fields at once: <code>reason is None</code> is <code>True</code> exactly when the card should be eligible. Checking the pair means a card that is eligible but still shows a reason, or ineligible with none, fails too.</p>

<h2>Groups with the same answer</h2>
<p>A rule like “used within 90 days” has endless possible inputs: 1 day, 2 days, 47 days, 400 days. Testing them all is impossible and pointless, because most give the same answer as their neighbours. So testers split the inputs into <strong>partitions</strong>, groups where the rule should behave the same, and test one value from each:</p>
<ul>
<li>used recently (the default card, 5 days ago): eligible;</li>
<li>used too long ago (91 days): not recently used;</li>
<li>never used at all (<code>used_days_ago=None</code>): also not recently used.</li>
</ul>
<p>“Never used” is easy to forget because it is not a number of days at all. It is exactly the sort of case where code written as “days since last use &gt; 90” breaks, because there is no last use to subtract.</p>

<h2>Standing on the edge</h2>
<p>Partitions say what to test in the middle of each group. Bugs, though, cluster at the <strong>boundary</strong> between groups: a <code>&gt;</code> written where <code>&gt;=</code> was meant moves the edge by one unit and passes every test that stays away from it. <strong>Boundary value analysis</strong> puts test values just either side of each edge.</p>
${figure({ svg: usageBoundary(), caption: 'Ordinary values test each partition; the two points a minute either side of the edge test where it is.' })}
<p>For the 90-day rule the edge is a moment in time, so the boundary test moves the clock, as in <a href="/learn/suite-moving-time/">Moving the clock</a>: a card last used 89 days ago, then the clock set a minute before, and a minute after, its last use plus 90 days. A minute is the smallest step that is safe, because the clock keeps running while the test works.</p>

<h2>One edge, two services</h2>
<p>A card’s expiry is also a boundary, and it matters in two places: the enrollment service uses it for eligibility, and the card service uses it to decline purchases. The spec puts the edge at midnight UTC on the first day of the month after the expiry month. The suite checks that both services agree:</p>
${code({ title: 'tests/api/tests/eligibility/test_time_boundaries.py (part)', src: `
    someone = make_customer(customer(card(expiry="2031-03")))
    card_id = someone.card_ids[0]
    edge = datetime(2031, 4, 1, tzinfo=UTC)  # first moment of the month after 2031-03

    move_clock_to(shared_clock, edge - MINUTE)
    # Not expired yet: the next rule (recent use, years ago by then) is the one that fails.
    assert reason_after_clock_move(services, someone, card_id, "NOT_RECENTLY_USED")
    approved = expect(card_network.purchase(card_id, 100), 200, Authorization)
    assert approved.decision == "APPROVED"

    move_clock_to(shared_clock, edge + MINUTE)
    assert reason_after_clock_move(services, someone, card_id, "CARD_EXPIRED") == "CARD_EXPIRED"
` })}
<p>Look at the first check. Moving the clock years ahead also makes the card’s last use years old, so the card is ineligible a minute before the edge too. The test expects <code>NOT_RECENTLY_USED</code> there, which still proves the point: the expiry rule comes earlier in the order, so if the card were already expired, the reason would be <code>CARD_EXPIRED</code>. The test reasons about the rule order to pick a meaningful expected value, instead of hoping the card stays eligible. The purchase check shows the card service agrees the card is still valid. After the edge, the test waits for both services to report the card expired.</p>
${keyIdea(`<p>Split a rule’s inputs into groups that should behave the same, test one value from each, and put extra tests just either side of every boundary. Include the inputs that are not numbers at all, such as “never”.</p>`)}
${testerEye(`<p>When two services enforce the same boundary, test it in both, at the same moments. They are separate code, often written at different times, and an edge that differs by a day between them is a real defect.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Partition', 'A group of inputs that a rule should treat the same way; one test value represents it.'],
  ['Boundary', 'The point where a rule’s answer changes, such as 90 days after last use.'],
  ['Boundary value analysis', 'Choosing test values just either side of each boundary, where off-by-one mistakes show.'],
  ['`None`', 'Python’s value for “nothing”, used for a card never used or a card with no reason.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'The rule is “used within 90 days”. The tests use cards last used 5 and 200 days ago. The code wrongly says “within 60 days”. Do the tests catch it?',
  options: ['Yes, the 5-day card fails', 'No. 5 days is eligible and 200 days is not under both rules; only values near 90 would show the difference', 'Yes, the 200-day card fails', 'It depends on the clock'],
  answer: 1,
  why: '<p>Both test values sit well inside their partitions, where the right and wrong rules agree. Values just either side of the true boundary, 90 days, are what reveal a misplaced edge.</p>',
})}
${check({
  q: 'Which partition does an eligibility table most easily forget for the recent-use rule?',
  options: ['Used yesterday', 'Used 91 days ago', 'Never used', 'Used 89 days ago'],
  answer: 2,
  why: '<p>A card that has never been used has no date to compare, so code that subtracts dates can fail or treat it as recent. It needs its own row.</p>',
})}
${check({
  q: 'A card expires 2031-03. A minute before 2031-04-01 00:00 UTC, the wallet shows NOT_RECENTLY_USED. Does that mean the expiry rule failed?',
  options: ['Yes, the card should show as eligible', 'No. With the clock years ahead the card’s last use is old, and because expiry is checked earlier, this reason also shows the card is not yet expired', 'Yes, it should show CARD_EXPIRED', 'The test is wrong to move the clock'],
  answer: 1,
  why: '<p>The reason is the first failing rule. Expiry comes before recent use, so seeing the recent-use reason means the expiry check passed at that moment.</p>',
})}

<h2>Recap</h2>
${recap([
  'Eligibility is a table of rules in order; the first failure is the reason.',
  'Partitions give one test value per group of inputs, including “never”.',
  'Boundaries get values just either side, a minute apart for time.',
  'When two services share a boundary, check both at the same moments.',
])}
`,
};
