import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { raceResult } from '../diagrams/suite.mjs';

export default {
  minutes: 14,
  lede: 'Real clients repeat themselves. A phone loses signal and sends the same request again; a card network retries a message it is unsure arrived. And many requests can reach the bank at the same instant. Rules that hold for one tidy request at a time can break under both. This lesson shows how the suite tests repeated requests, and how it fires requests together to look for races.',
  youWill: 'You will learn how to test idempotency keys, how to send requests at the same moment with a thread pool, how to assert on totals instead of on order, and what a race test can and cannot prove.',
  body: `
<h2>The same request, twice</h2>
<p>A client that times out cannot tell whether its request worked. If it simply tries again, a payment could happen twice. CardVault’s answer, from the first track’s <a href="/learn/idempotency-keys/">Safe retries with idempotency keys</a>, is the <code>Idempotency-Key</code> header: the first answer for a key is stored, and a repeat with the same key gets that stored answer instead of acting again.</p>
<p>To test it, the suite needs an action whose repetition would be visible. Reissuing a card is ideal: every real reissue gives the card a new number, so two reissues leave different traces. A replay must look identical:</p>
${code({ title: 'tests/api/tests/idempotency/test_idempotency_keys.py (part)', src: `
def test_same_key_replays_the_first_response(make_customer):
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]
    key = new_key()

    first = someone.cards.reissue(card_id, idempotency_key=key)
    again = someone.cards.reissue(card_id, idempotency_key=key)

    assert (first.status_code, again.status_code) == (200, 200)
    assert again.content == first.content, "a replay is byte-for-byte the first response"
    assert again.headers.get("Idempotent-Replayed") == "true"
    assert "Idempotent-Replayed" not in first.headers
    # Only one reissue happened: the card is exactly as the first response described it.
    assert expect(someone.cards.get(card_id), 200, Card) == Card.model_validate(first.json())
` })}
<p>Each assertion supports a different part of the claim. The bodies match byte for byte, so the answer was replayed. The <code>Idempotent-Replayed</code> header says so on the repeat and not on the original. And the card read back afterwards equals the <em>first</em> response, which proves only one reissue happened; a second real reissue would have changed the card again. <code>new_key()</code> makes a key from a random UUID, so no two tests ever share one.</p>
<p>The rest of the file tests the edges of the rule, each from the spec:</p>
<ul>
<li>The same key on a <em>different</em> card is refused with <code>422 IDEMPOTENCY_KEY_REUSED</code>, and the second card is checked to be unchanged.</li>
<li>The same key on a different endpoint is a different request, and both act.</li>
<li>Two customers using the same key each get their own answer, because keys belong to the caller.</li>
<li>A refused request is replayed too: retrying a refusal stays refused.</li>
</ul>

<h2>Firing requests together</h2>
<p>A <strong>race condition</strong> is a bug that appears only when operations overlap. The classic one with money: two purchases both read “available 10.00”, both decide there is enough, and both are approved. One request at a time can never show it.</p>
<p>To make requests overlap, the suite sends them from several <strong>threads</strong>, lines of execution that run at the same time inside one process. Python’s standard library has a ready-made pool of them:</p>
${code({ title: 'tests/api/tests/concurrency/test_parallel_money.py (part)', src: `
WORKERS = 10


def run_together(calls):
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        return list(pool.map(lambda call: call(), calls))
` })}
<p><code>ThreadPoolExecutor</code> starts ten threads. <code>pool.map</code> hands each call in the list to a free thread and collects the results in the original order. The <code>with</code> block waits for every call to finish before it ends. These are threads inside one test, which is a different thing from the <a href="/learn/suite-parallel-serial/">xdist workers</a> that run separate tests.</p>
${code({ title: 'tests/api/tests/concurrency/test_parallel_money.py (part)', src: `
@pytest.mark.parametrize("product", ["DEBIT", "CREDIT"])
def test_parallel_purchases_never_spend_more_than_available(make_customer, card_network, product):
    someone = make_customer(customer(card(product, limit=10_000)))
    card_id = someone.card_ids[0]

    responses = run_together([lambda: card_network.purchase(card_id, 1_000)] * 20)

    decisions = [expect(r, 200, Authorization) for r in responses]
    approved = [d for d in decisions if d.decision == "APPROVED"]
    declined = [d for d in decisions if d.decision == "DECLINED"]
    assert len(approved) == 10, "exactly 10 x 10.00 fit into 100.00"
    assert {d.decline_code for d in declined} == {"INSUFFICIENT_FUNDS"}
    assert expect(someone.cards.get(card_id), 200, Card).available == 0
