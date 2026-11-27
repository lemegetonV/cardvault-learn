import { code, terminal, interview, keyIdea, testerEye, task, reveal } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'The last kind of practice task is about the framework itself: “these tests repeat themselves, tidy them up”, “write a fixture for this set-up”, or “this run went red, what happened?”. Each one checks a pytest skill from this track under time pressure. This lesson has three tasks, each solved and run against CardVault.',
  youWill: 'You will be able to turn repeated tests into one parametrized test, write a fixture with set-up and clean-up, and sort a red run into environment, test or application problems from the output alone.',
  body: `
<h2>Task 1: three copies of one test</h2>
${task(`<p>A colleague wrote these three tests. Turn them into one test that does the same checks.</p>
${code({ title: 'Example · before', src: `
def test_a_credit_card_can_join_the_wallet():
    someone = create_logged_in_customer([{"product": "CREDIT"}])
    card_id = someone["cards"][0]["card_id"]
    response = WalletApi(someone["token"]).add_card(card_id)
    assert response.status_code == 202


def test_a_debit_card_can_join_the_wallet():
    someone = create_logged_in_customer([{"product": "DEBIT"}])
    card_id = someone["cards"][0]["card_id"]
    response = WalletApi(someone["token"]).add_card(card_id)
    assert response.status_code == 202


def test_a_prepaid_card_cannot_join_the_wallet():
    someone = create_logged_in_customer([{"product": "PREPAID"}])
    card_id = someone["cards"][0]["card_id"]
    response = WalletApi(someone["token"]).add_card(card_id)
    assert response.status_code == 422
` })}`)}
${reveal('Hint', `<p>Find what changes between the copies: the product and the expected status. Those two become the parameters of <a href="/learn/py-parametrize/"><code>@pytest.mark.parametrize</code></a>, one tuple per old test.</p>`)}
${reveal('A model solution', `${code({ title: 'Example · after', src: `
import pytest

from api.wallet_api import WalletApi
from helpers import create_logged_in_customer


@pytest.mark.parametrize(
    "product, expected_status",
    [
        ("CREDIT", 202),
        ("DEBIT", 202),
        ("PREPAID", 422),
    ],
)
def test_which_cards_can_join_the_wallet(product, expected_status):
    someone = create_logged_in_customer([{"product": product}])
    card_id = someone["cards"][0]["card_id"]

    response = WalletApi(someone["token"]).add_card(card_id)

    assert response.status_code == expected_status
` })}
${terminal([['pytest tests/test_wallet_practice.py -v', `tests/test_wallet_practice.py::test_which_cards_can_join_the_wallet[CREDIT-202] PASSED [ 33%]
tests/test_wallet_practice.py::test_which_cards_can_join_the_wallet[DEBIT-202] PASSED [ 66%]
tests/test_wallet_practice.py::test_which_cards_can_join_the_wallet[PREPAID-422] PASSED [100%]`]], 'Terminal (shortened)')}
<ul>
<li>pytest still reports three tests, with the parameters in brackets, so a failure names the product that failed.</li>
<li>Adding a product is now one line in the list.</li>
<li>Worth saying: the refusal case deserves one more check, the <code>error_code</code>, which the 202 cases do not have. Either keep the refusal as its own test, or add an expected error code to each tuple and check it only when it is not <code>None</code>. Splitting is usually clearer than adding conditions to one test.</li>
</ul>`, 'solution')}

<h2>Task 2: a fixture that cleans up</h2>
${task(`<p>Several tests need a card that is already in the wallet. Write a fixture <code>card_in_wallet</code> that uses the suite’s <code>customer</code> fixture, adds its <code>new_card</code> to the wallet, waits until the wallet shows it as <code>ENROLLED</code>, gives the test the card ID, and removes the card from the wallet afterwards. Then write one test that uses it.</p>
<p>Useful pieces: <code>WalletApi(token).add_card(card_id)</code> (answers <code>202</code>), <code>wait_for_wallet_status(wallet_api, card_id, "ENROLLED")</code>, and <code>remove_card(card_id)</code>.</p>`)}
${reveal('Hint', `<p>A fixture that cleans up uses <code>yield</code> instead of <code>return</code>, as in <a href="/learn/py-fixtures/">Fixtures</a>: set-up above it, clean-up below it. A fixture can ask for another fixture by naming it as a parameter.</p>`)}
${reveal('A model solution', `${code({ title: 'Example · a fixture with clean-up', src: `
@pytest.fixture
def card_in_wallet(customer):
    wallet_api = WalletApi(customer["token"])
    card_id = customer["new_card"]["card_id"]

    response = wallet_api.add_card(card_id)
    assert response.status_code == 202, response.text
    wait_for_wallet_status(wallet_api, card_id, "ENROLLED")

    yield card_id

    wallet_api.remove_card(card_id)


def test_a_card_in_the_wallet_shows_as_enrolled(customer, card_in_wallet):
    response = WalletApi(customer["token"]).get_card(card_in_wallet)

    assert response.status_code == 200
    assert response.json()["enrollment"]["status"] == "ENROLLED"
` })}
<ul>
<li>The test asks for <code>customer</code> as well, to get the token. pytest creates one customer per test and gives the same one to the test and to the fixture.</li>
<li><code>assert ..., response.text</code> in the set-up means a failed add shows the server’s answer, rather than a vague error later.</li>
<li>The removal runs after the test, pass or fail. When this test was first written with the wrong field, <code>response.json()["status"]</code>, it failed, and pytest’s output still showed a <strong>Captured log teardown</strong> section with the <code>DELETE</code> request: proof that the clean-up ran.</li>
<li>Be honest about the context. In this suite each test owns a throwaway customer, so removing the card is not strictly needed. The pattern matters in shared environments, where data a test leaves behind affects the next run.</li>
</ul>`, 'solution')}

<h2>Task 3: read a red run</h2>
<p>An interviewer shows you failure output and asks what went wrong. Three real ones, from tests run against CardVault, are below. For each one, say whether the cause is most likely the <strong>environment</strong>, the <strong>test</strong> or the <strong>application</strong>, and what you would check next.</p>
${task(`<p><strong>Failure A</strong></p>
${terminal([['pytest tests/test_practice.py -v', `tests/test_practice.py::test_alice_has_four_cards FAILED
...
E   requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8999): Max retries exceeded with url: /v1/cards (Caused by NewConnectionError("HTTPConnection(host='localhost', port=8999): Failed to establish a new connection: [Errno 111] Connection refused"))`]], 'Terminal (shortened)')}
<p><strong>Failure B</strong></p>
${terminal([['pytest tests/test_practice.py', `tests/test_practice.py:17: in test_a_new_card_shows_in_the_wallet_list
    assert response.json()["status"] == "ACTIVE"
           ^^^^^^^^^^^^^^^^^^^^^^^^^
E   KeyError: 'status'`]], 'Terminal (shortened)')}
<p><strong>Failure C</strong></p>
${terminal([['pytest tests/test_practice.py', `tests/test_practice.py:26: in test_a_prepaid_card_can_join_the_wallet
    assert response.status_code == 202
E   assert 422 == 202
E    +  where 422 = <Response [422]>.status_code`]], 'Terminal (shortened)')}`)}
${reveal('Hint', `<p>Read the last line starting with <code>E</code> first. Did the request get an answer at all? If it did, did the test fail on an <code>assert</code> comparison, or on its own code before any comparison?</p>`)}
${reveal('Model answers', `<p><strong>A: the environment.</strong> The request never reached a server: <strong>connection refused</strong> on port 8999. Either the service is down or the test points at the wrong address. Check the configured <code>CARD_URL</code>, then whether the service is running. Here the address was wrong on purpose: Cards runs on 8002.</p>
<p><strong>B: the test.</strong> A <code>KeyError</code> is Python failing to find a key in a dictionary, raised in the test’s own line before any comparison. The response had no top-level <code>status</code>. Log or print the body and compare it with the API documentation; here the status sits under <code>enrollment</code>. pytest reports this as a failure like any other, so read the error type, not just the word FAILED.</p>
<p><strong>C: the application or the test, so check the requirement.</strong> The request worked and the app answered 422 where the test expected 202. Either the app is wrong or the expectation is. Look at the response body (the <code>error_code</code> explains a 422) and the requirement. Here the requirement says prepaid cards cannot join the wallet, so the test’s expectation is wrong.</p>
<p>The order of questions is the skill: did the request get through, did the test’s own code break, and only then is it the product? Even then, a mismatch is a question about the requirement before it is a bug report, as <a href="/learn/py-debugging/">Debugging a failing test</a> shows step by step.</p>`, 'solution')}

${keyIdea('<p>Repeated tests that differ only in data become one parametrized test. Set-up that needs undoing goes in a fixture with <code>yield</code>, whose clean-up runs even when the test fails. A red run is sorted by its last error line: no connection is the environment, a Python error in the test is the test, and a failed comparison is a question for the requirement.</p>')}

${testerEye('<p>When you cannot tell the cause from the output, that is a finding too: say what evidence is missing, such as the response body or the service log, and how you would add it to the framework.</p>')}

${interview({
  say: `<p>“When I see repeated tests that differ only in their data, I turn them into one parametrized test so each case is a line and failures name the case. Set-up that must be undone goes in a fixture with yield, so the clean-up runs even if the test fails. When a run goes red, I read the last error line first: a connection error points at the environment, a Python error such as KeyError points at the test code, and a failed comparison means checking the response and the requirement before raising a bug.”</p>`,
  qa: [
    ['When would you not parametrize?', '<p>When the cases need different set-up or different checks. Forcing them into one test fills it with conditions, which makes it harder to read than two simple tests.</p>'],
    ['Does fixture clean-up run if the test fails?', '<p>Yes. Code after <code>yield</code> runs whether the test passed or failed. If the set-up before <code>yield</code> fails, the test does not run and there is nothing to clean up, so the clean-up is skipped.</p>'],
    ['A test fails with ConnectionError in CI but passes on your laptop. What do you check?', '<p>That the service started in CI and is healthy before the tests run, and that the URLs from the environment point at it. A connection error says the request never got an answer, so the product code is not the first suspect.</p>'],
  ],
})}
`,
};
