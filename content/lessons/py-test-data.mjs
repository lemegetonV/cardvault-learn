import { code, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'A test is only as good as its expected values, and only as reliable as its data. This lesson covers where the suite’s expected values come from, why tests that change things get a brand-new customer, and a real bug in the suite caused by data that was not unique.',
  youWill: 'You will be able to explain the suite’s test data rules: known data for reading, fresh data for changing, and unique values every run.',
  body: `
<h2>Two kinds of data</h2>
${table(['', 'Known demo data', 'Fresh data per test'], [
  ['What', 'alice and the other demo customers, loaded the same way every time the environment is set up', 'A brand-new customer made just for one test'],
  ['Used for', 'Tests that only read', 'Tests that change anything'],
  ['Expected values', 'Written down in `data/demo_customers.py`', 'Chosen by the test when it creates the data'],
])}

<h2>Known data: written down once</h2>
${code({ title: 'tests/api/data/demo_customers.py', src: `
ALICE = {
    "username": "alice",
    "display_name": "Alice Archer",
    # Her four cards, by the last four digits of the card number.
    "cards": {
        "4417": "CREDIT",
        "2045": "DEBIT",
        "7380": "CREDIT",
        "5521": "PREPAID",
    },
...
}
` })}
<p>These are the expected results for every test that reads alice. They come from the demo data, which is known in advance. They do not come from running the app and copying its answer, which would only prove the app returns what it returned.</p>
<p>Because many tests share alice, no test may change her. One test reporting her card lost would break every test that expects it to be active.</p>

<h2>Fresh data: create what you need</h2>
<p>Test environments usually offer a way to create data, through an admin API, a database script or a set-up endpoint. CardVault’s test environment has an endpoint that creates a customer with exactly the cards a test describes. The helper wraps it and logs the new customer in:</p>
${code({ title: 'tests/api/helpers.py', src: `
def create_logged_in_customer(cards, email_verified=True, phone_verified=True):
...
    response = CustomersApi().create_customer(cards, email_verified, phone_verified)
    assert response.status_code == 201, response.text
    customer = response.json()

    login = AuthApi().login(customer["username"], customer["password"])
    assert login.status_code == 200, login.text

    return {
        "username": customer["username"],
        "password": customer["password"],
        "token": login.json()["access_token"],
        "cards": customer["cards"],
    }
` })}
<p>A test describes the customer it needs, and the expected values follow from that description:</p>
${code({ title: 'tests/api/tests/test_purchases.py', src: `
def test_a_purchase_above_the_available_amount_is_declined():
    someone = create_logged_in_customer([{"product": "CREDIT", "enrolled": True, "limit": 10000}])
    card = someone["cards"][0]

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=10001)
` })}
<p>The test set the limit to 10,000 cents, so it knows a purchase of 10,001 must be declined. The data and the expectation sit side by side.</p>

<h2>A real bug: data that was not unique</h2>
<p>While this track was being written, one test began to fail on its sixth run without anyone changing it. It checked that an unknown username gets the same error as a wrong password, using the fixed name <code>nobody-has-this-name</code>.</p>
<p>The cause was that CardVault counts failed logins for any name, even one that does not exist, and locks it after five. Five earlier runs had each added one failure, so on the sixth run the answer was <code>423 Locked</code> instead of <code>401</code>. The fix was a new name every run:</p>
${code({ title: 'tests/api/tests/test_login.py', src: `
    # A new made-up name every run: failed logins count towards a lockout even
    # for names that do not exist, so a fixed name would be locked after 5 runs.
    unknown_username = f"nobody-{uuid.uuid4().hex[:8]}"
    response = AuthApi().login(unknown_username, "not-the-password")
