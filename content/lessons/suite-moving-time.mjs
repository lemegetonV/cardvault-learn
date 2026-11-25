import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { clockLag } from '../diagrams/suite.mjs';

export default {
  minutes: 13,
  lede: 'Many of CardVault’s rules are about time: an access token lasts 15 minutes, a card counts as recently used for 90 days, a verification code can be resent after a cooldown. A test cannot wait 90 days. It moves CardVault’s shared clock instead. This lesson shows how the suite does that safely, and the two details that make clock tests trustworthy.',
  youWill: 'You will learn how a test moves the clock, why it then waits for every service to notice, why time edges are tested a minute either side, and how the clock always goes back.',
  body: `
<h2>A clock the tests can move</h2>
<p>The first track’s <a href="/learn/the-shared-clock/">shared clock</a> lesson showed the mechanism: every service takes “now” from one place, which in test mode is real time plus an <strong>offset</strong> stored in a database row. A test changes the offset through <code>POST /test/clock</code> on any service, in one of four ways:</p>
${code({ title: 'tests/api/src/cardvault_tests/clients/control.py (part)', src: `
    def set_clock(self, **one_of: Any) -> httpx.Response:
        """Exactly one of offset_seconds, advance_seconds, now (ISO string) or reset=True."""
        return self.http.post("/test/clock", json=one_of, auth=self.auth)
` })}
<p><code>**one_of</code> collects whatever keyword arguments the caller passes into a dictionary, which becomes the JSON body. So <code>set_clock(advance_seconds=60)</code> sends <code>{"advance_seconds": 60}</code>. Tests reach this through the <code>shared_clock</code> fixture, which <a href="/learn/suite-fixtures/">Fixtures</a> introduced, and every such test is <a href="/learn/suite-parallel-serial/">serial</a>.</p>

<h2>Testing an expiry</h2>
${code({ title: 'tests/api/tests/auth/test_access_tokens.py (part)', src: `
@pytest.mark.serial
def test_access_token_expires_after_15_minutes_of_shared_clock_time(
    make_customer, shared_clock, services
):
    someone = make_customer(customer({"product": "CREDIT"}))
    cards = CardsClient(services.card, someone.bearer)

    # 14 minutes 50 seconds later: still valid everywhere.
    expect_status(shared_clock.set_clock(advance_seconds=14 * 60 + 50), 200)
    expect(someone.auth.me(), 200, Me)

    # Past 15 minutes: every service refuses it, because each one checks expiry itself.
    expect_status(shared_clock.set_clock(advance_seconds=20), 200)
    expect_error(someone.auth.me(), 401, "TOKEN_EXPIRED")

    # Other services see a clock change within about a second (spec 16.7 rule 44).
    resp = wait_until(
        lambda: cards.list(),
        lambda r: r.status_code == 401,
        timeout=3,
        what="card-service to see the new time",
    )
    expect_error(resp, 401, "TOKEN_EXPIRED")
` })}
<p>The test checks both sides of the edge: ten seconds before expiry the token works, ten seconds after it does not. Checking only “after” would also pass if tokens expired after one minute, so the “before” check is what pins the rule to 15 minutes.</p>

<h2>Detail one: not every service hears at once</h2>
<p>The service the test called updates its own clock before it answers. The other services re-read the offset in the background every half second, so they may run on the old time for up to about a second:</p>
${figure({ svg: clockLag(), caption: 'Right after the clock moves, the services briefly disagree about what time it is. The exact moments differ from run to run.' })}
<p>That is why the test above checks auth at once (it called auth’s clock control, through <code>shared_clock</code>) but asks the card service with <code>wait_until</code>, which retries for up to 3 seconds. Asking the card service just once could catch it still on the old time, and the test would fail for a reason that has nothing to do with tokens. The next lesson, <a href="/learn/suite-waiting/">Waiting without sleeping</a>, explains <code>wait_until</code>.</p>

<h2>Detail two: the clock keeps running</h2>
<p>Setting the clock does not stop it. Between the moment a test sets “now” and the moment the service checks a rule, real seconds pass. A test that sets the clock to exactly the 90-day edge could find the service already a second past it. So the eligibility tests stand a minute either side of the edge:</p>
${code({ title: 'tests/api/tests/eligibility/test_time_boundaries.py (part)', src: `
def test_recent_use_means_at_most_90_days(make_customer, shared_clock, services):
    someone = make_customer(customer(card(used_days_ago=89)))
    card_id = someone.card_ids[0]
    last_used = expect(someone.cards.get(card_id), 200, Card).last_used_at
    edge = last_used + timedelta(days=90)

    move_clock_to(shared_clock, edge - MINUTE)
    assert reason_after_clock_move(services, someone, card_id, None) is None

    move_clock_to(shared_clock, edge + MINUTE)
    assert reason_after_clock_move(services, someone, card_id, "NOT_RECENTLY_USED") == (
        "NOT_RECENTLY_USED"
    )
` })}
<p>The expected edge is computed from the card’s own <code>last_used_at</code>, read back from the API, plus the 90 days the spec gives. A minute is far longer than any delay in the test and far shorter than anything that could change the outcome, so both checks are safe.</p>
<p>One side effect: a jump of weeks also expires the customer’s access token, which is judged by the same clock. The helper <code>reason_after_clock_move</code> therefore logs the customer in again after every move, using the suite’s <code>log_in_again</code>.</p>

<h2>Putting time back</h2>
<p>Every clock test leaves through the <code>shared_clock</code> fixture’s clean-up. It resets the offset, then waits until <em>every</em> service reports an offset of zero. Without that wait, the next test could start while one service was still a week ahead, and fail for no reason of its own.</p>
${keyIdea(`<p>Moving the clock is a change to every service at once. Check both sides of an edge, leave a margin because the clock keeps running, wait for every service to see the change, and always put time back.</p>`)}
${testerEye(`<p>The clock drives business rules only. Retries, back-off and mock delays use real time, so moving the clock forward does not make a retry happen sooner. A test that waits for a retry must wait in real time.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Clock offset', 'The number of seconds CardVault’s business time runs ahead of (or behind) real time.'],
  ['Business time', 'The time CardVault’s rules use: real time plus the offset.'],
  ['Time edge', 'The moment a time rule changes its answer, such as 15 minutes after a token was issued.'],
  ['Margin', 'The distance a test keeps either side of an edge, so the running clock cannot cross it.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test sets the clock to exactly 90 days after a card’s last use and expects the card still to count as recently used. It fails now and then. Why?',
  options: ['The rule is 89 days', 'The clock keeps running, so by the time the service checks, it can be just past the edge', 'Tokens expire', 'The seed data changes'],
  answer: 1,
  why: '<p>Setting the clock does not freeze it. Real milliseconds pass before the service evaluates the rule, so “exactly on the edge” lands on either side. A margin of a minute removes that chance.</p>',
})}
${check({
  q: 'After `shared_clock.set_clock(advance_seconds=1000)` through auth, a test immediately asks the profile service something that depends on time. What can go wrong?',
  options: ['Nothing; all services share one clock row', 'The profile service may still be on the old time for up to about a second', 'The profile service will refuse the request', 'The clock resets itself'],
  answer: 1,
  why: '<p>Only the service that was called updates at once. Others re-read the offset every half second, so a single immediate request can see the old time. The suite polls, or waits until that service reports the new offset.</p>',
})}
${check({
  q: 'A test checks only that a token is refused 16 minutes after issue. Which wrong rule would it fail to catch?',
  options: ['Tokens that never expire', 'Tokens that expire after 5 minutes', 'Tokens refused with 403 instead of 401', 'Tokens signed with the wrong key'],
  answer: 1,
  why: '<p>A token that expired after 5 minutes is also refused at 16 minutes, so the test passes. Checking that the token still works just before 15 minutes is what pins the rule down.</p>',
})}

<h2>Recap</h2>
${recap([
  'Tests move CardVault’s shared clock with `set_clock` instead of waiting.',
  'Check both sides of a time edge, a minute apart, because the clock keeps running.',
  'Other services see a change within about a second; ask them with `wait_until`.',
  'The `shared_clock` fixture puts time back and waits until every service agrees.',
])}
`,
};
