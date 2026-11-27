import { code, interview, keyIdea, testerEye, task, reveal } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'A second kind of live coding task gives you a response body and asks you to pull something out of it: the cards running low, a total, a count per status. It tests whether you can work with lists and dictionaries without a framework to lean on. This lesson has four short tasks on CardVault-shaped data, each with a hint and a model solution, and the Python each one needs.',
  youWill: 'You will be able to filter, total, count and search lists of dictionaries in plain Python, collect every page of a paged API, and talk through each step.',
  body: `
<h2>The data</h2>
<p>An API answer in JSON becomes Python lists and dictionaries after <code>response.json()</code>. Here is a shortened copy of alice’s card list, with the fields the tasks need. Amounts are in cents, so <code>50000</code> is $500.00.</p>
${code({ title: 'Example · the cards response', src: `
cards_response = {
    "items": [
        {"card_id": "c1", "product": "PREPAID", "last4": "5521", "status": "ACTIVE", "limit": 50000, "available": 50000},
        {"card_id": "c2", "product": "CREDIT", "last4": "7380", "status": "ACTIVE", "limit": 300000, "available": 300000},
        {"card_id": "c3", "product": "DEBIT", "last4": "2045", "status": "ACTIVE", "limit": 250000, "available": 157928},
        {"card_id": "c4", "product": "CREDIT", "last4": "4417", "status": "ACTIVE", "limit": 500000, "available": 137974},
    ],
    "next_cursor": None,
}
` })}
<p>The real response has more fields, such as <code>expiry</code> and <code>currency</code>, and real IDs. The limits and amounts are alice’s real ones in a freshly set-up CardVault.</p>

<h2>Task 1: cards running low</h2>
${task(`<p>Write <code>cards_running_low(cards)</code>. It takes the list in <code>cards_response["items"]</code> and returns the <code>last4</code> of every card with less than half its limit available. For alice’s cards the answer is <code>["4417"]</code>.</p>`)}
${reveal('Hint', `<p>Start with an empty list, loop over the cards, and <code>append</code> the ones that match. Compare <code>card["available"]</code> with <code>card["limit"] / 2</code>.</p>`)}
${reveal('A model solution', `${code({ title: 'Example · task 1', src: `
def cards_running_low(cards):
    low = []
    for card in cards:
        if card["available"] < card["limit"] / 2:
            low.append(card["last4"])
    return low


def test_cards_running_low():
    assert cards_running_low(cards_response["items"]) == ["4417"]
` })}
<p>Card 2045 has $1,579.28 of $2,500.00 left, more than half; 4417 has $1,379.74 of $5,000.00, less than half. Once the loop works, you can offer the shorter form, a <a href="/learn/py-api-behaviours/">list comprehension</a>, which builds the same list in one line:</p>
${code({ title: 'Example · task 1, shorter', src: `
def cards_running_low(cards):
    return [card["last4"] for card in cards if card["available"] < card["limit"] / 2]
` })}
<p>Write the loop first in an interview. It is easier to talk through and to fix, and turning it into a comprehension afterwards shows you know both.</p>`, 'solution')}

<h2>Task 2: a total, shown as money</h2>
${task(`<p>Write <code>total_available_text(cards)</code>: the total available across all cards, as text like <code>"$6,459.02"</code>.</p>`)}
${reveal('Hint', `<p><code>sum(...)</code> adds up numbers. Divide the cents by 100, then format with an f-string: <code>f"{value:,.2f}"</code> adds thousands commas and two decimal places.</p>`)}
${reveal('A model solution', `${code({ title: 'Example · task 2', src: `
def total_available_text(cards):
    total_cents = sum(card["available"] for card in cards)
    return f"\${total_cents / 100:,.2f}"


def test_total_available():
    assert total_available_text(cards_response["items"]) == "$6,459.02"
` })}
<ul>
<li><code>sum(card["available"] for card in cards)</code> adds the <code>available</code> of every card: 50000 + 300000 + 157928 + 137974 = 645902 cents.</li>
<li>Inside the f-string, <code>:,.2f</code> means “commas between thousands, two digits after the point”. The <code>$</code> before the braces is plain text.</li>
<li>Money stays in whole cents until the last moment, so no rounding creeps in. A good point to mention: never add up money as decimal fractions.</li>
</ul>`, 'solution')}

<h2>Task 3: transactions</h2>
${task(`<p>Given this list, write three functions: the total of <code>SETTLED</code> amounts, a count per status as a dictionary, and the largest purchase that was not declined.</p>
${code({ title: 'Example · transactions', src: `
transactions = [
    {"txn_id": "t1", "card_id": "c4", "merchant_name": "Corner Bakery", "status": "SETTLED", "amount": 1250},
    {"txn_id": "t2", "card_id": "c3", "merchant_name": "City Books", "status": "SETTLED", "amount": 3999},
    {"txn_id": "t3", "card_id": "c4", "merchant_name": "Corner Bakery", "status": "DECLINED", "amount": 52000},
    {"txn_id": "t4", "card_id": "c3", "merchant_name": "Green Grocer", "status": "AUTHORIZED", "amount": 2475},
    {"txn_id": "t5", "card_id": "c4", "merchant_name": "Metro Rail", "status": "SETTLED", "amount": 300},
    {"txn_id": "t6", "card_id": "c3", "merchant_name": "Green Grocer", "status": "REFUNDED", "amount": 1500},
]
` })}
<p>The field names and statuses are CardVault’s; the values are made up for the exercise.</p>`)}
${reveal('Hint', `<p>For the count, start with an empty dictionary and add 1 to the entry for each status. <code>counts.get(status, 0)</code> gives the current count, or 0 the first time. For the largest, Python’s <code>max</code> takes a <code>key</code> that says what to compare.</p>`)}
${reveal('A model solution', `${code({ title: 'Example · task 3', src: `
def total_settled(transactions):
    total = 0
    for txn in transactions:
        if txn["status"] == "SETTLED":
            total += txn["amount"]
    return total


def count_by_status(transactions):
    counts = {}
    for txn in transactions:
        status = txn["status"]
        counts[status] = counts.get(status, 0) + 1
    return counts


def largest_purchase(transactions):
    not_declined = [txn for txn in transactions if txn["status"] != "DECLINED"]
    return max(not_declined, key=lambda txn: txn["amount"])


def test_transactions():
    assert total_settled(transactions) == 5549
    assert count_by_status(transactions) == {"SETTLED": 3, "DECLINED": 1, "AUTHORIZED": 1, "REFUNDED": 1}
    assert largest_purchase(transactions)["txn_id"] == "t2"
` })}
<ul>
<li><code>total += txn["amount"]</code> is short for <code>total = total + txn["amount"]</code>.</li>
<li><code>lambda txn: txn["amount"]</code> is a tiny function without a name: given a transaction, return its amount. <code>max</code> calls it on each item and returns the item with the biggest result, the whole dictionary, not just the number.</li>
<li>The declined $520.00 attempt, t3, is left out on purpose. Ask whether “largest purchase” should include declined ones: clarifying the requirement is part of the task.</li>
<li>Two dictionaries are equal when they hold the same keys and values, in any order, which is why the count can be checked in one line.</li>
</ul>`, 'solution')}

<h2>Task 4: every page, from the real API</h2>
${task(`<p>The card list is paged: <code>CardsApi(token).list_cards(limit=..., cursor=...)</code> returns at most <code>limit</code> cards and a <code>next_cursor</code>, which is <code>None</code> on the last page. Write <code>get_all_cards(cards_api, page_size)</code> that follows the pages and returns every card, and a test that fetches alice’s cards one per page and checks all four come back.</p>`)}
${reveal('Hint', `<p>You do not know in advance how many pages there are, so use a <code>while True:</code> loop that stops with <code>return</code> when <code>next_cursor</code> is <code>None</code>. <code>list.extend(...)</code> adds every item of one list to another.</p>`)}
${reveal('A model solution', `${code({ title: 'Example · tests/test_paging_practice.py', src: `
from api.cards_api import CardsApi
from data.demo_customers import ALICE


def get_all_cards(cards_api, page_size):
    all_cards = []
    cursor = None
    while True:
        page = cards_api.list_cards(limit=page_size, cursor=cursor).json()
        all_cards.extend(page["items"])
        cursor = page["next_cursor"]
        if cursor is None:
            return all_cards


def test_paging_through_alices_cards_finds_all_four(alice_token):
    cards = get_all_cards(CardsApi(alice_token), page_size=1)

    last4s = [card["last4"] for card in cards]
    assert len(last4s) == 4
    assert sorted(last4s) == sorted(ALICE["cards"])
` })}
<ul>
<li>The first request has no cursor (<code>None</code>), which means “start at the beginning”.</li>
<li>A page size of 1 makes four pages, so the loop and the stop condition are really exercised.</li>
<li>Checking the length as well as the set of last4s catches a card returned twice.</li>
<li>With more time, say you would add a safety limit on the number of pages, so a bug that never returns <code>None</code> fails the test instead of looping for ever.</li>
</ul>
<p>This test passes against CardVault running locally, and so do the solutions to tasks 1 to 3.</p>`, 'solution')}

<h2>A word on type hints</h2>
<p>Some interviewers write function signatures with <strong>type hints</strong>, which say what kind of value goes in and comes out:</p>
${code({ title: 'Example · task 1 with type hints', src: `
def cards_running_low(cards: list[dict]) -> list[str]:
    ...
