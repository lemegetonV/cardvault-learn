import { code, terminal, interview, keyIdea, table, sequence, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Almost every line of a Playwright test starts with the word await. This lesson explains why: a browser takes time to do things, and JavaScript does not wait on its own. Once you understand promises and await, Playwright code stops looking strange.',
  youWill: 'You will be able to explain what a promise is, what async and await do, and which lines of a test need await.',
  body: `
<h2>The problem: things take time</h2>
<p>When a test clicks “Sign in”, the browser has to send a request, wait for CardVault to answer and draw the next page. That can take half a second. Meanwhile your code has already moved on to the next line.</p>
<p>JavaScript (and so TypeScript) is built that way on purpose. It never freezes while it waits for something slow, such as a network answer or a timer. Instead, a slow operation gives you back a <strong>promise</strong> straight away: an object that stands for a result that is not ready yet. Think of the ticket you get at a coffee counter. You hold the ticket now; the coffee comes later.</p>
<p>Every Playwright action is slow in this sense, so every action returns a promise.</p>

<h2>await: wait here until it is ready</h2>
<p>The keyword <code>await</code> in front of a promise means “pause this function until the promise is ready, then give me the result”. A function that uses <code>await</code> must be marked <code>async</code>. This small program, from the CardVault UI suite, shows the difference. It has no browser in it, only a timer that stands in for a slow page.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/typescript/async-await.ts', src: `
function loadHeading(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve('Checkout wallet'), 500);
  });
}

function withoutAwait(): void {
  const heading = loadHeading();
  console.log('without await:', heading);
}

async function withAwait(): Promise<void> {
  const heading = await loadHeading();
  console.log('with await:   ', heading);
}