` })}
<p><code>uuid.uuid4()</code> makes a random ID, <code>.hex</code> writes it as letters and digits, and <code>[:8]</code> keeps the first eight characters. The same idea appears in the idempotency tests, which make a new random key each time.</p>

<h2>Cases in a data file</h2>
<p>Some tests are the same steps with different values: send these contact details, expect this status. When there are many such cases, the values can live in a file instead of the code. This is <strong>data-driven testing</strong>. Anyone can add a case by adding a line, and the file can be reviewed, or even produced, by someone who does not read Python.</p>
${code({ title: 'tests/api/data/contact_details.json', lang: 'json', src: `
[
  {"case": "email with no @", "changes": {"email": "jane.example.com"}, "expected_status": 422},
  {"case": "email with a space", "changes": {"email": "jane doe@example.com"}, "expected_status": 422},
...
  {"case": "phone with 15 digits, the most allowed", "changes": {"phone": "+123456789012345"}, "expected_status": 200},
...
]
` })}
<p>Each line is one case: a readable name, the change to send, and the status the rule says to expect. The cases come from the techniques in <a href="/learn/py-test-design/">Test design techniques</a>. One test reads the file and runs once per case:</p>
${code({ title: 'tests/api/tests/test_profile.py', src: `
# The cases live in a JSON file, so adding one is a new line of data, not a new test.
# Path(__file__).parent is the folder this file is in; ".." goes up one, to tests/api.
CONTACT_CASES_FILE = Path(__file__).parent / ".." / "data" / "contact_details.json"
CONTACT_CASES = json.loads(CONTACT_CASES_FILE.read_text())


# ids= gives each case a readable name in the results, such as [phone without the +].
@pytest.mark.parametrize("case", CONTACT_CASES, ids=[case["case"] for case in CONTACT_CASES])
def test_contact_details_are_checked(case):
    someone = create_logged_in_customer(cards=[])

    response = ProfileApi(someone["token"]).update_profile(case["changes"])

    assert response.status_code == case["expected_status"], response.text
    if case["expected_status"] == 422:
        assert response.json()["error_code"] == "VALIDATION_ERROR"
` })}
<ul>
<li><code>Path</code> comes from <code>pathlib</code>, Python’s module for file paths. <code>/</code> joins parts of a path, so the line builds the path to the JSON file whatever folder pytest was started from.</li>
<li><code>read_text()</code> reads the whole file as text, and <code>json.loads</code> turns that text into Python: here, a list of dictionaries.</li>
<li><code>@pytest.mark.parametrize</code> runs the test once per item in the list. <a href="/learn/py-parametrize/">Many cases with parametrize</a> explains it fully; for now, read it as “for each case in the file”.</li>
<li><code>[case["case"] for case in CONTACT_CASES]</code> is a <strong>list comprehension</strong>: a short way to build a list. It makes the list of names, so a failure reads <code>test_contact_details_are_checked[phone with spaces]</code>.</li>
<li>Each case gets a new customer, because accepted changes really change the profile.</li>
</ul>
<p>JSON suits this suite because Python reads it with no extra library. Teams also use CSV files, which open in a spreadsheet, or YAML. The pattern is the same: the file holds the values, the test holds the steps.</p>

<h2>Files are data too</h2>
<p>Test files live beside the other data: <code>data/files/receipt.png</code> is a real tiny picture, and <code>not_a_picture.png</code> is plain text with a picture’s name. The JSON Schemas in <code>data/schemas.py</code> come later, in <a href="/learn/py-response-shape/">Checking the shape of a response</a>.</p>

${keyIdea('<p>Read from known data, change only your own fresh data, and make any value that the app remembers unique for every run. Then tests do not depend on each other, on their order, or on how many times they have run.</p>')}

${testerEye('<p>When a test passes alone but fails after many runs, or only in a certain order, suspect shared or left-over data before suspecting the app.</p>')}

${interview({
  say: `<p>“Read-only tests use known demo data, with the expected values written down in one data module. Any test that changes state creates its own customer through a set-up API, so tests are isolated and can run in parallel. Values the system remembers, like usernames or idempotency keys, are made unique with a UUID, because I once had a test that failed on its sixth run when a fixed username got locked out.”</p>`,
  qa: [
    ['Where do your expected values come from?', '<p>From requirements and from data I control: the known demo data, or the data the test itself created. Never from copying the current response, because that only proves the app returns what it returned.</p>'],
    ['How do you keep tests from affecting each other?', '<p>Shared data is read-only. Anything that changes state gets fresh data per test, and remembered values are made unique.</p>'],
    ['How do you clean up test data?', '<p>Either delete what you created in a fixture’s tear-down, or use throwaway data that nothing else depends on and let the environment reset clear it. This suite uses throwaway customers, and a <code>yield</code> fixture that logs the shared demo customer out after use.</p>'],
    ['Have you done data-driven testing?', '<p>Yes: the contact-details test reads its cases from a JSON file, each with a name, the input and the expected status, and runs once per case with parametrize. Adding a case is one line of data.</p>'],
  ],
})}
`,
};
