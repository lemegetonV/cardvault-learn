import { code, terminal, interview, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 9,
  lede: 'The wallet has eight rules that can keep a card out. Writing eight almost identical tests would bury the rules in repeated code. pytest’s parametrize writes the test once and runs it once per row of data.',
  youWill: 'You will be able to read and write a parametrized test, name its cases, and explain when parametrize helps.',
  body: `
<h2>The repetition problem</h2>
<p>Each eligibility test would do the same three things: create a customer with one card, ask the wallet about that card, and check the reason. Only the card, the verification flags and the expected reason change. That is a table of data, so pytest lets you write it as one.</p>

<h2>The test</h2>
${code({ title: 'tests/api/tests/test_wallet.py', src: `
# Each row: the card and customer we create, and the reason we expect.
# The rules come from the wallet's eligibility requirements.
@pytest.mark.parametrize(
    "card, email_verified, phone_verified, expected_reason",
    [
        ({"product": "PREPAID"}, True, True, "PRODUCT_NOT_SUPPORTED"),
        ({"product": "CREDIT", "status": "LOST"}, True, True, "CARD_NOT_ACTIVE"),
        ({"product": "CREDIT", "used_days_ago": 91}, True, True, "NOT_RECENTLY_USED"),
        ({"product": "CREDIT", "used_days_ago": None}, True, True, "NOT_RECENTLY_USED"),
        ({"product": "CREDIT"}, False, True, "EMAIL_NOT_VERIFIED"),
        ({"product": "CREDIT"}, True, False, "PHONE_NOT_VERIFIED"),
    ],
    ids=[
        "prepaid",
        "lost-card",
        "used-91-days-ago",
        "never-used",
        "email-unverified",
        "phone-unverified",
    ],
)
def test_card_that_may_not_join_the_wallet(card, email_verified, phone_verified, expected_reason):
    someone = create_logged_in_customer([card], email_verified, phone_verified)
    card_id = someone["cards"][0]["card_id"]

    wallet_card = WalletApi(someone["token"]).get_card(card_id).json()

    assert wallet_card["eligible"] is False
    assert wallet_card["ineligible_reason"] == expected_reason
` })}
<ol>
<li>The first argument is a string of names, separated by commas. They must match the test function’s parameters.</li>
<li>The second is a list of rows. Each row is a <strong>tuple</strong>, values in round brackets, one per name, in the same order. A tuple is like a list that cannot be changed.</li>
<li><code>ids</code> gives each row a readable name. Without it, pytest invents names such as <code>card0-True-True-PRODUCT_NOT_SUPPORTED</code>.</li>
<li>pytest runs the function once per row, passing that row’s values in. Each run is a separate test that passes or fails on its own.</li>
</ol>

<h2>What you see when it runs</h2>
${terminal([['pytest "tests/test_wallet.py::test_card_that_may_not_join_the_wallet"', `collected 6 items

tests/test_wallet.py::test_card_that_may_not_join_the_wallet[prepaid] PASSED [ 16%]
tests/test_wallet.py::test_card_that_may_not_join_the_wallet[lost-card] PASSED [ 33%]
tests/test_wallet.py::test_card_that_may_not_join_the_wallet[used-91-days-ago] PASSED [ 50%]
tests/test_wallet.py::test_card_that_may_not_join_the_wallet[never-used] PASSED [ 66%]
tests/test_wallet.py::test_card_that_may_not_join_the_wallet[email-unverified] PASSED [ 83%]
tests/test_wallet.py::test_card_that_may_not_join_the_wallet[phone-unverified] PASSED [100%]`]], 'Terminal')}
<p>The id in square brackets tells you which rule failed. You can also run a single case by putting its id in the command, for example <code>...[never-used]</code>.</p>

<h2>The expected values come from the rules</h2>
<p>Each row is one requirement. 91 days sits just outside the 90-day rule, and a card never used at all must fail the same rule. Another test in the same file checks 89 days, just inside it, with a single parameter:</p>
${code({ title: 'tests/api/tests/test_wallet.py', src: `
@pytest.mark.parametrize("product", ["CREDIT", "DEBIT"])
def test_recently_used_credit_and_debit_cards_may_join(product):
` })}
<p>With one name, the rows are plain values, so no tuples are needed.</p>

<h2>Parametrize in the login tests</h2>
<p>The same tool covers two empty-field cases in <code>test_login.py</code>: an empty username and an empty password both get <code>422</code>. Whenever you catch yourself copying a test to change one value, parametrize is the better tool.</p>

${keyIdea('<p>Parametrize turns one test function into many tests, one per row of data. Use it when tests differ only in their inputs and expected results, and give every row a readable id.</p>')}

${testerEye('<p>This is <strong>data-driven testing</strong>. Rows can also come from a file, such as a CSV, read into a list before the decorator. Keep the rows visible in the test when there are only a few, because the data is the test.</p>')}

${interview({
  say: `<p>“I use pytest.mark.parametrize for data-driven tests. The wallet has a list of eligibility rules, so one test function takes the card set-up and the expected rejection reason, with one row per rule and readable ids. pytest reports each row as its own test, so a failure names the exact rule.”</p>`,
  qa: [
    ['What does parametrize do?', '<p>It runs the same test function once for each set of arguments you list, reporting each run as a separate test.</p>'],
    ['Why give ids to parameters?', '<p>So test names and failure reports say which case it was, such as <code>[never-used]</code>, instead of a string built from the values.</p>'],
    ['When would you not parametrize?', '<p>When the cases need different set-up or different checks. Forcing them into one function with if statements makes the test harder to read than two simple tests.</p>'],
  ],
})}
`,
};
