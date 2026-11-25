import { code, terminal, interview, table, keyIdea } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'API tests in Python use only a small part of the language. This lesson teaches exactly that part, with examples taken from the CardVault tests you will read later. No earlier Python is needed.',
  youWill: 'You will be able to read the variables, lists, dictionaries, functions, loops and asserts used in the test suite.',
  body: `
<h2>Running Python</h2>
<p>Python is a programming language that reads almost like English. You write code in a file ending in <code>.py</code> and run it with the <code>python3</code> command. Everything after a <code>#</code> on a line is a <strong>comment</strong>: a note for people, ignored by Python.</p>
${terminal([['python3 hello.py', 'Hello, alice']], 'Running a file')}

<h2>Variables and values</h2>
<p>A <strong>variable</strong> is a name for a value. You create one with <code>=</code>. Python works out the kind of value by itself, so there is nothing to declare.</p>
${code({ title: 'Example', src: `
username = "alice"          # text, called a string (str)
amount = 2500               # a whole number (int): $25.00 in cents
eligible = True             # True or False (bool)
reason = None               # "no value" (None)

message = f"{username} spent {amount} cents"   # an f-string fills in the {names}
print(message)              # alice spent 2500 cents
` })}
<p>The <strong>f-string</strong> on the second-last line is how the suite builds web addresses: <code>f"{self.base_url}/v1/cards/{card_id}"</code> puts the base address and a card ID into one piece of text.</p>

<h2>Lists: several values in order</h2>
<p>A <strong>list</strong> holds values in order, inside square brackets. You count positions from 0, so <code>[0]</code> is the first item.</p>
${code({ title: 'Example', src: `
wallet_cards = ["4417", "2045"]

print(wallet_cards[0])      # 4417  (the first item)
print(len(wallet_cards))    # 2     (how many items)
wallet_cards.append("7380") # add one at the end
` })}

<h2>Dictionaries: values with names</h2>
<p>A <strong>dictionary</strong> (dict) stores values under names called <strong>keys</strong>, inside curly brackets. This is the most important type for API testing, because a JSON response from an API becomes a dictionary in Python.</p>
${code({ title: 'Example', src: `
card = {"last4": "4417", "product": "CREDIT", "available": 297500}

print(card["product"])      # CREDIT
card["status"] = "LOST"     # add or change a key
print("limit" in card)      # False: there is no "limit" key
` })}
<p>Dictionaries and lists nest inside each other. A list of cards is a list of dictionaries, so <code>cards[0]["last4"]</code> means “the last4 of the first card”. You will read lines like that in almost every test.</p>

<h2>Making decisions and repeating</h2>
<p><code>if</code> runs code only when something is true. <code>for</code> runs code once for each item in a list. The lines that belong to them are <strong>indented</strong> by four spaces. Python uses indentation instead of brackets, so it matters.</p>
${code({ title: 'Example', src: `
for card in cards:                      # once for each card in the list
    if card["status"] == "ACTIVE":      # == compares; = assigns
        print(card["last4"], "is active")
` })}

<h2>Functions: named, reusable steps</h2>
<p>A <strong>function</strong> is a named block of code you can run again and again. <code>def</code> creates it, the names in brackets are its <strong>parameters</strong> (the inputs), and <code>return</code> hands back a result. A parameter with <code>=</code> has a <strong>default value</strong>, used when the caller leaves it out.</p>
${code({ title: 'Example', src: `
def dollars(cents, symbol="$"):
    return f"{symbol}{cents / 100:.2f}"

print(dollars(2500))        # $25.00
print(dollars(2500, "€"))   # €25.00
` })}
<p>Every pytest test is just a function whose name starts with <code>test_</code>.</p>

<h2>Using code from elsewhere</h2>
<p><code>import</code> brings in code from another file or library. The suite imports the <code>requests</code> library to send HTTP requests, and its own files such as <code>config.py</code>.</p>
${code({ title: 'Example', src: `
import requests                         # a whole library
import config                           # our own config.py
from api.cards_api import CardsApi      # one name from api/cards_api.py
` })}

<h2>Checking with assert</h2>
<p><code>assert</code> is the heart of every test. It checks that something is true. If it is, nothing happens and the test carries on. If not, the test stops and fails with an <code>AssertionError</code>.</p>
${code({ title: 'Example', src: `
assert response.status_code == 200
assert card["available"] <= card["limit"]
assert "Contoso Books" in csv_line
assert wallet_card["eligible"] is False   # "is" is used for True, False and None
` })}

${keyIdea('<p>Most of an API test is: send a request, turn the JSON answer into a dictionary, pick values out with <code>["key"]</code>, and check them with <code>assert</code>.</p>')}

<h2>The whole toolkit on one page</h2>
${table(['You see', 'It means'], [
  ['`x = 5`', 'Store 5 under the name x'],
  ['`"text"`, `f"Hi {name}"`', 'A string; an f-string fills in names'],
  ['`[a, b]`, `items[0]`', 'A list; its first item'],
  ['`{"k": v}`, `d["k"]`', 'A dictionary; the value under "k"'],
  ['`if ...:` / `for x in items:`', 'Decide / repeat; the indented lines belong to it'],
  ['`def name(a, b=1):` / `return`', 'Define a function; hand back a result'],
  ['`import x` / `from x import y`', 'Use code from another file or library'],
  ['`assert condition`', 'Fail the test unless the condition is true'],
])}
<p>Classes, which group functions together, appear in the lesson on <a href="/learn/py-api-clients/">API client classes</a>.</p>

${interview({
  say: `<p>“In my API tests I mostly use dictionaries, because JSON responses map straight onto them, along with lists, f-strings to build URLs, and plain functions. Tests are pytest functions that use the plain assert statement, and pytest shows a detailed difference when one fails.”</p>`,
  qa: [
    ['What is the difference between a list and a dictionary?', '<p>A list keeps values in order and you get them by position, such as <code>items[0]</code>. A dictionary stores values under keys and you get them by name, such as <code>card["status"]</code>. A JSON array becomes a list, and a JSON object becomes a dictionary.</p>'],
    ['What is the difference between == and is?', '<p><code>==</code> checks whether two values are equal. <code>is</code> checks whether they are the very same object, which is the right way to compare with <code>None</code>, <code>True</code> and <code>False</code>.</p>'],
    ['Why does indentation matter in Python?', '<p>Python uses indentation to decide which lines belong to an <code>if</code>, a <code>for</code> or a function. Wrongly indented code either fails to run or runs at the wrong time.</p>'],
  ],
})}
`,
};