` })}
${figure({ svg: raceResult(), caption: 'The test cannot know which ten requests win, so it checks the totals: how many of each answer, and the final balance.' })}
<p><code>[…] * 20</code> repeats the list’s one item twenty times, giving twenty identical calls. The important choice is what to assert. Which requests win depends on timing, so asserting “the first ten are approved” would be wrong. The suite asserts what must be true whatever the timing: exactly ten approvals, every decline for lack of funds, and nothing left. The <code>{… for …}</code> form builds a set, so the decline check means “every decline code, and there is only one kind”.</p>
<p>Other tests in the file use the same pattern for duplicates: ten copies of one authorization (same <code>trace_id</code>, as a retrying network would send) must give one hold; ten settles of one purchase must give one <code>200</code> and nine <code>409 ALREADY_SETTLED</code>.</p>

<h2>When the answer is “try later”</h2>
<p>Ten copies of a reissue with one idempotency key, sent together, raise a subtle case: some copies arrive while the first is still running, so there is no stored answer yet. CardVault answers those with <code>409 IDEMPOTENCY_IN_PROGRESS</code>. The test therefore allows each copy to be either the stored answer or “in progress”, and then insists that all completed answers are identical and match the card as it now is. It accepts every outcome the spec allows, and nothing else.</p>

<h2>What a race test proves</h2>
<p>A passing race test does not prove there is no race. The operating system decides exactly when each thread runs, and an unlucky schedule might simply not happen this time. What the test does do is give a broken lock many chances to show itself on every run. The file’s docstring says this plainly, and so should any report built on it.</p>
${keyIdea(`<p>Test repeats by checking that the effect happened once, not just that the answers match. Test races by firing requests together and asserting on totals that must hold in every order. A pass makes a race unlikely; it does not prove there is none.</p>`)}
${testerEye(`<p>If a race test fails only occasionally, that is not flakiness to ignore: it is the race appearing. Run it repeatedly and look at the totals each time, such as eleven approvals, which show exactly what overlapped.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Idempotency key', 'A client-chosen key that makes a repeated request return the first answer instead of acting again.'],
  ['Replay', 'The stored response sent back for a repeated key, marked `Idempotent-Replayed: true`.'],
  ['Race condition', 'A bug that appears only when operations overlap in time.'],
  ['Thread', 'A line of execution running alongside others in the same process.'],
  ['`ThreadPoolExecutor`', 'Python’s ready-made pool of threads; `pool.map` runs calls on them and collects the results.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test reissues a card twice with the same key and checks only that both responses are 200. What would it miss?',
  options: ['Nothing', 'That the second request might have reissued the card again instead of replaying the first answer', 'The correlation ID', 'The response time'],
  answer: 1,
  why: '<p>Two real reissues also give two 200s. Only comparing the bodies, the replay header and the card read back afterwards shows that the action happened once.</p>',
})}
${check({
  q: 'Twenty purchases of 10.00 run together on a card with 100.00 available. The test asserts that responses 0 to 9 are approved. Why is that wrong?',
  options: ['Responses are always declined first', 'Which requests win depends on timing; only the totals are fixed, so the test would fail at random', 'There are only ten responses', 'pool.map returns results unordered'],
  answer: 1,
  why: '<p>The results come back in the order the calls were listed, but which calls the card service approved depends on which reached it first. Exactly ten approvals and a final balance of 0 hold whatever the timing.</p>',
})}
${check({
  q: 'A race test has passed a hundred times. What can you say?',
  options: ['There is no race', 'A race is unlikely under these conditions; it is not proven absent', 'The test is useless', 'The lock is too slow'],
  answer: 1,
  why: '<p>Thread scheduling varies, so passing runs show the bug did not appear, not that it cannot. That is still valuable evidence, stated honestly.</p>',
})}

<h2>Recap</h2>
${recap([
  'Test an idempotency key by showing the action happened once: same bytes, replay header, state matches the first answer.',
  'Test the rule’s edges: other card, other endpoint, other customer, refused requests.',
  '`ThreadPoolExecutor` fires requests together; assert on totals, never on which request won.',
  'A passing race test makes a race unlikely, not impossible.',
])}
`,
};
