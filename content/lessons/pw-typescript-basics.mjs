import { code, terminal, interview, table, keyIdea } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'Playwright tests in this track are written in TypeScript. You only need a small part of the language to read and write them, and this lesson teaches exactly that part with one short program. No earlier JavaScript is needed.',
  youWill: 'You will be able to read the values, types, arrays, objects, functions and loops used in the CardVault UI tests.',
  body: `
<h2>JavaScript and TypeScript</h2>
<p><strong>JavaScript</strong> is the language of the web: every browser runs it, and Node.js runs it outside the browser. <strong>TypeScript</strong> is JavaScript plus <strong>types</strong>: little labels such as <code>: string</code> that say what kind of value a name holds. A <strong>type checker</strong> reads those labels and warns you about mistakes, such as passing a number where text was expected: your code editor shows the warnings as you type, and <code>npm run typecheck</code> checks the whole suite. When the code runs, the labels are simply removed and plain JavaScript runs. A test run does not check types, so a type mistake can still run; that is why CI runs the type check as its own step.</p>
<p>For tests, that means mistakes show up in your editor while you type instead of halfway through a test run. It is also why Playwright’s own examples use TypeScript.</p>

<h2>The whole toolkit in one program</h2>
<p>This file is in the CardVault UI suite. It has no browser in it; it only shows the language. Comments start with <code>//</code> and are notes for people.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/typescript/basics.ts', src: `
const username: string = 'alice';
const limitInCents: number = 500000; // $5,000.00: money is kept in cents
const inWallet: boolean = true;
let attempts = 0; // TypeScript works out the type (number) by itself
attempts = attempts + 1;

console.log(\`\${username} has signed in \${attempts} time(s)\`);

const lastFours: string[] = ['4417', '2045', '7380', '5521'];
console.log('first card:', lastFours[0], '| cards:', lastFours.length);

interface Card {
  last4: string;
  product: string;
  available: number;
}
const card: Card = { last4: '4417', product: 'CREDIT', available: 500000 };
console.log('product:', card.product);

function dollars(cents: number): string {
  return \`$\${(cents / 100).toFixed(2)}\`;
}
console.log('available:', dollars(card.available));

const dollarsArrow = (cents: number): string => \`$\${(cents / 100).toFixed(2)}\`;
console.log('limit:', dollarsArrow(limitInCents));

for (const last4 of lastFours) {
  if (last4 === '4417') {
    console.log(last4, 'is the main credit card');
  }
}
` })}
${terminal([['node learn/typescript/basics.ts', `alice has signed in 1 time(s)
first card: 4417 | cards: 4
product: CREDIT
available: $5000.00
limit: $5000.00
4417 is the main credit card
in the wallet? true`]], 'Real output, in tests/ui. Node.js 22.18 or newer runs .ts files directly; the type labels are stripped, not checked.')}
<p>(The last output line comes from one more line at the end of the file, explained below.) Now the pieces, one at a time.</p>

<h2>Values, types and names</h2>
<ul>
<li><code>const username: string = 'alice';</code> creates a name, <code>username</code>, for the text <code>'alice'</code>. Text is called a <strong>string</strong> and goes in quotes. <code>: string</code> is the type. The <code>;</code> ends the statement.</li>
<li><code>number</code> is any number, whole or not. <code>boolean</code> is <code>true</code> or <code>false</code>.</li>
<li><code>const</code> means the name can never point at another value (the contents of a <code>const</code> object can still change; the name just keeps pointing at the same object). <code>let</code> means it can, which is why <code>attempts</code> can go up by one. Use <code>const</code> unless you need to change the value; most test code is all <code>const</code>.</li>
<li>You may leave the type out when the value makes it obvious, as in <code>let attempts = 0</code>. TypeScript works out that it is a number.</li>
<li><code>console.log(...)</code> prints its values. Tests rarely print, but it is handy while learning.</li>
</ul>