withoutAwait();
withAwait();
` })}
<p>Line by line:</p>
<ol>
<li><code>function loadHeading(): Promise&lt;string&gt;</code> declares a function. The part after the colon is its <strong>return type</strong>: it returns a promise that will one day hold a <code>string</code> (text). TypeScript reads <code>Promise&lt;string&gt;</code> as “a promise of a string”.</li>
<li><code>new Promise((resolve) =&gt; { ... })</code> makes a promise by hand. You will rarely do this in tests; Playwright makes the promises for you. Here, <code>setTimeout</code> waits 500 milliseconds and then calls <code>resolve</code>, which fills the promise with the text <code>'Checkout wallet'</code>.</li>
<li><code>(resolve) =&gt; { ... }</code> is an arrow function, as in the last lesson: the input in the brackets, the body after <code>=&gt;</code>.</li>
<li>In <code>withoutAwait</code>, <code>heading</code> gets the promise itself, the ticket, not the text. <code>: void</code> means the function returns nothing.</li>
<li>In <code>withAwait</code>, <code>await</code> pauses until the promise is filled, so <code>heading</code> holds the text. The function is marked <code>async</code>, and an <code>async</code> function always returns a promise itself, here <code>Promise&lt;void&gt;</code>: a promise of nothing, which only says “I have finished”.</li>
</ol>
<p>Run it with Node.js, the program that runs JavaScript and TypeScript outside a browser. This is the real output:</p>
${terminal([['node learn/typescript/async-await.ts', `without await: Promise { <pending> }
with await:    Checkout wallet`]], 'In tests/ui')}
<p><code>Promise { &lt;pending&gt; }</code> is Node’s way of printing a ticket whose coffee has not arrived. Half a second later, the second line prints the real text.</p>

${keyIdea('<p>A slow operation returns a promise straight away. <code>await</code> pauses until the promise has its result. Only an <code>async</code> function can use <code>await</code>.</p>')}

<h2>The same thing in a Playwright test</h2>
<p>Here is the test from the next lessons, which signs alice in. Notice the shape: the test is an <code>async</code> arrow function, and each step that touches the browser is awaited.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/first-test.spec.ts', src: `
test('alice can sign in and see her wallet', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill('CardVault-Demo-1');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/wallet');
  await expect(page.getByRole('heading', { name: 'Checkout wallet' })).toBeVisible();
});
` })}
<p>Step through what happens when one awaited line runs:</p>
${sequence({
  id: 'await-click',
  label: 'One awaited click',
  actors: [
    { id: 't', label: 'Your test', kind: 'plain' },
    { id: 'p', label: 'Playwright', kind: 'plain' },
    { id: 'b', label: 'Browser', kind: 'plain' },
  ],
  steps: [
    { from: 't', to: 'p', label: 'click Sign in', note: 'The test calls `click()`. Playwright hands back a promise at once.' },
    { from: 't', to: 't', label: 'await: pause', kind: 'self', note: '`await` pauses the test function here. Nothing below this line runs yet.' },
    { from: 'p', to: 'b', label: 'find, wait, click', note: 'Playwright finds the button, waits until it is visible and enabled, and clicks it.' },
    { from: 'b', to: 'p', label: 'done', kind: 'reply', note: 'The browser confirms the click happened.' },
    { from: 'p', to: 't', label: 'promise ready', kind: 'reply', note: 'The promise is filled, so the test carries on with the next line.' },
  ],
  caption: 'await keeps the steps in order: each browser action finishes before the next line starts.',
})}

<h2>What happens if you forget await</h2>
<p>Take the first test and delete one <code>await</code>, in front of the line that types the username. The code still runs, because a promise without <code>await</code> is allowed. But now nothing waits for the typing to finish, so the steps no longer happen in a guaranteed order. When we ran it, the test failed like this:</p>
${terminal([['npx playwright test learn/first-test.spec.ts', `  ✓  1 [setup] › learn/saved-login.setup.ts:5:1 › sign in as alice and save the login (555ms)
  ✘  2 [learn] › learn/first-test.spec.ts:6:1 › alice can sign in and see her wallet (5.5s)

    Error: expect(page).toHaveURL(expected) failed

    Expected: "http://localhost:3000/wallet"
    Received: "http://localhost:3000/login"
    Timeout:  5000ms`]], 'Real output, shortened, with one await removed. The [setup] line is a sign-in step that runs first; the first-test lesson explains it.')}
<p>The browser never left the sign-in page. The error points at the last line, but the real mistake is three lines higher. That is what makes a missing <code>await</code> nasty: the failure shows up somewhere else, and sometimes the test even passes by luck. Code editors and linters (tools that read code and flag likely mistakes) can be set up to warn about a promise that is not awaited.</p>

${testerEye('<p>When a test fails in a way that makes no sense, or fails only sometimes, look for a missing <code>await</code> before anything else. It is the most common beginner bug in Playwright code.</p>')}

<h2>Which lines need await?</h2>
${table(['Line', 'await?', 'Why'], [
  ['`page.goto(...)`, `.click()`, `.fill()`, `.check()`', 'Yes', 'They make the browser do something, which takes time'],
  ['`expect(locator).toBeVisible()`, `expect(page).toHaveURL(...)`', 'Yes', 'They keep checking the page until it matches, which takes time'],
  ['`page.getByRole(...)`, `page.getByLabel(...)` on their own', 'No', 'They only describe where to look; nothing happens in the browser yet'],
  ['`expect(5).toBe(5)` on a plain value', 'No', 'The value is already here, so there is nothing to wait for'],
])}
<p>The rule of thumb: if the line touches the browser or waits for the page, it needs <code>await</code>.</p>

${interview({
  say: `<p>“Browser actions are asynchronous, so every Playwright action returns a promise. I mark the test function async and await each action and each web-first assertion, so the steps run in order. Locators themselves are lazy and don’t need await, because they only describe where to look. A missing await is the classic cause of tests that fail in odd places or pass by luck.”</p>`,
  qa: [
    ['What is a promise?', '<p>An object that stands for a result that is not ready yet, such as the outcome of a click or a network call. It is either still pending, fulfilled with a value, or rejected with an error. <code>await</code> waits for it to settle and gives you the value, or throws the error.</p>'],
    ['Why does page.getByRole() not need await, but click() does?', '<p><code>getByRole()</code> only builds a locator, a description of where to look; it does not touch the browser. <code>click()</code> finds the element, waits until it is ready and clicks it, which takes time, so it returns a promise you must await.</p>'],
    ['What happens if you forget await before an action?', '<p>The test does not wait for that action, so the next steps can run before it finishes. The test may fail at a later line with a confusing error, or pass by luck. If the test ends while a check that was not awaited is still running, Playwright marks the test failed. Linters can also flag a promise that is not awaited.</p>'],
  ],
})}
`,
};
