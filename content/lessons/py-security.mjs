import { code, interview, keyIdea, testerEye, table, realWorld } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Security testing sounds like a specialist job, and deep penetration testing is. But a handful of security checks belong in every API suite, because they are cheap to write and catch the most common serious flaws. This lesson maps the industry’s top ten list to tests you can write in pytest.',
  youWill: 'You will be able to name the OWASP API Security Top 10 in plain words, and explain the four checks the CardVault suite makes.',
  body: `
<h2>The OWASP API Security Top 10</h2>
<p><strong>OWASP</strong> (the Open Worldwide Application Security Project) is a non-profit that publishes widely used security guidance. Its API Security Top 10, last updated in 2023, lists the most common serious API flaws. In plain words:</p>
${table(['#', 'Name', 'In plain words'], [
  ['1', 'Broken object level authorisation', 'I can reach someone else’s record by changing an ID'],
  ['2', 'Broken authentication', 'Logging in or tokens can be faked, guessed or reused'],
  ['3', 'Broken object property level authorisation', 'I can read or set fields I should not, such as “verified”'],
  ['4', 'Unrestricted resource consumption', 'Nothing stops me sending huge or endless requests'],
  ['5', 'Broken function level authorisation', 'An ordinary user can call admin actions'],
  ['6', 'Unrestricted access to sensitive business flows', 'A flow can be automated and abused, such as buying all the tickets'],
  ['7', 'Server-side request forgery', 'I can make the server fetch a URL of my choosing'],
  ['8', 'Security misconfiguration', 'Debug pages, missing headers, default settings left on'],
  ['9', 'Improper inventory management', 'Old or forgotten API versions are still running'],
  ['10', 'Unsafe consumption of APIs', 'The API trusts data from other services without checking it'],
])}
<p>Numbers 1 to 4 are the ones an API test suite can check directly. The CardVault suite has a test for each.</p>

<h2>1. Someone else’s record</h2>
<p>This flaw is also called <strong>BOLA</strong> or <strong>IDOR</strong> (insecure direct object reference). It is number one because every endpoint that takes an ID must check ownership itself. <a href="/learn/py-auth/">Authentication and authorisation</a> showed the test: two real customers, one trying to change the other’s card, and a check that nothing changed. The suite repeats it for reading a card and for the wallet.</p>

<h2>2. Faked tokens</h2>
${code({ title: 'tests/api/tests/test_security.py', src: `
def test_a_token_with_a_changed_signature_is_refused(alice_token):
    # The last part of a token is its signature. Changing one character there
    # must make the token worthless, or anyone could forge one.
    if alice_token.endswith("A"):
        tampered = alice_token[:-1] + "B"
    else:
        tampered = alice_token[:-1] + "A"

    response = CardsApi(tampered).list_cards()

    assert response.status_code == 401
` })}
<p><code>alice_token[:-1]</code> is the token without its last character, a <strong>slice</strong>. The <code>if</code> makes sure the new last character really is different. Other authentication tests in the suite: no token, a made-up token, a reused refresh token, a lockout after five wrong passwords, and the same error for an unknown username as for a wrong password, so that nobody can find out which usernames exist.</p>

<h2>3. Setting a field you should not</h2>
${code({ title: 'tests/api/tests/test_security.py', src: `
def test_customer_cannot_mark_their_own_email_as_verified():
    # Sending a field the customer may not set, hoping the service saves it,
    # is called mass assignment. The service must ignore it.
    someone = create_logged_in_customer(cards=[], email_verified=False)
    profile_api = ProfileApi(someone["token"])

    response = profile_api.update_profile({"email_verified": True})

    assert response.status_code == 200
    assert profile_api.get_profile().json()["email_verified"] is False
` })}
<p>If this worked, a customer could skip email verification and get past a wallet rule. The test reads the profile back to prove the flag did not change.</p>

<h2>4. Limits on what one caller can ask for</h2>
<p>Two tests check limits. Asking for a page of 101 cards is refused, because the documented maximum is 100. Asking for a second verification code within 30 seconds gets <code>429 Too Many Requests</code>. Both are in <a href="/learn/py-api-behaviours/">the next lesson</a>.</p>

<h2>What else a security-minded tester tries</h2>
<ul>
<li><strong>Injection</strong>: text such as <code>' OR 1=1 --</code> or <code>&lt;script&gt;</code> in every text field, checking it is stored and shown as plain text and never run.</li>
<li><strong>Error leaks</strong>: errors must not reveal stack traces, SQL or internal hostnames. CardVault errors carry only a code, a message, a correlation ID and sometimes a few safe details, such as how long to wait.</li>
<li><strong>Sensitive data</strong>: card numbers appear only as the last four digits in every response.</li>
</ul>

${keyIdea('<p>Every API suite should check four things: one user cannot reach another’s data, forged or reused credentials fail, protected fields cannot be set, and there are limits on what one caller can ask for.</p>')}

${realWorld('<p>Banks add specialist testing on top: penetration tests by outside experts, automated scanners such as OWASP ZAP in the pipeline, and code reviews focused on security. Functional security tests in the suite catch regressions between those reviews.</p>')}

${testerEye('<p>Write security tests the same way as any other: one clear claim, a known starting state, and a check of the result. The difference is only the point of view: you are the attacker.</p>')}

${interview({
  say: `<p>“I map the OWASP API Top 10 to functional tests. For object-level authorisation I use two real customers and check that one gets 404 on the other’s card and that nothing changed. For authentication, tampered, missing and reused tokens and account lockout. For property-level authorisation, a mass-assignment test that tries to set email_verified. And for resource limits, a maximum page size and a rate limit. Deeper testing like scanning and pen tests sits on top.”</p>`,
  qa: [
    ['What is BOLA or IDOR, and how do you test it?', '<p>Reaching another user’s object by changing its ID in the request. Log in as two users, have one request the other’s resource, and check for 403 or 404 and that nothing changed.</p>'],
    ['What is mass assignment?', '<p>Sending extra fields the user may not set, such as a role or a verified flag, hoping the server saves them. The test sends one and reads the record back to confirm it was ignored.</p>'],
    ['Why should an unknown username get the same error as a wrong password?', '<p>Different errors would let an attacker find out which usernames exist, which makes guessing passwords much easier.</p>'],
  ],
})}
`,
};