` })}
<p>Read it as “takes a list of dictionaries, returns a list of strings”. Python does not check hints when the code runs; editors and tools such as mypy use them to spot mistakes. The CardVault suite leaves them out to keep the code short for beginners, which is a choice, not a rule.</p>

${keyIdea('<p>Most response-data tasks are a loop with a condition: filter into a new list, add up into a total, count into a dictionary, or keep the best so far. Write the plain loop first, check it with an <code>assert</code>, and ask about unclear requirements before choosing.</p>')}

${testerEye('<p>The same skills write better assertions. Instead of checking only the first item of a list, a test can check every item, or count items by status, with a few lines of plain Python.</p>')}

${interview({
  say: `<p>“For data tasks I start with the plain loop, because it is easy to explain and debug: an empty list or dictionary, a for loop, a condition. Once it works I might shorten it with a list comprehension, <code>sum</code> or <code>max</code> with a key. I keep money in integer cents until I format it, and I ask about edge cases, such as whether declined transactions count, before deciding.”</p>`,
  qa: [
    ['How do you count how many items have each status?', '<p>Loop over the items and keep a dictionary: <code>counts[status] = counts.get(status, 0) + 1</code>. <code>collections.Counter</code> does the same in one line, which is worth mentioning once the loop is written.</p>'],
    ['How do you get every page from a paged API?', '<p>Loop: request a page, add its items, read the next cursor, and stop when there is none. Add a maximum number of pages so a bug cannot cause an endless loop.</p>'],
    ['Why keep money in cents?', '<p>Decimal fractions such as 0.1 cannot be stored exactly in floating point, so adding them drifts. Whole cents are exact; divide by 100 only for display.</p>'],
  ],
})}
`,
};
