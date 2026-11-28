# CardVault Learn

A learning site that prepares the owner for QA/SDET interviews: know the CardVault app (`lemegetonV/cardvault`) like a product they worked on, then test it with Python + pytest (API) and TypeScript + Playwright (UI). Static pages built by `build.mjs`, served from the Cloudflare Worker `cardvault-learn` (https://cardvault-learn.x-bookmarks.workers.dev). See `README.md` for commands and layout.

## The goal (the owner's words, 2026-11-25, binding; this replaced a first version they found dense and unusable)

- **Interview prep for a beginner.** The owner has almost no Python, JavaScript or TypeScript experience. They must be able to (1) explain CardVault at a system-design level, (2) explain each test framework's files and why they exist, then the tests, (3) read the code, with the language taught in place.
- **Product view only.** CardVault is presented as a real bank product with features. Do not teach how it was engineered internally (outbox, shared clock, crypto, locks, CI budgets) or the test machinery (seed internals, `/test/*` endpoints, clock control, fault injection, seeded bugs). One sentence that the test environment can be reset is enough.
- **Short.** A lesson is a 10-minute read, roughly 600 to 900 words, built around one diagram, a few screenshots or one code file.
- **Map before detail.** Each framework track starts with the folder tree and a one-line job per file, then what happens in a run, and only then the pieces.
- **Beginner code.** Plain functions, simple classes, dictionaries, `assert`. If a line needs a paragraph to explain, rewrite the code.
- **Interview corner.** Every lesson ends with `interview({ say, qa })`: a short spoken answer and two or three likely questions with model answers.
- Pilot each track and get the owner's review before writing the rest.

## What this site is (the owner's words, binding)

- It is **learning material, not a spec** and not a technical reference. Plain teaching language, step by step.
- **Readability and easy understanding first.** Avoid clutter. Do not dump content. Prefer one clear diagram over three paragraphs.
- **More visuals for explanation**: diagrams, step-through sequences, before-and-after pictures.
- **Do not go down a pure technical-docs rabbit hole.** Teach the idea, show it in CardVault, say why it matters to a tester, stop.
- Plan the curriculum before writing. The plan lives in `content/site.mjs`.

## How a lesson is written

- Open with what the subject is, the problem behind it, and how it connects to what the reader already knows. No summary box at the top.
- Short paragraphs, clear subjects, familiar words, technical terms explained where they first appear. British spelling.
- One idea per section. A diagram where a mechanism has moving parts; a step-through (`sequence`) where order matters.
- In the app track, no source code. In the test tracks, code comes from the new beginner suites and is explained line by line.
- Callouts, used sparingly: **Key idea** (the one thing to remember), **Through a tester's eyes** (what this means for tests), **In a real bank** (how real systems differ).
- Close with the interview corner (`interview()` in `src/components.mjs`). No terms list, quiz or recap boxes unless a lesson clearly needs one.
- Screenshots of the real app go in `content/images/` and use `shot()`. Take them from a local stack (bug-free), never from stage. The one exception is `stage-docs-hub.png` in the stage lesson, which shows the public docs page, not the app.
- Table cells and Try it notes accept `code`, **bold** and [links](url) (`md()` in `src/components.mjs`).
- Every fact must match the CardVault source at the commit in `content/site.mjs` (`cardvaultCommit`). Read the code before describing it. If unsure, leave it out.
- A link to a planned lesson that is not written yet renders as text marked "soon". Never link to unknown lesson ids.

## Design rules

- Colours are tokens in `src/styles.css`, with a dark theme. Green is the bank (under test), slate is a mock, gold is an event, red is a stop or error. Keep that meaning everywhere.
- Diagrams are hand-written SVG built with the helpers in `src/components.mjs`. Short labels; sentences go in the caption. Check each one in a screenshot at desktop and phone width, light and dark, before calling it done.
- The page must never scroll sideways at 390px. Wide figures, tables and code scroll inside their own box.

## Never put on the site

- Anything about CardVault's **seeded bugs**: the answer key (`docs/private/`), `scripts/bugs.txt`, bug flag names, where bug code lives, or excerpts of files that mention them (for example `docker-compose.yml` and `app/shared/logging.py`). Saying that stage has known bugs switched on is fine.
- The password-protected tools URL, test keys, passwords other than the public seed password `CardVault-Demo-1`, or anything from `.env` files on the server.

## App track: where it runs (added 2026-11-28)

- The app track has a module "Where it runs": `run-locally` and `stage-environment`. The stage lesson names only the public stage pages (app, docs, operator help) and the Live lab. The password-protected tools and lab-runner hosts stay off the site; they are documented in CardVault's `docs/STAGING.md`.
- `app-events` and `app-data` go one level deeper than the flows (topics, the envelope, per-service databases, copies built from events) but stay at what a tester needs: no outbox, locking or relay internals.

## Refreshing CardVault facts

Facts are pinned to `cardvaultCommit` in `content/site.mjs`. Run CardVault locally (`make up && make seed` in the cardvault repo), check the facts and retake screenshots, then update the commit.

## Playwright track (plan approved by the owner, 2026-11-27)

- Two parts in `content/site.mjs`: Part 1 teaches Playwright itself (modules 1 to 5), each concept shown on the CardVault web app with a small spec from CardVault's `tests/ui/learn/`; Part 2 (modules 6 to 8) is the CardVault framework, CI and interview practice. Plan doc: https://claude.ai/artifact/HTvgz61bBFJ4r4ziA6fxer
- Code blocks titled `tests/ui/...` are checked against `data/suite/tests/ui` (refresh with `tools/export-suite.sh ../cardvault`). Use `lang: 'typescript'`.
- Diagrams live in `content/diagrams/playwright.mjs`. Real terminal output only: run the suite and copy it.
