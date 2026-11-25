import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { readOnlyDb } from '../diagrams/suite.mjs';

export default {
  minutes: 11,
  lede: 'An API suite tests through the API, and almost all of CardVault’s suite does. A few promises, though, are about how data is kept, and no response can show them: that a card number is never stored in clear, that money columns hold whole numbers, that every event row leaves the outbox. For those, and only those, the suite reads the databases directly, with a role that cannot change anything.',
  youWill: 'You will learn when looking in the database is justified, how the read-only role and a context manager keep it safe, how to write a query with parameters, and how the suite proves it cannot write.',
  body: `
<h2>When the API cannot tell you</h2>
<p>Reading the database is tempting, because it is quick and shows everything. It is also a trap: tables are each service’s private business (the first track’s <a href="/learn/each-service-owns-its-data/">Each service owns its data</a>), and a test tied to a column name breaks whenever the team reorganises its tables, even if every promise to customers still holds. So the suite keeps a strict rule: it looks in a database only for promises that are about storage itself.</p>
<ul>
<li>A card number must be stored encrypted. The API never returns it either way, so only the table can show it.</li>
<li>Money must be whole cents. The API returns integers, but a column of decimals could still round inside the service.</li>
<li>Every event row must be published. An outbox row stuck forever is a lost event that no response mentions.</li>
</ul>

<h2>Looking without touching</h2>
${figure({ svg: readOnlyDb(), caption: 'The suite changes things only through the services. Its database role can read and nothing else.' })}
<p>Each service’s database has a second login, a <strong>role</strong> named after it with <code>_ro</code> added (<code>card_ro</code>, <code>wallet_txn_ro</code>, …), which is allowed only to <code>SELECT</code>. The suite connects with <strong>psycopg</strong>, the standard PostgreSQL driver for Python:</p>
${code({ title: 'tests/api/src/cardvault_tests/db.py (part)', src: `
@contextmanager
def connect(settings: Settings, database: str) -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=database,
        user=f"{database}_ro",
        password=settings.readonly_db_password,
        row_factory=dict_row,
        autocommit=True,
        connect_timeout=10,
    )
    try:
        yield conn
    finally:
        conn.close()
` })}
<p><code>@contextmanager</code> turns this function into something usable with <code>with</code>: the code before <code>yield</code> runs on entering the block, the connection is handed to it, and the <code>finally</code> part closes the connection when the block ends, even if a query failed. It is the same set-up and clean-up shape as a <a href="/learn/suite-fixtures/">yield fixture</a>, for one block of code. <code>dict_row</code> makes each row a dictionary keyed by column name, which reads better in assertions than numbered positions.</p>

<h2>A query with parameters</h2>
${code({ title: 'tests/api/tests/storage/test_how_data_is_stored.py (part)', src: `
def test_a_card_number_is_never_stored_in_clear(make_customer, db):
    someone = make_customer(customer(card()))

    row = db.one("card", "SELECT * FROM cards WHERE card_id = %s", someone.card_ids[0])

    assert row["last4"] == someone.new_cards[0].last4
    clear = {k: v for k, v in row.items() if isinstance(v, str) and pan_like(v)}
    assert clear == {}, f"PAN-like values stored in clear: {list(clear)}"
` })}
<p>The <code>%s</code> is a <strong>placeholder</strong>. psycopg sends the card ID separately from the SQL text, so the value can never change the meaning of the query. Building SQL by pasting values into the string is how SQL injection happens, and the suite never does it, even in tests.</p>
<p>The first assertion confirms the test found the right row. The second looks at every text column of that row for anything shaped like a real card number and expects none. The test does not decrypt anything or check the encryption method; it checks the promise that matters, that no column holds the number in clear.</p>

<h2>Proving the suite cannot write</h2>
${code({ title: 'tests/api/tests/storage/test_how_data_is_stored.py (part)', src: `
def test_the_suite_cannot_write(db, settings):
    with connect(settings, "card") as conn, pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("UPDATE cards SET status = status")
` })}
<p><code>pytest.raises</code> is a context manager that passes only if the code inside raises the named error. The <code>UPDATE</code> would change nothing even if it ran (it sets each status to itself), so the test is harmless either way, and it shows the database refusing the write. This is the suite checking its own safety: if someone ever gave the role more rights, this test would fail.</p>
${keyIdea(`<p>Read the database only for promises about storage that no API can show, with a role that can only read, and with parameters in every query. Everything else is tested through the API.</p>`)}
${testerEye(`<p>Before adding a database check, ask whether a customer or a partner could ever observe the difference through an API or event. If they could, test it there instead; the test will survive the next change to the tables.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Read-only role', 'A database login (`<db>_ro`) that may run `SELECT` and nothing else.'],
  ['psycopg', 'The PostgreSQL driver for Python that the suite uses to run queries.'],
  ['Context manager', 'Something used with `with` that sets up on entry and cleans up on exit, even after an error.'],
  ['Query parameter', 'A value sent separately from the SQL text through a placeholder such as `%s`.'],
  ['`pytest.raises`', 'A context manager that passes only if the code inside raises the expected error.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test checks a card’s status by selecting it from the cards table instead of calling `GET /v1/cards/{id}`. What is the main weakness?',
  options: ['It is slower', 'It ties the test to a private table; a harmless change to the table breaks it, and it skips what the customer actually sees', 'It needs a password', 'Nothing'],
  answer: 1,
  why: '<p>The status is visible through the API, which is the contract. The table layout is the service’s own business and can change without breaking any promise.</p>',
})}
${check({
  q: 'Why does the suite write `WHERE card_id = %s` and pass the ID separately, instead of pasting the ID into the string?',
  options: ['psycopg is faster that way', 'The value is sent apart from the SQL, so it can never change the query’s meaning', 'Strings cannot hold UUIDs', 'It is required for SELECT'],
  answer: 1,
  why: '<p>Parameters keep data and SQL apart, which prevents SQL injection. Good habits in tests become good habits everywhere.</p>',
})}
${check({
  q: 'What does `test_the_suite_cannot_write` protect against?',
  options: ['A slow database', 'The suite’s role quietly gaining write rights, which would let a test change data behind the services’ backs', 'An UPDATE that changes statuses', 'Tests running in parallel'],
  answer: 1,
  why: '<p>The suite’s promise is that services stay the only writers. The test turns that promise into a check that fails the moment the role can write.</p>',
})}

<h2>Recap</h2>
${recap([
  'Look in the database only for storage promises no API can show.',
  'Connect as `<db>_ro`, which can only read, inside a `with` block that always closes.',
  'Use placeholders such as `%s`; never paste values into SQL.',
  'A test proves the role cannot write.',
])}
`,
};
