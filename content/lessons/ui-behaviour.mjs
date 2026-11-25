import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table } from '../../src/components.mjs';
import { sessionTimeline } from '../diagrams/web.mjs';

export default {
  minutes: 10,
  lede: 'A browser test meets the app the way a customer does: it waits for things to appear, answers dialogs, watches badges change and reads dates in its own time zone. This lesson lists the behaviours of the CardVault web app that a UI test will run into, so none of them comes as a surprise when the Playwright track begins.',
  youWill: 'You will know the pages, the timers, the dialogs and the waiting the web app does, and how each one shows itself to a test.',
  body: `
<h2>The pages</h2>
${table(['Page', 'What the customer does there'], [
  ['`/login`', 'Signs in. Shows why they were signed out, if they were'],
  ['`/wallet`', 'Sees each card’s eligibility and wallet status; adds and removes cards; opts in or out'],
  ['`/wallet/transactions`', 'Filters the history, loads more, exports a CSV'],
  ['`/wallet/transactions/{id}`', 'Sees one transaction and opens a dispute with an optional receipt'],
  ['`/cards`', 'Reports a card lost, reissues it or closes it'],
  ['`/profile`', 'Changes email or phone and verifies them with a code'],
])}
<p>Every page that needs a session sends a signed-out visitor to <code>/login</code> and back again after signing in. On a narrow screen the navigation folds behind a Menu button.</p>

<h2>A session with a clock</h2>
${figure({ svg: sessionTimeline() })}
<p>A web session lasts 15 minutes of real time. One minute before the end, a dialog appears with a countdown in seconds. “Stay signed in” refreshes the tokens and restarts the 15 minutes; “Sign out”, or doing nothing, signs the customer out. The login page then explains why: “You were signed out after 15 minutes.” If any call to the BFF comes back <code>401</code> in the meantime, for example because the refresh token was revoked, the page goes straight to the login page with a “session has ended” message.</p>
<p>This timer runs on the browser’s real clock, not the <a href="/learn/the-shared-clock/">shared clock</a>, because the session lives in the browser’s cookies. A UI test that wants to see the warning without waiting 14 minutes controls the browser’s clock instead.</p>

<h2>Waiting for the wallet</h2>
<p>When a customer adds a card, the badge says PENDING and the page checks again every 2 seconds, so the badge turns to ENROLLED, or FAILED, without a reload. It keeps checking for up to 60 seconds. After that it stops and shows “Still pending. Check again later.” This is the <a href="/learn/enrolment/">asynchronous enrolment</a> seen from the screen.</p>
${keyIdea(`<p>The page waits with a limit, and so should a test. Wait for a visible outcome (the badge changing, a message appearing) rather than for a fixed time, and decide in advance how long is too long.</p>`)}

<h2>Dialogs, two kinds</h2>
<p>Most confirmations are the app’s own dialogs: proper page elements, labelled, closed with Escape, and easy for a test to find. Adding a card or opting in shows the <a href="/learn/browser-security/">operator’s terms in a frame</a>; the confirm button stays disabled until the customer ticks “I agree” and presses “Continue” <em>inside the frame</em>, so a test must reach into the frame to get past it.</p>
<p>Closing a card is the exception. It uses the browser’s own <code>confirm()</code> box: “Close the credit card ending 4417? This cannot be undone.” That box is not part of the page, so a test cannot click it like a button; it has to tell the browser in advance whether to accept or dismiss it. Dismissing it changes nothing.</p>

<h2>Showing what happened</h2>
${table(['Situation', 'What the page shows'], [
  ['Data is loading', 'A “Loading…” line'],
  ['Nothing to show', 'An empty-state message, for example when a filter matches no transactions'],
  ['A request failed', 'An error box with the service’s message and code, and a “Try again” button'],
  ['An action succeeded or failed', 'A short message, a toast, for 4 seconds'],
])}
<p>Because the BFF passes service errors through unchanged, a fault injected into a service shows up on the page with the service’s own error code. Each of these states, and almost every control, carries a <code>data-testid</code> attribute: there are 72 of them across the app, such as <code>loading</code>, <code>empty-state</code>, <code>error-state</code> and <code>retry</code>.</p>

<h2>Times, money and forms</h2>
<ul>
<li><strong>Times</strong> are shown in the browser’s own time zone. The date filter on the transactions page means whole days in that time zone; the page converts them to UTC bounds before asking the API, and the CSV’s filename uses the dates the customer picked.</li>
<li><strong>Amounts</strong> come from the API as whole cents and are formatted as US dollars only for display.</li>
<li><strong>Profile edits</strong> send <code>If-Match</code>; if the profile changed elsewhere, the page says “Your profile changed somewhere else. Reload and try again.” The “send code” button counts down the 30-second cooldown.</li>
<li><strong>Every action</strong> sends a fresh <a href="/learn/idempotency-keys/">idempotency key</a>. The dispute form ignores a second press while its request is in flight. After a failed attempt it takes a new key, because the customer may change the form before trying again, and the same key with a different form would be refused.</li>
</ul>
${testerEye(`<p>Run the same transactions test in two browser time zones, for example London and Kolkata, with a purchase close to midnight UTC, and check the dates shown and the dates filtered. Control the browser clock to reach the session warning in seconds. Handle the native confirm both ways. Inject a fault into a service and assert the page shows the error state with the service’s code, then lift the fault and press “Try again”.</p>`)}
${realWorld(`<p>Production apps often hide error codes from customers and show friendlier wording, logging the code instead. CardVault shows the code because it is built to be tested: a visible code lets a UI test check that the right failure reached the screen.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Toast', 'A short message that appears briefly after an action, here for 4 seconds.'],
  ['Native dialog', 'A box drawn by the browser itself, such as `confirm()`, outside the page’s HTML.'],
  ['`data-testid`', 'An attribute added only to help tests find an element reliably.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test adds a card and the operator mock’s `callback_delay` is set to 90 seconds. What does the wallet page show after 70 seconds?',
  options: ['ENROLLED', 'PENDING, with “Still pending. Check again later.” because the page stopped checking after 60 seconds', 'FAILED', 'An error'],
  answer: 1,
  why: '<p>The page polls every 2 seconds for at most 60 seconds. The enrolment is still PENDING at the service, and the page says so.</p>',
})}
${check({
  q: 'A test clicks “Close” on a card but never handles the browser’s `confirm()` box. In most browser automation tools the box is dismissed by default. What happens to the card?',
  options: ['It is closed', 'Nothing: dismissing the box cancels the close', 'It is reported lost', 'The page shows an error'],
  answer: 1,
  why: '<p>Only accepting the native confirm sends the close. A dismissed confirm changes nothing, which is easy to mistake for a defect.</p>',
})}
${check({
  q: 'Why does the session warning ignore the shared clock?',
  options: ['It is a defect', 'The session is held in browser cookies with a 15-minute lifetime, so the browser’s real clock decides', 'The shared clock is only for the network mock', 'It does use the shared clock'],
  answer: 1,
  why: '<p>The shared clock drives business rules in the services. The web session’s cookies expire in real time in the browser, so the timer uses the browser’s clock.</p>',
})}

<h2>Recap</h2>
${recap([
  'Six pages; signed-out visitors go to `/login` and come back afterwards.',
  'Sessions last 15 real minutes, with a warning in the last minute.',
  'The wallet page polls PENDING every 2 seconds, for up to 60 seconds.',
  'Closing a card uses the browser’s native `confirm()`; everything else uses page dialogs.',
  'Loading, empty and error states are visible and tagged with `data-testid`.',
  'Times are local to the browser; filters convert local days to UTC.',
])}
`,
};
