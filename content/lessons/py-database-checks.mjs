import { code, interview, keyIdea, testerEye, table, sequence } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'Almost every API test checks its result through the API, the way a customer or another service would see it. A few facts never appear in any response, such as how a password is stored, or whether a refused request really left the data alone. For those, a test can look inside the service’s database. This lesson covers when that is worth doing, and how the suite does it safely.',
  youWill: 'You will be able to say when a database check adds value, and read the suite’s query helper and its four database tests.',
  body: `
<h2>Through the API first</h2>
<p>In <a href="/learn/system-at-a-glance/">The system at a glance</a> you saw that each CardVault service keeps its own data. The Cards service stores cards in the <em>card</em> database, Profile stores contact details in the <em>profile</em> database, and so on. All of them live on one <strong>Postgres</strong> server, a widely used database system that stores data in tables and answers questions written in <strong>SQL</strong>.</p>
<p>The tables are a service’s private business. A developer may rename a column, and as long as the API answers the same way, nothing is broken for its users, yet a test that reads tables would fail. So the default is to check through the API: report a card lost, then fetch the card and expect <code>LOST</code>. A database check is the exception, for questions the API cannot answer.</p>

<h2>When a database check is worth it</h2>
${table(['Situation', 'Why', 'Check'], [
  ['A secret must be stored safely, such as a password or card number', 'No response ever shows the stored form', 'Database'],
  ['A refused request must change nothing', 'The error says what was refused; the stored row shows nothing changed, with no service code in between', 'Database, or read it back through the API'],
  ['A record with no endpoint, such as an audit trail', 'There is nothing to call', 'Database'],
  ['A field the API returns', 'The API is the promise; a GET is enough', 'API'],
])}

<h2>How the suite reaches a database</h2>
${sequence({
  id: 'db-check',
  label: 'An API action followed by a database check',
  actors: [
    { id: 't', label: 'test', kind: 'plain' },
    { id: 'c', label: 'Cards', kind: 'bank' },
    { id: 'd', label: 'card database', kind: 'bank' },
  ],
  steps: [
    { from: 't', to: 'c', label: 'report lost', note: 'The test reports its own new card lost through the API, exactly as a customer would.' },
    { from: 'c', to: 'd', label: 'save LOST', note: 'Cards stores the new status in its database.' },
    { from: 'c', to: 't', label: '200 OK', kind: 'reply', note: 'Cards answers that the change is done.' },
    { from: 't', to: 'd', label: 'SELECT (read-only)', note: 'The test connects to the card database directly, as a user that can only read, and asks for that card’s status.' },
    { from: 'd', to: 't', label: 'status: LOST', kind: 'reply', note: 'The row comes back as a Python dictionary, and the test checks it.' },
  ],
  caption: 'Steps 1 to 3 are an ordinary API test. Steps 4 and 5 are the database check, which only reads.',
})}
<p>Each database in the test environment has a user whose name ends in <code>_ro</code>, for read-only: <code>card_ro</code>, <code>profile_ro</code> and so on. It can look but not change, so a mistake in a test’s SQL cannot damage data other tests rely on, and there is nothing to clean up.</p>

<h2>The helper: database.py</h2>
${code({ title: 'tests/api/database.py', src: `
import psycopg
from psycopg.rows import dict_row

import config


def query_one(database, sql, values=()):
...
    # "with" closes the connection at the end, even if the query fails.
    with psycopg.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=database,
        user=f"{database}_ro",
        password=config.DB_READONLY_PASSWORD,
        connect_timeout=config.TIMEOUT,
        row_factory=dict_row,
    ) as connection:
        return connection.execute(sql, values).fetchone()
` })}
<ul>
<li><strong>psycopg</strong> is the usual Python library for Postgres. It does for the database what requests does for HTTP.</li>
<li><code>values=()</code> defaults to an empty <strong>tuple</strong>: a list in round brackets that cannot be changed.</li>
<li><code>psycopg.connect(...)</code> opens a connection. The address and password come from <code>config.py</code>, like the URLs in <a href="/learn/py-config/">Config</a>. <code>f"{database}_ro"</code> builds the user name: for <code>"card"</code> it is <code>card_ro</code>.</li>
<li><code>with ... as connection:</code> runs the block, then closes the connection, even if the query failed.</li>
<li><code>row_factory=dict_row</code> returns each row as a dictionary keyed by column name, so a test writes <code>row["status"]</code>.</li>
<li><code>execute(sql, values)</code> sends the query, and <code>fetchone()</code> returns the first row, or <code>None</code> if nothing matched.</li>
</ul>
<p>Values never go into the SQL text. The query holds a <code>%s</code> where a value belongs, and the value travels separately: <code>query_one("card", "SELECT status FROM cards WHERE card_id = %s", (card_id,))</code>. The comma in <code>(card_id,)</code> makes it a one-item tuple. Building SQL with an f-string instead would let a value containing a quote change the query itself, which is the bug called <strong>SQL injection</strong>.</p>

<h2>Four checks</h2>
${code({ title: 'tests/api/tests/test_database.py', src: `
pytestmark = pytest.mark.database


