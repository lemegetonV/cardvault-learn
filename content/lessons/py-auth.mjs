import { code, interview, keyIdea, testerEye, table, sequence } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Two questions guard every API call: who are you, and are you allowed to do this? They sound alike, interviewers love to ask about the difference, and they fail in different ways. This lesson covers both, with CardVault’s tokens as the example.',
  youWill: 'You will be able to explain authentication and authorisation, how access and refresh tokens work, and how the suite tests each.',
  body: `
<h2>Two different questions</h2>
${table(['', 'Authentication', 'Authorisation'], [
  ['Question', 'Who are you?', 'What may you do?'],
  ['In CardVault', 'Logging in proves you are alice and gives you a token', 'alice may read and change her own cards, and nobody else’s'],
  ['When it fails', '`401 Unauthorized` (despite the name, it means not authenticated)', '`403 Forbidden`, or `404` when the app hides that the thing exists'],
])}

<h2>Access and refresh tokens</h2>
<p>Logging in returns two tokens. The <strong>access token</strong> goes in the <code>Authorization</code> header of every call and lasts 15 minutes. The <strong>refresh token</strong> is used only to get a new access token, and lasts 7 days. A short-lived access token limits the damage if one leaks; the refresh token saves the customer from typing their password every 15 minutes.</p>
<p>CardVault’s access token is a <strong>JWT</strong> (JSON Web Token): three parts separated by dots. The first two are readable JSON, saying who the token is for and when it expires. The third is a <strong>signature</strong> that only the Login service can make, so no one can change the first two parts without being caught.</p>

${sequence({
  id: 'refresh',
  label: 'Refreshing, and a stolen refresh token',
  actors: [
    { id: 'c', label: 'customer', kind: 'plain' },
    { id: 'a', label: 'Login service', kind: 'bank' },
  ],
  steps: [
    { from: 'c', to: 'a', label: 'refresh with R1', note: 'The access token is about to expire, so the web app sends refresh token R1.' },
    { from: 'a', to: 'c', label: 'new access + R2', kind: 'reply', note: 'The service answers with a new access token and a new refresh token, R2. R1 is now used up. This is called rotation.' },
    { from: 'c', to: 'a', label: 'refresh with R1 again', note: 'Someone presents R1 a second time. Only a thief or a bug would do that.' },
    { from: 'a', to: 'c', label: '401 REFRESH_TOKEN_REUSED', kind: 'reply', note: 'The service refuses, and also cancels R2 and every token from that login, to be safe.' },
  ],
  caption: 'Each refresh token works once. Reusing one ends the whole session.',
})}

<h2>Testing authentication</h2>
${code({ title: 'tests/api/tests/test_login.py', src: `
def test_refresh_gives_new_tokens_and_the_old_refresh_token_stops_working():
    someone = create_logged_in_customer(cards=[])
    login = AuthApi().login(someone["username"], someone["password"]).json()

    refreshed = AuthApi().refresh(login["refresh_token"])

    assert refreshed.status_code == 200
    # The new access token works.
    assert AuthApi().me(refreshed.json()["access_token"]).status_code == 200
    # The old refresh token was used once, so using it again is refused.
    reused = AuthApi().refresh(login["refresh_token"])
    assert reused.status_code == 401
    assert reused.json()["error_code"] == "REFRESH_TOKEN_REUSED"
` })}
<p>The rest of the authentication tests are in the same file: the right password works, a wrong one and an unknown username get the same error, a missing or made-up token is refused, and five wrong passwords lock the account.</p>

<h2>Testing authorisation</h2>
<p>The key authorisation test uses two real customers. Both are properly logged in, so authentication passes. The question is only whether one may touch the other’s card:</p>
${code({ title: 'tests/api/tests/test_security.py', src: `
def test_customer_cannot_change_another_customers_card():
    owner, intruder = make_owner_and_intruder()
    card_id = owner["cards"][0]["card_id"]

    response = CardsApi(intruder["token"]).report_lost(card_id)

    assert response.status_code == 404
    # The real proof: the owner's card is unchanged.
    assert CardsApi(owner["token"]).get_card(card_id).json()["status"] == "ACTIVE"
` })}
<p><code>make_owner_and_intruder()</code> is a small function at the top of the file that creates both customers and returns them as a pair; <code>owner, intruder = ...</code> unpacks the pair into two names. CardVault answers 404 rather than 403, so an intruder cannot even learn that the card ID exists. The last line matters most: it checks with the owner’s token that nothing changed.</p>

<h2>Roles, API keys and Basic auth</h2>
<p>CardVault’s customers all have the same rights, so its rule is ownership. Many systems also have <strong>roles</strong>, such as customer, support agent and admin, and need tests that each role can do only its own actions. Two other ways of authenticating come up often. An <strong>API key</strong> is a long secret string sent in a header, common for program-to-program calls. <strong>Basic auth</strong> sends a username and password in the <code>Authorization</code> header on every request, encoded but not encrypted, so it is only safe over HTTPS. requests supports it with <code>auth=("user", "password")</code>.</p>

${keyIdea('<p>Authentication proves who you are; authorisation decides what you may do. Test authentication with good, bad, missing, forged and expired credentials. Test authorisation with two valid users, one trying to reach the other’s data.</p>')}

${testerEye('<p>Authorisation bugs are the most common serious API flaw, because every endpoint must check ownership on its own. One test per endpoint that takes an ID is a good habit.</p>')}

${interview({
  say: `<p>“Authentication is who you are, authorisation is what you may do. CardVault issues a 15-minute JWT access token and a 7-day refresh token that rotates on every use, and reusing an old refresh token revokes the whole session, which I test. For authorisation I create two customers and check that one gets 404 on the other’s card, and that the owner’s data is unchanged afterwards.”</p>`,
  qa: [
    ['401 or 403?', '<p>401 means the caller is not authenticated: no token or a bad one. 403 means authenticated but not allowed. Some APIs return 404 for other people’s resources to hide that they exist.</p>'],
    ['Why have refresh tokens at all?', '<p>So access tokens can be short-lived, limiting the damage if one leaks, while the user stays logged in. Rotation means a stolen refresh token is detected the moment both parties use it.</p>'],
    ['How would you test role-based access?', '<p>A table of roles against actions, with a test per cell: each role is allowed exactly its own actions and refused the rest, including the data of other users with the same role.</p>'],
  ],
})}
`,
};
