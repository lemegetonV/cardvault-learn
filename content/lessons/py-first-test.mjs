import { code, terminal, interview, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Time to write a real test: log in as alice and check the answer. It is one short file with no framework around it, so every line is visible. Then you will make it fail on purpose and read what pytest tells you.',
  youWill: 'You will be able to write, run and read the result of a pytest test that calls an API.',
  body: `
<h2>Two libraries, two jobs</h2>
<p>A Python API test uses two libraries, which are code other people wrote that you install and import:</p>
<ul>
<li><strong>requests</strong> sends HTTP requests and gives you back the response. It knows nothing about testing.</li>
<li><strong>pytest</strong> is the <strong>test runner</strong>. It finds your tests, runs them, and reports which passed and which failed. It knows nothing about HTTP.</li>
</ul>
<p>You install both once, in a folder with a <strong>virtual environment</strong>: a private set of libraries for this project, so it never clashes with anything else on your computer.</p>
${terminal([
  ['python3 -m venv .venv', ''],
  ['source .venv/bin/activate', ''],
  ['pip install pytest requests', 'Successfully installed pytest-9.2.0 requests-2.34.2 ...'],
], 'Set up once')}

<h2>The test</h2>
<p>CardVault must be running on your computer for this to work. Save this as <code>test_first.py</code>:</p>
${code({ title: 'Example · test_first.py', src: `
import requests


def test_alice_can_log_in():
    response = requests.post(
        "http://localhost:8001/v1/auth/login",
        json={"username": "alice", "password": "CardVault-Demo-1"},
    )

    assert response.status_code == 200
    assert response.json()["token_type"] == "Bearer"
` })}
<p>Line by line:</p>
<ol>
<li><code>import requests</code> makes the requests library available in this file.</li>
<li><code>def test_alice_can_log_in():</code> defines a function. pytest runs every function whose name starts with <code>test_</code>, in every file whose name starts with <code>test_</code>.</li>
<li><code>requests.post(...)</code> sends a POST request to the Login service. The first value is the URL. <code>json=</code> takes a dictionary and sends it as the JSON body, with the right <code>Content-Type</code> header added for you. It returns a <strong>response object</strong>, stored in <code>response</code>.</li>
<li><code>response.status_code</code> is the status code as a number.</li>
<li><code>response.json()</code> turns the JSON body into a dictionary, and <code>["token_type"]</code> picks one value out of it.</li>
</ol>
<p>The blank line in the middle is a habit worth copying. It splits the test into <strong>act</strong> (send the request) and <strong>assert</strong> (check the answer), so you can see at a glance what is being tested.</p>

<h2>Run it</h2>
${terminal([['pytest -v', `============================= test session starts ==============================
collected 1 item

test_first.py::test_alice_can_log_in PASSED                              [100%]

============================== 1 passed in 0.11s ===============================`]], 'Terminal')}
<p><code>-v</code> (verbose) prints one line per test with its result. Without it you get a dot for each passing test.</p>

<h2>Where the expected values come from</h2>
<p>Why expect <code>200</code> and <code>"Bearer"</code>? Not because that is what the app happened to return. They come from the requirements: a correct login succeeds, and the API documentation says the token type is Bearer. And alice’s password is known demo data. A test that copies whatever the app returns today checks nothing.</p>

<h2>Make it fail on purpose</h2>
<p>Change <code>"Bearer"</code> to <code>"bearer"</code> and run it again. This is the real output:</p>
${terminal([['pytest', `test_first.py F                                                          [100%]

=================================== FAILURES ===================================
____________________________ test_alice_can_log_in _____________________________

    def test_alice_can_log_in():
        response = requests.post(
            "http://localhost:8001/v1/auth/login",
            json={"username": "alice", "password": "CardVault-Demo-1"},
        )

        assert response.status_code == 200
>       assert response.json()["token_type"] == "bearer"
E       AssertionError: assert 'Bearer' == 'bearer'
E
E         - bearer
E         ? ^
E         + Bearer
E         ? ^

test_first.py:11: AssertionError
=========================== short test summary info ============================
FAILED test_first.py::test_alice_can_log_in - AssertionError: assert 'Bearer'...
============================== 1 failed in 0.11s ===============================`]], 'Terminal')}
<p>Read a failure from the <code>&gt;</code> down. The <code>&gt;</code> marks the line that failed. The <code>E</code> lines show what was compared: the actual value <code>'Bearer'</code> on the left, your expected <code>'bearer'</code> on the right, with a caret under the first difference. The last line before the summary gives the file and line number.</p>

${keyIdea('<p>A test is a function that sends a request and asserts on the response. pytest finds it by its name, runs it, and on failure shows exactly which values differed.</p>')}

<h2>The second test shows a problem</h2>
<p>Now test that alice can see her cards. Cards needs a token, so the test must log in first:</p>
${code({ title: 'Example · test_first.py', src: `
def test_alice_has_four_cards():
    login = requests.post(
        "http://localhost:8001/v1/auth/login",
        json={"username": "alice", "password": "CardVault-Demo-1"},
    )
    token = login.json()["access_token"]

    response = requests.get(
        "http://localhost:8002/v1/cards",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 4
` })}
<p>It works, but look at what it repeats: the login address, the password, and the whole login call. Fifty tests written this way would have fifty copies of the same addresses and password. If the Cards service moved to another address, you would edit fifty files.</p>

${testerEye('<p>That repetition is exactly why test frameworks exist. The next lesson shows how the CardVault suite moves each repeated piece to one place: addresses into <code>config.py</code>, API calls into client classes, and logging in into a fixture.</p>')}

${interview({
  say: `<p>“My tests use pytest as the runner and the requests library for HTTP. A test is a function named test_ something. It sends a request, then asserts on the status code and the JSON body. The expected values come from the requirements or known test data, never from copying the current response. When a test fails, pytest shows the failing line and a diff of the actual and expected values.”</p>`,
  qa: [
    ['How does pytest find tests?', '<p>By name: files named <code>test_*.py</code> (or <code>*_test.py</code>), and inside them functions named <code>test_*</code>. The folders it searches can be set in <code>pytest.ini</code>.</p>'],
    ['Why use a virtual environment?', '<p>It keeps this project’s libraries and versions separate from other projects and from the system Python, so installing or upgrading something for one project cannot break another.</p>'],
    ['Why did pytest show a diff instead of just “False”?', '<p>pytest rewrites <code>assert</code> statements so that a failure reports the values on both sides of the comparison. That is why plain <code>assert</code> is enough, and no special assertion methods are needed.</p>'],
  ],
})}
`,
};