def test_reporting_a_card_lost_is_saved_in_the_database(customer):
    card_id = customer["new_card"]["card_id"]

    CardsApi(customer["token"]).report_lost(card_id)

    row = query_one("card", "SELECT status FROM cards WHERE card_id = %s", (card_id,))
    assert row["status"] == "LOST"
` })}
<p><code>pytestmark</code> puts the <code>database</code> label from <a href="/learn/py-markers/">Markers</a> on every test in the file, so <code>pytest -m "not database and not events"</code> runs the 86 API-only tests on a machine that can reach the services but not the database. This first test could be made through the API too. It is here because it shows the pattern at its simplest: act through the API, then read the row.</p>

${code({ title: 'tests/api/tests/test_database.py', src: `
def test_passwords_are_stored_as_hashes_not_as_plain_text():
    someone = create_logged_in_customer(cards=[])

    row = query_one(
        "auth", "SELECT password_hash FROM users WHERE username = %s", (someone["username"],)
    )

    assert someone["password"] not in row["password_hash"]
    # scrypt is a slow, salted hashing method made for passwords.
    assert row["password_hash"].startswith("scrypt$")


def test_card_numbers_are_stored_encrypted(customer):
    card_id = customer["wallet_card"]["card_id"]

    row = query_one("card", "SELECT pan_encrypted FROM cards WHERE card_id = %s", (card_id,))

    # A card number in plain text would be 16 digits. Encrypted, it is not digits at all.
    assert not row["pan_encrypted"].isdigit()
    assert len(row["pan_encrypted"]) > 16
` })}
<p>A <strong>hash</strong> is a one-way scramble: the service can check a password against it but cannot turn it back. These tests prove the stored form is not the plain value. They do not prove the method is strong; that is a security review’s job, and saying so shows you know where a test’s evidence stops.</p>

${code({ title: 'tests/api/tests/test_database.py', src: `
def test_a_refused_profile_update_writes_nothing():
    someone = create_logged_in_customer(cards=[])
    profile_api = ProfileApi(someone["token"])
    profile = profile_api.get_profile().json()

    response = profile_api.update_profile(
        {"email": "never-saved@example.com"}, version=profile["version"] + 5
    )

    assert response.status_code == 412
    row = query_one(
        "profile",
        "SELECT email, version FROM profiles WHERE customer_id = %s",
        (profile["customer_id"],),
    )
    assert row["email"] == profile["email"]
    assert row["version"] == profile["version"]
` })}
<p>A wrong version is refused with <code>412</code>, as in <a href="/learn/py-api-behaviours/">version checks</a>. The expected values come from the profile the test read before acting, so the check is “exactly what was there before”, whatever that was.</p>

<h2>Things to watch</h2>
<ul>
<li><strong>Few, in one place.</strong> Database checks depend on table and column names, so keep them in one file, through one helper.</li>
<li><strong>Timing.</strong> Cards saves the status before it answers. A row written later in the background needs polling, as in <a href="/learn/py-flow-test/">A flow test</a>.</li>
<li><strong>Read, do not write.</strong> Set up data through the API, so the service’s own rules still apply.</li>
</ul>

${keyIdea('<p>Check through the API by default. Read the database only for facts no response shows, such as how secrets are stored or that a refused change wrote nothing, and always as a read-only user with values passed separately from the SQL.</p>')}

${testerEye('<p>Each database check should name the requirement it proves. “Passwords are never stored in plain text” is a requirement. “Column x equals y” is a detail that will break on the next refactor.</p>')}

${interview({
  say: `<p>“My API tests check through the API by default, because the API is the contract and tables change. I add a few database checks where the API cannot show the fact: passwords stored as hashes, card numbers stored encrypted, and that a refused update wrote nothing. They connect as a read-only user, pass values as query parameters, and live in one helper so a schema change is one fix.”</p>`,
  qa: [
    ['When would you check the database in an API test?', '<p>When the requirement is about stored data the API never returns: how secrets are stored, audit records, or that a failed request left no partial write. Otherwise a GET through the API is the better check.</p>'],
    ['How do you keep database checks safe?', '<p>Use a read-only user so tests cannot change data, pass values as query parameters rather than building SQL strings, and keep connection details in configuration, out of the code.</p>'],
    ['What are the downsides of database assertions?', '<p>They tie tests to the schema, so a harmless rename breaks them. They need network access and credentials that not every environment allows. And they can see a change too early or too late if it is written in the background.</p>'],
  ],
})}
`,
};
