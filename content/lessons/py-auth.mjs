import { code, interview, keyIdea, testerEye, table, sequence, tryIt } from '../../src/components.mjs';

export default {
  minutes: 16,
  lede: 'Two questions guard every API call: who are you, and are you allowed to do this? They sound alike, interviewers love to ask about the difference, and they fail in different ways. This lesson covers both, with CardVault’s tokens as the example.',
  youWill: 'You will be able to explain authentication and authorisation, how access and refresh tokens work, how the suite tests each, and how cookies and OAuth 2.0 fit in.',
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
<p>The same refresh story, on the live app. The login saves alice’s first refresh token as <code>{{first_refresh}}</code>, so requests 2 and 3 can both send it.</p>
${tryIt({ requests: [
  { label: 'Log in as alice', method: 'POST', service: 'auth', path: '/v1/auth/login', body: { username: 'alice', password: 'CardVault-Demo-1' }, save: { first_refresh: 'refresh_token' } },
  { label: 'Swap the refresh token for new tokens', note: 'Expect `200` with a new `access_token` and a new `refresh_token`.', method: 'POST', service: 'auth', path: '/v1/auth/refresh', body: { refresh_token: '{{first_refresh}}' } },
  { label: 'Use the same refresh token again', note: 'It was already used once, so expect `401` with `REFRESH_TOKEN_REUSED`.', method: 'POST', service: 'auth', path: '/v1/auth/refresh', body: { refresh_token: '{{first_refresh}}' } },
] })}

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

<h2>Tokens in a browser: cookies</h2>
<p>The suite sends the access token itself, in the <code>Authorization</code> header. A web page could do the same, but then the token would sit where the page’s JavaScript can read it, and any script injected into the page could steal it. CardVault’s web app avoids that. When a customer logs in, the web app’s own server keeps the tokens in <strong>cookies</strong>: small values the browser stores and sends back automatically with every request to the same site. The cookies are marked <code>HttpOnly</code>, which means page scripts cannot read them. Every call from the page goes to the web app’s server, which adds the token and passes the call on to the right service.</p>
${table(['', 'Token in a header', 'Token in an HttpOnly cookie'], [
  ['Who sends it', 'The caller’s code, on every request', 'The browser, automatically'],
  ['Readable by page scripts', 'Yes, if the page stores it', 'No'],
  ['Typical user', 'Programs, mobile apps, API tests', 'Web pages'],
  ['Extra risk to test', 'Leaks in logs or storage', 'Forged requests from other sites, so state-changing calls need an anti-forgery check'],
])}
<p>For an API tester the difference is mostly where the token comes from: an API test logs in and sets the header, while a UI test logs in through the page and the browser handles the cookie.</p>

<h2>OAuth 2.0 in one picture</h2>
<p>CardVault has its own login, but interviewers often ask about <strong>OAuth 2.0</strong>, the standard way to let one application act for a user at another without ever seeing the user’s password. “Sign in with” buttons and bank data-sharing apps use it. The most common form, the <strong>authorization code flow</strong>, goes like this:</p>
${sequence({
  id: 'oauth-code',
  label: 'The OAuth 2.0 authorization code flow (general, not CardVault)',
  actors: [
    { id: 'u', label: 'user’s browser', kind: 'plain' },
    { id: 'app', label: 'the app', kind: 'plain' },
    { id: 'as', label: 'authorization server', kind: 'plain' },
    { id: 'api', label: 'the API', kind: 'plain' },
  ],
  steps: [
    { from: 'u', to: 'app', label: 'Sign in with…', note: 'The user wants the app to use their data held somewhere else.' },
    { from: 'app', to: 'u', label: 'go to the login page', kind: 'reply', note: 'The app sends the browser to the authorization server, saying which app it is and what access it wants (the scopes).' },
    { from: 'u', to: 'as', label: 'log in, approve', note: 'The user types their password at the authorization server only, never into the app, and approves the access.' },
    { from: 'as', to: 'u', label: 'back to the app with a code', kind: 'reply', note: 'The browser returns to the app carrying a one-time code.' },
    { from: 'app', to: 'as', label: 'swap code for tokens', note: 'The app’s server exchanges the code, plus its own secret, for an access token and usually a refresh token.' },
    { from: 'app', to: 'api', label: 'call with Bearer token', note: 'From here it looks like CardVault: the access token goes in the Authorization header.' },
  ],
  caption: 'The user’s password goes only to the authorization server. The app ends up with a token limited to the access the user approved.',
})}
<p>Things a tester checks in an OAuth set-up: a code works only once and expires quickly, a token is refused for a scope it was not given, and an expired or revoked token gets 401. Once the token exists, API tests use it exactly as the CardVault suite uses its access token.</p>

<h2>Roles, API keys and Basic auth</h2>
<p>CardVault’s customers all have the same rights, so its rule is ownership. Many systems also have <strong>roles</strong>, such as customer, support agent and admin, and need tests that each role can do only its own actions. Two other ways of authenticating come up often. An <strong>API key</strong> is a long secret string sent in a header, common for program-to-program calls. <strong>Basic auth</strong> sends a username and password in the <code>Authorization</code> header on every request, encoded but not encrypted, so it is only safe over HTTPS. requests supports it with <code>auth=("user", "password")</code>.</p>

${keyIdea('<p>Authentication proves who you are; authorisation decides what you may do. Test authentication with good, bad, missing, forged and expired credentials. Test authorisation with two valid users, one trying to reach the other’s data.</p>')}

${testerEye('<p>Authorisation bugs are the most common serious API flaw, because every endpoint must check ownership on its own. One test per endpoint that takes an ID is a good habit.</p>')}

${interview({
  say: `<p>“Authentication is who you are, authorisation is what you may do. CardVault issues a 15-minute JWT access token and a 7-day refresh token that rotates on every use, and reusing an old refresh token revokes the whole session, which I test. For authorisation I create two customers and check that one gets 404 on the other’s card, and that the owner’s data is unchanged afterwards.”</p>`,
  qa: [
    ['401 or 403?', '<p>401 means the caller is not authenticated: no token or a bad one. 403 means authenticated but not allowed. Some APIs return 404 for other people’s resources to hide that they exist.</p>'],
    ['Why have refresh tokens at all?', '<p>So access tokens can be short-lived, limiting the damage if one leaks, while the user stays logged in. Rotation means a stolen refresh token is detected the moment both parties use it.</p>'],
    ['What is OAuth 2.0 for?', '<p>Letting one application act for a user at another service without seeing the user’s password. The user logs in at the authorization server, the app receives a code and swaps it for a token limited to the approved scopes, then calls the API with that token.</p>'],
    ['How would you test role-based access?', '<p>A table of roles against actions, with a test per cell: each role is allowed exactly its own actions and refused the rest, including the data of other users with the same role.</p>'],
  ],
})}
`,
};