<h2>Template strings</h2>
<p>Text in backticks, <code>\`like this\`</code>, is a <strong>template string</strong>: each <code>\${...}</code> inside it is replaced by the value of what is in the brackets. Tests use them to build addresses and names, for example <code>\`\${WALLET_URL}/test/customers\`</code>.</p>

<h2>Arrays and objects</h2>
<p>An <strong>array</strong> keeps values in order, in square brackets. <code>string[]</code> means “an array of strings”. Positions are counted from 0, so <code>lastFours[0]</code> is the first item, and <code>.length</code> is how many there are.</p>
<p>An <strong>object</strong> keeps values under names, in curly brackets: <code>{ last4: '4417', product: 'CREDIT' }</code>. You read a value with a dot: <code>card.product</code>. Objects are everywhere in Playwright: <code>{ name: 'Sign in' }</code> in <code>getByRole('button', { name: 'Sign in' })</code> is an object that carries the options.</p>
<p>An <strong>interface</strong> describes the shape an object must have: which names, and the type of each. <code>const card: Card</code> promises that <code>card</code> has exactly that shape, and the checker complains if a name is missing or misspelt.</p>

<h2>Functions</h2>
<p>A <strong>function</strong> is a named, reusable piece of code. <code>function dollars(cents: number): string</code> takes one input, called a <strong>parameter</strong>, of type number, and promises to give back a string. <code>return</code> hands back the result. <code>toFixed(2)</code> writes a number with two decimals.</p>
<p>The second version, <code>const dollarsArrow = (cents: number): string =&gt; ...</code>, is the same function written as an <strong>arrow function</strong>: the inputs in brackets, then <code>=&gt;</code>, then the result. Every Playwright test is an arrow function: <code>async ({ page }) =&gt; { ... }</code>. When the body has several lines it goes in curly brackets.</p>

<h2>Decisions and repeats</h2>
<p><code>for (const last4 of lastFours)</code> runs the block in curly brackets once for each item of the array. <code>if (...)</code> runs its block only when the condition is true. <code>===</code> compares two values. The last line of the file prints <code>inWallet === true</code>, which is the final <code>true</code> in the output. JavaScript also has <code>==</code>, which converts values before comparing and can give surprising answers, so always use <code>===</code>.</p>

${keyIdea('<p>Most test code is <code>const</code> names, strings, objects of options, and arrow functions. Types such as <code>: string</code> are labels the editor and <code>npm run typecheck</code> read; they never change what the code does.</p>')}

<h2>The toolkit on one page</h2>
${table(['You see', 'It means'], [
  ['`const x = 5` / `let n = 0`', 'A name that never changes / one that can'],
  ['`name: string`, `n: number`, `ok: boolean`', 'Type labels: text, number, true or false'],
  ['`\'text\'`', 'A string'],
  ['`${name}` inside backticks', 'A template string fills in the value of name'],
  ['`[a, b]`, `items[0]`, `items.length`', 'An array; its first item; how many'],
  ['`{ k: v }`, `obj.k`', 'An object; the value under k'],
  ['`interface Card { ... }`', 'The shape an object must have'],
  ['`function f(a: number): string { ... }`', 'A function with typed input and result'],
  ['`(a) => ...`', 'An arrow function'],
  ['`for (const x of items)` / `if (...)`', 'Repeat for each item / decide'],
  ['`import { a } from \'./file\'`', 'Use a name that another file exports'],
])}
<p>The last row appears at the top of every test file: <code>import { test, expect } from '@playwright/test'</code> takes two names from the Playwright package, and <code>import { DEMO_PASSWORD } from '../config'</code> takes one from the suite’s own <code>config.ts</code>, where it is marked with <code>export</code>. The next lesson, on <a href="/learn/pw-async-await/">async and await</a>, adds the last piece of language you need.</p>

${interview({
  say: `<p>“I write Playwright tests in TypeScript. It is JavaScript with type annotations, so the editor and a type-check step in CI catch mistakes like a wrong argument or a misspelt property before they reach a test run, and the editor can autocomplete Playwright’s API. Day to day I use const, template strings, objects for options, interfaces for data shapes, and arrow functions; the tests themselves are async arrow functions.”</p>`,
  qa: [
    ['What is the difference between TypeScript and JavaScript?', '<p>TypeScript is JavaScript with types added. A type checker (the editor, or <code>tsc</code>) reads the types and reports mistakes; when the code runs, the types are removed and ordinary JavaScript runs. Playwright does not check types during a test run, so teams run <code>tsc</code> as a separate step.</p>'],
    ['What is the difference between const and let?', '<p>A <code>const</code> name can never be pointed at another value; a <code>let</code> name can. I use <code>const</code> by default, so a reader knows the value will not change, and <code>let</code> only for something like a counter.</p>'],
    ['Why use === instead of ==?', '<p><code>===</code> compares values without converting them, so <code>0 === \'0\'</code> is false. <code>==</code> converts first, so <code>0 == \'0\'</code> is true, which hides bugs.</p>'],
  ],
})}
`,
};
