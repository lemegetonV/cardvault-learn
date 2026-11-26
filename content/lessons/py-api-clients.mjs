import { code, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'Each CardVault service gets one small Python class in the api/ folder. A test asks the class to make a call, and the class builds the URL, headers and body. This lesson teaches the Python behind a class, then reads the Cards client line by line.',
  youWill: 'You will be able to read a client class, explain why the suite wraps each service this way, and send query parameters, headers, JSON, forms and files with requests.',
  body: `
<h2>Classes in five minutes</h2>
<p>A <strong>class</strong> is a blueprint that bundles some data with the functions that use it. You make an <strong>object</strong> (an instance) from it by calling it like a function. Functions inside a class are called <strong>methods</strong>.</p>
${code({ title: 'Example · a tiny class', src: `
class Greeter:
    def __init__(self, name):
        self.name = name            # store the name on this object

    def hello(self):
        return f"Hello, {self.name}"


greeter = Greeter("alice")          # runs __init__ with name="alice"
print(greeter.hello())              # Hello, alice
` })}
<ul>
<li><code>__init__</code> runs once, when the object is made. It sets up the object’s data.</li>
<li><code>self</code> is the object itself. <code>self.name = name</code> stores a value on it, so every method can read <code>self.name</code> later. Python passes <code>self</code> in for you: you call <code>greeter.hello()</code>, not <code>greeter.hello(greeter)</code>.</li>
</ul>

<h2>The Cards client</h2>
${code({ title: 'tests/api/api/cards_api.py', src: `
class CardsApi:
    def __init__(self, token):
        self.base_url = config.CARD_URL
        self.headers = {"Authorization": f"Bearer {token}"}
...
    def get_card(self, card_id):
        return requests.get(
            f"{self.base_url}/v1/cards/{card_id}", headers=self.headers, timeout=config.TIMEOUT
        )
...
    def close(self, card_id):
        return requests.post(
            f"{self.base_url}/v1/cards/{card_id}/close",
            headers=self.headers,
            timeout=config.TIMEOUT,
        )
` })}
<ul>
<li>The client is made with a customer’s token. <code>__init__</code> stores the service address from <a href="/learn/py-config/">config.py</a> and the <code>Authorization</code> header, so no method repeats them.</li>
<li>Each method makes exactly one API call and <strong>returns the whole response</strong>. It does not check anything. Checking is the test’s job, so a test can look at the status code of a refusal as easily as at the body of a success.</li>
<li>Method names say what the customer does (<code>close</code>), not how HTTP does it (<code>POST /v1/cards/{id}/close</code>).</li>
</ul>
<p>A test then reads like a sentence: <code>CardsApi(token).close(card_id)</code>.</p>

<h2>What a request can carry</h2>
<p>The clients use every common way of sending data with requests. Each is one keyword argument:</p>
${table(['Keyword', 'What it sends', 'Where the suite uses it'], [
  ['`params=`', 'Query parameters after the `?`', 'Filtering transactions by status; a page size for cards'],
  ['`headers=`', 'Headers', 'The token on every call; an idempotency key'],
  ['`json=`', 'A JSON body, from a dictionary', 'Login, adding a card, profile changes'],
  ['`data=`', 'A form, like a web page form', 'Opening a dispute'],
  ['`files=`', 'A file upload, sent with the form', 'A receipt picture with a dispute'],
])}

<h2>Sending a form and a file</h2>
<p>A dispute is the one call that is not JSON. The customer fills in a form and may attach a receipt, so the client sends both:</p>
${code({ title: 'tests/api/api/transactions_api.py', src: `
    def open_dispute(self, txn_id, reason, note=None, receipt_file=None):
...
        form = {"reason": reason}
        if note:
            form["note"] = note
        files = {}
        if receipt_file:
            files["receipt"] = receipt_file
        return requests.post(
            f"{self.base_url}/v1/wallet/transactions/{txn_id}/disputes",
            data=form,
            files=files,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )
` })}
<p><code>note=None</code> and <code>receipt_file=None</code> make both optional. The test opens the file and passes it in:</p>
${code({ title: 'tests/api/tests/test_transactions.py', src: `
    # "with" opens the file and closes it again when the block ends. "rb" means read bytes.
    with open(FILES_FOLDER / "receipt.png", "rb") as receipt:
        response = transactions_api.open_dispute(
            txn_id, reason="WRONG_AMOUNT", receipt_file=receipt
        )
` })}

<h2>Downloading a file</h2>
<p>The CSV export answers with text, not JSON. So the test reads <code>response.text</code> instead of <code>response.json()</code>, and splits it into lines:</p>
${code({ title: 'tests/api/tests/test_transactions.py', src: `
    assert response.headers["Content-Type"].startswith("text/csv")
    lines = response.text.strip().split("\\n")
    assert lines[0].startswith("txn_id,")  # the header row
` })}
<p><code>strip()</code> removes the line break at the very end, and <code>split("\\n")</code> cuts the text at every line break, giving a list of lines. The first check makes sure the service really sent a CSV file.</p>

<h2>When the answer is not JSON</h2>
<p>If a body is not JSON, for example an error page from a proxy, <code>response.json()</code> raises an error and the test stops with a confusing message. Python’s <code>try</code> and <code>except</code> let you catch an error and say something clearer:</p>
${code({ title: 'Example · try and except', src: `
try:
    body = response.json()
except ValueError:
    raise AssertionError(f"Expected JSON, got: {response.text[:200]}")
` })}
<p>The code under <code>try</code> runs. If it raises a <code>ValueError</code>, Python jumps to the <code>except</code> block instead of stopping. The suite does not need this today, because CardVault always answers with JSON, but it is a common question.</p>

${keyIdea('<p>One class per service, one method per call. The class knows the address, headers and body format. The method returns the raw response. The test decides what to check.</p>')}

${testerEye('<p>This pattern is often called the <strong>API object</strong> or <strong>service object</strong> pattern. It is the API version of the page object pattern you will meet in the Playwright track.</p>')}

${interview({
  say: `<p>“Each microservice has a client class. Its constructor takes the token and reads the base URL from config, and each method wraps one endpoint with requests and returns the raw response. Keeping assertions out of the clients means a test can check a 404 or a 422 as easily as a 200. The clients cover JSON bodies, query parameters, form posts with a file upload, and a CSV download.”</p>`,
  qa: [
    ['Why not put asserts inside the client methods?', '<p>Because the same call is expected to succeed in one test and fail in another. If the client asserted 200, negative tests could not use it. The client sends; the test judges.</p>'],
    ['What is self?', '<p>The object a method is called on. Python passes it in automatically, and the method uses it to reach the object’s data, such as <code>self.headers</code>.</p>'],
    ['How do you upload a file with requests?', '<p>Open the file in binary mode and pass it in <code>files=</code>, for example <code>files={"receipt": open_file}</code>, usually alongside form fields in <code>data=</code>. requests builds the multipart request.</p>'],
  ],
})}
`,
};
