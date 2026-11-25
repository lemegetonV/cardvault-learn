import { figure, keyIdea, testerEye, terms, check, recap, table, code } from '../../src/components.mjs';
import { tree, oneImage } from '../diagrams/inside.mjs';

const folders = tree([
  [0, 'cardvault/', 'the repository'],
  [1, 'app/', 'everything that runs'],
  [2, 'services/', 'the five bank services', 'bank'],
  [3, 'auth/  card/  enrollment/', '', 'bank'],
  [3, 'profile/  wallet_txn/', '', 'bank'],
  [2, 'mocks/', 'the two stand-ins', 'mock'],
  [3, 'network/  wallet_operator/', '', 'mock'],
  [2, 'shared/', 'code every service uses'],
  [2, 'web/', 'the Next.js web app'],
  [2, 'Dockerfile', 'one recipe for every Python service'],
  [2, 'pyproject.toml', 'one dependency list'],
  [1, 'scripts/', 'reset, seed and smoke'],
  [1, 'docs/', 'error codes and event schemas'],
  [1, 'docker-compose.yml', 'the whole stack'],
  [1, 'Makefile', 'make up, make seed, make reset…'],
  [1, 'tests-api/  tests-ui/', 'where your test suites will live'],
], 'The CardVault repository: app holds the services, mocks, shared code and web app; scripts, docs and the compose file sit beside it.');

const oneService = tree([
  [0, 'services/card/', ''],
  [1, 'main.py', 'builds the app: name, routes, hooks', 'bank'],
  [1, 'api.py', 'the customer endpoints'],
  [1, 'internal.py', 'endpoints for other systems'],
  [1, 'domain.py', 'the business rules'],
  [1, 'models.py', 'the database tables'],
  [1, 'migrations/', 'numbered changes to those tables'],
], 'The files inside one service folder.');

