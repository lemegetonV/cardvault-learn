import { code, interview, keyIdea, testerEye, table, tryIt } from '../../src/components.mjs';

export default {
  minutes: 14,
  lede: 'Most real APIs share four behaviours: long lists come back in pages, a request can be repeated safely, an update cannot silently overwrite someone else’s change, and callers who ask too often are slowed down. CardVault has all four, and each needs its own kind of test.',
  youWill: 'You will be able to explain pagination, idempotency keys, version checks with If-Match, and rate limits, and how the suite tests each.',
  body: `
<h2>Four behaviours at a glance</h2>
${table(['Behaviour', 'The problem', 'CardVault’s answer', 'Status when refused'], [
  ['Pagination', 'A list of 10,000 items is too big for one answer', 'Pages of up to 100, with a cursor for the next page', '`422` for a page size over 100'],
  ['Idempotency', 'A timeout leaves the caller unsure; repeating might act twice', 'An `Idempotency-Key` header: the same key replays the first answer', '`422` for a key reused on a different request'],
  ['Version checks', 'Two people edit at once; the second save wipes the first', 'An `If-Match` header with the version you read', '`412 Precondition Failed`'],
  ['Rate limits', 'One caller floods a service, or spams codes', 'At most one verification code every 30 seconds', '`429 Too Many Requests`'],
])}

<h2>Pagination</h2>
<p>The card list answers with <code>items</code> and a <code>next_cursor</code>. A <strong>cursor</strong> is an opaque marker for “where you got to”. Send it back to get the next page; when it is <code>null</code> there are no more.</p>
${code({ title: 'tests/api/tests/test_api_behaviours.py', src: `
def test_pages_of_two_cards_cover_all_of_alices_cards(alice_token):
    cards_api = CardsApi(alice_token)

    first_page = cards_api.list_cards(limit=2).json()
    second_page = cards_api.list_cards(limit=2, cursor=first_page["next_cursor"]).json()

    assert len(first_page["items"]) == 2
    assert len(second_page["items"]) == 2
    # No more pages after the last one.
    assert second_page["next_cursor"] is None
    # Together the pages hold each card exactly once.
    last4s = [card["last4"] for card in first_page["items"] + second_page["items"]]
    assert sorted(last4s) == sorted(ALICE["cards"])
` })}
<p>The last two lines are the important ones: no card is lost or repeated between pages. The square brackets build a list from a loop, a <strong>list comprehension</strong>: “the last4 of every card in both pages”. <code>sorted(ALICE["cards"])</code> sorts the keys of the dictionary, the four last4s.</p>
<p>You can walk the same pages on the live app. Request 2 saves the <code>next_cursor</code> it gets back as <code>{{cursor}}</code>, and request 3 sends it back.</p>
${tryIt({ requests: [
  { label: 'Log in as alice', method: 'POST', service: 'auth', path: '/v1/auth/login', body: { username: 'alice', password: 'CardVault-Demo-1' } },
  { label: 'The first page of two cards', note: 'Two cards in `items`, and a `next_cursor` that is not null.', method: 'GET', service: 'cards', path: '/v1/cards?limit=2', headers: { Authorization: 'Bearer {{token}}' }, save: { cursor: 'next_cursor' } },
  { label: 'The next page', note: 'The other two cards, and `next_cursor` is `null`: this was the last page.', method: 'GET', service: 'cards', path: '/v1/cards?limit=2&cursor={{cursor}}', headers: { Authorization: 'Bearer {{token}}' } },
  { label: 'A page size above the maximum', note: 'The most one page may hold is 100, so this gets `422` with `VALIDATION_ERROR`.', method: 'GET', service: 'cards', path: '/v1/cards?limit=101', headers: { Authorization: 'Bearer {{token}}' } },
] })}

<h2>Idempotency keys</h2>
<p>An action is <strong>idempotent</strong> when doing it twice has the same effect as doing it once. A network timeout leaves a caller unsure whether its request arrived. With a unique key in a header, the caller can simply send it again:</p>
${code({ title: 'tests/api/tests/test_api_behaviours.py', src: `
def test_repeating_a_request_with_the_same_key_replays_the_first_answer(customer):
    cards_api = CardsApi(customer["token"])
    card_id = customer["wallet_card"]["card_id"]
    key = str(uuid.uuid4())  # a new random key, so no other test uses it

    first = cards_api.report_lost(card_id, idempotency_key=key)
    second = cards_api.report_lost(card_id, idempotency_key=key)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    # This header shows the service replayed its answer instead of acting again.
    assert second.headers["Idempotent-Replayed"] == "true"
` })}
<p>A second test reuses the same key for a different card and expects <code>422 IDEMPOTENCY_KEY_REUSED</code>, because one key must mean one request.</p>

<h2>Version checks with If-Match</h2>
<p>The profile carries a <code>version</code> number that goes up with each change. A client sends the version it last read in the <code>If-Match</code> header, and the service refuses the update if the profile has changed since:</p>
${code({ title: 'tests/api/tests/test_api_behaviours.py', src: `
def test_an_update_based_on_an_old_version_is_refused():
    someone = create_logged_in_customer(cards=[])
    profile_api = ProfileApi(someone["token"])
    old_version = profile_api.get_profile().json()["version"]
    # Someone else changes the profile first (for example in another browser tab).
    profile_api.update_profile({"email": "first-change@example.com"})

    response = profile_api.update_profile(
        {"email": "second-change@example.com"}, version=old_version
    )

    assert response.status_code == 412
    assert response.json()["error_code"] == "VERSION_MISMATCH"
    assert profile_api.get_profile().json()["email"] == "first-change@example.com"
` })}
<p>This is called <strong>optimistic locking</strong>: nobody is blocked while editing, and a conflict is caught at save time. The profile also sends the version as an <code>ETag</code> header, the standard HTTP name for “a tag for this version of the resource”. A partner test sends the current version and expects success and <code>version + 1</code>.</p>

<h2>Rate limits</h2>
${code({ title: 'tests/api/tests/test_api_behaviours.py', src: `
def test_asking_for_a_second_code_too_soon_is_refused():
    someone = create_logged_in_customer(cards=[], email_verified=False)
    profile_api = ProfileApi(someone["token"])
    profile_api.send_code("EMAIL")

    response = profile_api.send_code("EMAIL")

    # 429 Too Many Requests. The body says how long to wait before asking again.
    assert response.status_code == 429
    assert response.json()["error_code"] == "OTP_COOLDOWN"
    assert response.json()["details"]["retry_after_seconds"] > 0
` })}
<p>A well-behaved client waits the number of seconds the error gives, then tries again. Testing what happens after the wait would need a 30-second pause, so the suite does not; that is a deliberate gap.</p>

${keyIdea('<p>Pagination: no item lost or repeated across pages. Idempotency: the same key replays, a reused key on a new request fails. Version checks: a stale version gets 412 and changes nothing. Rate limits: too soon gets 429 with a time to wait.</p>')}

${testerEye('<p>For each behaviour, test both sides: the allowed case and the refused one, and check that a refusal changed nothing.</p>')}

${interview({
  say: `<p>“Beyond CRUD I test the cross-cutting behaviours. For cursor pagination I walk all pages and check nothing is lost or duplicated, plus the page-size limit. For idempotency I send the same Idempotency-Key twice and check the replayed answer, and that a key reused on a different request is rejected. For concurrency, an If-Match with a stale version must get 412 and change nothing. And rate limits must return 429 with a retry-after value.”</p>`,
  qa: [
    ['Cursor or offset pagination?', '<p>Offset (page 3 of 20) is simple but can skip or repeat items when data changes between requests. A cursor marks the last item seen, so pages stay consistent. CardVault uses cursors.</p>'],
    ['Which HTTP methods are idempotent?', '<p>By definition GET, PUT and DELETE are; POST is not. That is why APIs add idempotency keys to POST actions such as payments.</p>'],
    ['What is optimistic locking?', '<p>Each record carries a version. An update must send the version it was based on, and the server rejects it with 412 or 409 if the record changed since, instead of overwriting.</p>'],
  ],
})}
`,
};
