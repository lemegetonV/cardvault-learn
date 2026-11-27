import { code, interview, keyIdea, testerEye, task, reveal } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'Many SDET interviews include a short coding task: “here is an endpoint, write some tests for it”. The interviewer watches how you think as much as what you type. This lesson gives a routine to follow out loud, then two practice tasks, one with plain requests and one inside the suite, each with hints and a model solution.',
  youWill: 'You will be able to plan tests for an endpoint out loud and write them in pytest, with plain requests or with the suite’s client classes.',
  body: `
<h2>A routine to say out loud</h2>
<p>Silence is the most common mistake in live coding. Talking through a fixed routine fills the silence with useful signals, and stops you from forgetting a step under pressure.</p>
<ol>
<li><strong>Ask about the contract.</strong> What does a success return? Which errors are documented? Is there test data I can use, and can I create my own?</li>
<li><strong>List the cases before coding.</strong> One positive, then negatives (bad input, no permission, not found), then a boundary if there is a limit. Say them, or write them as test names first.</li>
<li><strong>Write the simplest test first and run it.</strong> A passing test early proves the set-up works.</li>
<li><strong>Check the result, not just the status.</strong> A 200 with the wrong data is a failure.</li>
<li><strong>Say what you would add with more time.</strong> Schema checks, more boundaries, parallel safety.</li>
</ol>

<h2>Task 1: login, with plain requests</h2>
${task(`<p>Using only pytest and requests, write tests for the login endpoint: <code>POST http://localhost:8001/v1/auth/login</code> with a JSON body <code>{"username": "...", "password": "..."}</code>.</p>
<ul>
<li>A correct login returns <code>200</code> with <code>token_type</code> <code>"Bearer"</code> and an <code>access_token</code>.</li>
<li>Wrong credentials return <code>401</code> with <code>error_code</code> <code>"INVALID_CREDENTIALS"</code>.</li>
<li>A missing field returns <code>422</code> with <code>error_code</code> <code>"VALIDATION_ERROR"</code>.</li>
<li>Five failed logins lock a username for a while. The demo user is <code>alice</code>, password <code>CardVault-Demo-1</code>.</li>
</ul>
<p>Write one positive and two negative tests. Try it before opening the hints.</p>`)}
${reveal('Hint 1: the shape', `<p>Each test has the same three parts: send the request, check the status, check one field of the body. A small <code>login(username, password)</code> function saves repeating the URL.</p>`)}
${reveal('Hint 2: the trap', `<p>Look again at the last line of the task. If the wrong-password test uses <code>alice</code>, five runs lock her account and break every other test that logs in as her. What username could you use instead?</p>`)}
${reveal('A model solution', `${code({ title: 'Example · tests/test_login_practice.py', src: `
import uuid

import requests

BASE_URL = "http://localhost:8001"


def login(username, password):
    body = {"username": username, "password": password}
    return requests.post(f"{BASE_URL}/v1/auth/login", json=body, timeout=10)


def test_login_with_the_right_password_returns_a_token():
    response = login("alice", "CardVault-Demo-1")

    assert response.status_code == 200
    assert response.json()["token_type"] == "Bearer"
    assert response.json()["access_token"]


def test_login_with_a_wrong_password_is_refused():
    # A made-up user: wrong passwords count towards a lockout,
    # so never use a shared account for this.
    response = login(f"nobody-{uuid.uuid4().hex[:8]}", "not-the-password")

    assert response.status_code == 401
    assert response.json()["error_code"] == "INVALID_CREDENTIALS"


def test_login_without_a_password_is_refused():
    response = requests.post(f"{BASE_URL}/v1/auth/login", json={"username": "alice"}, timeout=10)

    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"
` })}
<p>Points worth saying while you write it:</p>
<ul>
<li>The wrong-password test uses a new made-up name each run, because failed logins count towards a lockout even for names that do not exist. This is the kind of detail that impresses, because it shows you think about tests running many times.</li>
<li><code>assert response.json()["access_token"]</code> checks the token is not empty. Checking its exact value is impossible, because it changes every time.</li>
<li>Every call has a <code>timeout</code>, so a hung service fails the test instead of freezing it.</li>
<li>With more time: a schema check of the success body, an unknown user getting the same error as a wrong password, and moving the URL into config.</li>
</ul>
<p>These three tests pass against CardVault running locally.</p>`, 'solution')}

<h2>Task 2: one card, inside the suite</h2>
${task(`<p>Using the suite’s fixtures and <code>CardsApi</code>, write tests for <code>GET /v1/cards/{card_id}</code>, which <code>CardsApi(token).get_card(card_id)</code> calls.</p>
<ul>
<li>A customer can read their own card: <code>200</code>, and the body is that card.</li>
<li>An ID that does not exist returns <code>404</code> with <code>error_code</code> <code>"CARD_NOT_FOUND"</code>.</li>
<li>Another customer’s card must not be readable.</li>
</ul>
<p>You may use <code>alice_token</code>, <code>ALICE</code> from <code>data/demo_customers.py</code>, and <code>create_logged_in_customer</code>.</p>`)}
${reveal('Hint 1: getting a card ID', `<p>You do not know alice’s card IDs in advance, but you can list her cards first and take one from the list.</p>`)}
${reveal('Hint 2: the security case', `<p>Create a second customer with one card, then try to read their card with alice’s token. What status should come back: 403 or 404? Think about what each one tells an attacker.</p>`)}
${reveal('A model solution', `${code({ title: 'Example · tests/test_card_practice.py', src: `
from api.cards_api import CardsApi
from data.demo_customers import ALICE
from helpers import create_logged_in_customer

UNKNOWN_CARD_ID = "00000000-0000-4000-8000-000000000000"


def test_alice_can_read_one_of_her_cards(alice_token):
    cards_api = CardsApi(alice_token)
    card_id = cards_api.list_cards().json()["items"][0]["card_id"]

    response = cards_api.get_card(card_id)

    assert response.status_code == 200
    card = response.json()
    assert card["card_id"] == card_id
    assert card["last4"] in ALICE["cards"]


def test_an_unknown_card_is_not_found(alice_token):
    response = CardsApi(alice_token).get_card(UNKNOWN_CARD_ID)

    assert response.status_code == 404
    assert response.json()["error_code"] == "CARD_NOT_FOUND"


def test_another_customers_card_is_not_found(alice_token):
    someone = create_logged_in_customer([{"product": "DEBIT"}])
    their_card_id = someone["cards"][0]["card_id"]

    response = CardsApi(alice_token).get_card(their_card_id)

    assert response.status_code == 404
    assert response.json()["error_code"] == "CARD_NOT_FOUND"
` })}
<ul>
<li>The first test checks the body is the card it asked for, and that its last four digits are one of alice’s known cards. A 200 alone would not prove that.</li>
<li><code>in ALICE["cards"]</code> checks whether a key is in a dictionary.</li>
<li>CardVault answers <code>404</code> for someone else’s card, the same as for a card that does not exist. A <code>403</code> would admit the card exists, which helps an attacker guess IDs. If you said 403 in the hint, that is a good discussion point, not a failure: ask what the requirement says.</li>
<li>The second customer is fresh, so the test owns its data and can run in parallel.</li>
</ul>
<p>These three tests pass against CardVault running locally. The suite has similar ones in <code>test_cards.py</code> and <code>test_security.py</code>.</p>`, 'solution')}

${keyIdea('<p>In live coding, ask about the contract, list the cases out loud, run the simplest test first, check the body as well as the status, and say what you would add next. Watch for shared data, such as an account that locks.</p>')}

${testerEye('<p>If you get stuck, say what you are trying to do and what you would look up. “I would check the requests documentation for how to send a form” is a fine answer in an interview; silence is not.</p>')}

${interview({
  say: `<p>“Before writing anything I would ask what a success returns and which errors are documented, and whether I can create my own test data. Then I would list the cases: the happy path, invalid input, no permission, not found, and any boundary. I write the simplest test first and run it, check the body as well as the status, and keep tests independent, for example by never using a shared account for wrong-password tests.”</p>`,
  qa: [
    ['You are given an endpoint and ten minutes. What tests do you write first?', '<p>One positive test that checks the body, then the most important negatives: invalid input, missing authentication or permission, and not found. Boundaries next if there is a limit. I say the list out loud first so the interviewer can steer me.</p>'],
    ['Why does CardVault return 404 for another customer’s card instead of 403?', '<p>403 would confirm the card exists, which leaks information and helps guessing. 404 treats it exactly like a card that does not exist.</p>'],
    ['How do you test a login without locking accounts?', '<p>Use the shared account only for successful logins, and a fresh or random username for failed attempts, because failed attempts count towards a lockout.</p>'],
  ],
})}
`,
};