export default {
  minutes: 10,
  lede: 'Five services and two mocks sound like seven projects. In CardVault they are one Python project with one recipe, and the differences between services are kept small on purpose. This lesson walks through the folders and shows how one recipe becomes seven running programs.',
  youWill: 'You will learn where code lives and which library does which job.',
  body: `
<h2>The folders</h2>
<p>Everything that runs lives under <code>app/</code>. Around it sit the scripts that reset and seed the stack, the documentation, and the two empty folders where test suites belong.</p>
${figure({ svg: folders, caption: 'Green folders hold the bank, which is under test. Grey folders hold the mocks.', narrow: true })}

<h2>Inside one service</h2>
<p>Every service folder follows the same pattern, so once you can find your way around one, you can find your way around all of them. Here is the card service.</p>
${figure({ svg: oneService, caption: 'Not every service has every file. The profile service, for example, has no internal endpoints and no separate rules file.', narrow: true })}
<p>The most important file is <code>main.py</code>. It does not contain much logic. It describes the service and hands that description to a shared function, <code>create_app</code>, which builds the actual web application. Here is the profile service’s version:</p>
${code({ title: 'app/services/profile/main.py (end of file)', src: `app = create_app(
    ServiceSpec(
        name="profile",
        title="CardVault profile-service",
        description=(...),
        routers=[api_router],
        test_routers=[test_router],
        uses_db=True,
        uses_kafka=True,
        reset_tables=RESET_TABLES,
        on_startup=[startup],
        on_seed=[seed],
    )
)` })}
<p>Read it as a form the service fills in: “my name is profile, these are my routes, these are my test-only routes, I use a database and Kafka, and here is what to do at start-up and when seeding.” <code>create_app</code> does the rest, the same way for every service. <a href="/learn/journey-of-a-request/">The journey of one request</a> looks at what it adds.</p>

<h2>The libraries, by the problem each one solves</h2>
<p>CardVault is written in Python. A handful of libraries do the heavy lifting. You do not need to know them in depth, but you should know which one is responsible for what, so an error message points you in the right direction.</p>
${table(['Problem', 'Library', 'What it does here'], [
  ['Turn functions into HTTP endpoints', 'FastAPI', 'Routes requests, checks inputs, and writes the OpenAPI document each `/docs` page shows'],
  ['Describe the shape of data', 'Pydantic', 'Defines request and response bodies, and rejects ones that do not fit'],
  ['Run the web app', 'uvicorn', 'The server process that listens on the port and passes requests to FastAPI'],
  ['Talk to the database', 'SQLAlchemy', 'Builds and runs SQL against Postgres'],
  ['Change tables safely over time', 'Alembic', 'Applies numbered migrations in order'],
  ['Send and receive events', 'aiokafka', 'Publishes to and reads from Redpanda'],
  ['Call other services', 'httpx', 'The HTTP client one service uses to call another'],
  ['Sign and check tokens', 'PyJWT, cryptography', 'Creates and verifies login tokens, encrypts card numbers'],
])}
${keyIdea(`<p>When a request comes back with <code>422</code> and a list of fields, that is Pydantic, through FastAPI, rejecting a body that does not match the declared shape. The service’s own rules never ran. Knowing which layer answered tells you what your test actually proved.</p>`)}

<h2>One recipe, seven programs</h2>
<p>All the Python services and both mocks are built from a single <code>Dockerfile</code>. The only difference between them is one setting, <code>SERVICE</code>, which <code>docker-compose.yml</code> passes in when it builds each image.</p>
${figure({ svg: oneImage(), caption: 'The same recipe produces seven images. At start-up, the shared entrypoint reads SERVICE to decide which program to run.' })}
<p>Here is the entrypoint every container runs, slightly shortened:</p>
${code({ title: 'app/shared/entrypoint.py', src: `def main() -> None:
    service = os.environ["SERVICE"]
    package = f"services.{service}"
    if importlib.util.find_spec(package) is None:
        package = f"mocks.{service}"
    ...
    if migrations.is_dir() and database_url:
        migrate.upgrade(migrations, database_url)
    uvicorn.run(f"{package}.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), ...)` })}
<ol>
<li>It reads <code>SERVICE</code>, for example <code>card</code>.</li>
<li>It looks for <code>services.card</code>, and falls back to <code>mocks.card</code> if there is no such service. That is how the same code starts a mock.</li>
<li>If the package has a <code>migrations</code> folder and a database address, it brings the tables up to date.</li>
<li>It starts uvicorn with that package’s <code>app</code>.</li>
</ol>

<h2>The trade-off</h2>
<p>Every design choice in CardVault comes with a cost, and the architecture notes say so openly. This one is no different.</p>
<ul>
<li><strong>What it buys:</strong> one dependency list, one lock file, one shared image layer that builds once, and no separate package to publish for the shared code.</li>
<li><strong>What it costs:</strong> every service carries every dependency, and upgrading a library touches all of them at once. Running migrations at start-up is also only safe with one copy of each service, which is true here.</li>
</ul>
<p>For a few small services owned by one team, that is a good deal. A large organisation with teams releasing on different schedules would usually split them.</p>
${testerEye(`<p>Because every service shares <code>shared/</code>, one change there affects all of them at once. A bug in shared error handling, logging or pagination would show up in every service, so a good test suite checks those behaviours on more than one service, not just the first one it happens to call.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['FastAPI', 'The Python web framework every service is built on. It also generates each service’s OpenAPI document.'],
  ['Pydantic', 'Describes data shapes in Python and rejects data that does not fit them.'],
  ['uvicorn', 'The server process that runs a FastAPI app on a port.'],
  ['`create_app`', 'CardVault’s shared function that turns a service description into a complete web app.'],
  ['Entrypoint', 'The program a container runs when it starts. Here it picks the service, migrates, and starts uvicorn.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'Logged in as alice, you send `POST /v1/profile/verify` with her valid token but no body, and get `422` with a list of missing fields. Which part of CardVault produced that response?',
  options: ['The profile service’s business rules', 'Input validation by FastAPI and Pydantic, before the handler ran', 'Postgres', 'The web app'],
  answer: 1,
  why: '<p>A missing or malformed body is caught when FastAPI checks it against the Pydantic model, before any of the service’s own code runs. The test proved that validation works, not that verification works.</p>',
})}
${check({
  q: 'How does one Dockerfile end up running the network mock instead of a bank service?',
  options: ['There is a second Dockerfile for mocks', 'The image is built with SERVICE=network, and the entrypoint finds `mocks.network` because there is no `services.network`', 'Docker Compose edits the code', 'The mock is a separate repository'],
  answer: 1,
  why: '<p>The entrypoint first looks for <code>services.&lt;name&gt;</code> and falls back to <code>mocks.&lt;name&gt;</code>. The network mock has no database, so no migrations run before uvicorn starts.</p>',
})}

<h2>Recap</h2>
${recap([
  'Everything that runs lives under `app/`: services, mocks, shared code and the web app.',
  'Every service folder has the same shape, and `main.py` describes the service for `create_app`.',
  'FastAPI and Pydantic handle routes and validation; SQLAlchemy and Alembic handle the database; aiokafka handles events.',
  'One Dockerfile builds every Python image; `SERVICE` picks which program the entrypoint runs.',
  'One shared project is simpler, at the cost of upgrading everything together.',
])}
`,
};
