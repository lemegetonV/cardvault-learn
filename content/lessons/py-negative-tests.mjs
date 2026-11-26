import { code, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Checking that things work is half the job. The other half is checking that the app refuses what it should refuse, at exactly the right point, and changes nothing when it does. This lesson shows the kinds of test in the suite, each with a real example.',
  youWill: 'You will be able to name and write positive, negative, boundary and state tests, and say what a good negative test checks.',
  body: `
<h2>The kinds of test</h2>
${table(['Kind', 'Question it asks', 'Example in the suite'], [
  ['Positive', 'Does the normal path work?', 'A purchase within the limit is approved'],
  ['Negative', 'Is bad input refused cleanly?', 'A wrong password gets 401'],
  ['Boundary', 'Is the limit in exactly the right place?', 'Exactly the available amount is approved; one cent more is declined'],
  ['State', 'Does the current status decide what is allowed?', 'A closed card cannot be reported lost'],
])}

<h2>Positive: check the result, not just the status</h2>
${code({ title: 'tests/api/tests/test_purchases.py', src: `
def test_a_purchase_is_approved_and_the_money_is_held(customer):
    card = customer["wallet_card"]
    cards_api = CardsApi(customer["token"])
    available_before = cards_api.get_card(card["card_id"]).json()["available"]

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=2500)

    assert response.status_code == 200
    assert response.json()["decision"] == "APPROVED"
    available_after = cards_api.get_card(card["card_id"]).json()["available"]
    assert available_after == available_before - 2500
` })}
<p>A <code>200</code> only says the request was handled. The business result is that $25.00 is now held on the card, so the test reads the available amount before and after and checks the difference. That is the claim the test name makes.</p>

<h2>Negative: check the reason, not just the refusal</h2>
${code({ title: 'tests/api/tests/test_login.py', src: `
def test_login_with_wrong_password_is_refused():
    # A new customer: wrong passwords count towards a lockout, so never use a shared account.
    someone = create_logged_in_customer(cards=[])

    response = AuthApi().login(someone["username"], "not-the-password")

    assert response.status_code == 401
    assert response.json()["error_code"] == "INVALID_CREDENTIALS"
` })}
<p>Many different problems can produce a 401. Checking the <code>error_code</code> proves it was refused for the right reason. As you saw in <a href="/learn/py-http-for-testers/">HTTP for testers</a>, the code is stable and the message text is not, so tests check the code.</p>

<h2>Boundary: test both sides of the line</h2>
${code({ title: 'tests/api/tests/test_purchases.py', src: `
def test_a_purchase_above_the_available_amount_is_declined():
    someone = create_logged_in_customer([{"product": "CREDIT", "enrolled": True, "limit": 10000}])
    card = someone["cards"][0]

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=10001)

    assert response.json()["decision"] == "DECLINED"
    assert response.json()["decline_code"] == "INSUFFICIENT_FUNDS"


def test_a_purchase_of_exactly_the_available_amount_is_approved():
    someone = create_logged_in_customer([{"product": "CREDIT", "enrolled": True, "limit": 10000}])
    card = someone["cards"][0]

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=10000)

    assert response.json()["decision"] == "APPROVED"
` })}
<p>Mistakes cluster at limits: a <code>&lt;</code> written where <code>&lt;=</code> was meant. Testing exactly 10,000 and 10,001 cents catches that, where a test at 5,000 and 50,000 would not. The same thinking gave the wallet test its <code>89</code> days for the 90-day rule.</p>

<h2>State: what is allowed depends on status</h2>
${code({ title: 'tests/api/tests/test_cards.py', src: `
def test_a_closed_card_cannot_be_reported_lost(customer):
    cards_api = CardsApi(customer["token"])
    card_id = customer["new_card"]["card_id"]
    cards_api.close(card_id)

    response = cards_api.report_lost(card_id)

    assert response.status_code == 409
    assert response.json()["error_code"] == "INVALID_STATE_TRANSITION"
` })}
<p>The set-up step (closing the card) comes before the blank line, and the action under test after it. <code>409 Conflict</code> means the request is fine but the card’s current state forbids it.</p>

<h2>Refused, and nothing changed</h2>
<p>A good negative test also checks that a refusal left no trace. A declined purchase must not hold money:</p>
${code({ title: 'tests/api/tests/test_purchases.py', src: `
def test_a_declined_purchase_holds_no_money():
...
    CardNetworkApi().make_purchase(card["token_ref"], amount=50000)

    available = CardsApi(someone["token"]).get_card(card["card_id"]).json()["available"]
    assert available == 10000
` })}

${keyIdea('<p>For a success, check the business result. For a refusal, check the status code, the error code, and that nothing changed. Test limits on both sides.</p>')}

${testerEye('<p>When you find a negative case, ask what the requirement says should happen, not what feels right. A repeated "report lost" returning 200 is correct here, because CardVault’s contract says repeating it is safe.</p>')}

${interview({
  say: `<p>“For each feature I cover positive, negative, boundary and state cases. Positive tests check the business effect, for example that the available balance dropped by the purchase amount, not just a 200. Negative tests check the status code and the stable error code, and that nothing changed. Boundary tests sit on both sides of every limit, like exactly the available amount and one cent more.”</p>`,
  qa: [
    ['What is boundary value analysis?', '<p>Testing at and just around each limit, because off-by-one mistakes hide there. For a limit of 10,000 cents: 10,000 must pass and 10,001 must fail.</p>'],
    ['What makes a good negative test?', '<p>It checks the right status code, the specific error code, and that the refused action changed nothing.</p>'],
    ['Why is 200 not enough for a positive test?', '<p>It only means the server handled the request. The test must prove the business result happened, by reading the changed state back.</p>'],
  ],
})}
`,
};
