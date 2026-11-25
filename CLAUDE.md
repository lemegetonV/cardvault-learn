# CardVault Learn

A learning site that teaches how CardVault (`lemegetonV/cardvault`) works, and later how to test it with pytest and Playwright. Static pages built by `build.mjs`, served from the Cloudflare Worker `cardvault-learn` (https://cardvault-learn.x-bookmarks.workers.dev). See `README.md` for commands and layout.

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
- Code only where it helps understanding, short, from the real CardVault source (say which file), and explained in prose underneath.
- Callouts, used sparingly: **Key idea** (the one thing to remember), **Through a tester's eyes** (what this means for tests), **In a real bank** (how real systems differ).
- Close with "Words from this lesson" (terms), "Check yourself" (2 to 3 self-contained questions that test reasoning, each with a "why"), and "Recap".
- Every fact must match the CardVault source at the commit in `content/site.mjs` (`cardvaultCommit`). Read the code before describing it. If unsure, leave it out.
- A link to a planned lesson that is not written yet renders as text marked "soon". Never link to unknown lesson ids.

## Design rules

- Colours are tokens in `src/styles.css`, with a dark theme. Green is the bank (under test), slate is a mock, gold is an event, red is a stop or error. Keep that meaning everywhere.
- Diagrams are hand-written SVG built with the helpers in `src/components.mjs`. Short labels; sentences go in the caption. Check each one in a screenshot at desktop and phone width, light and dark, before calling it done.
- The page must never scroll sideways at 390px. Wide figures, tables and code scroll inside their own box.

## Never put on the site

- Anything about CardVault's **seeded bugs**: the answer key (`docs/private/`), `scripts/bugs.txt`, bug flag names, where bug code lives, or excerpts of files that mention them (for example `docker-compose.yml` and `app/shared/logging.py`). The build strips the `/test/bugs` endpoint from the OpenAPI copies and fails if a spec still mentions bugs. Saying that stage has known bugs switched on is fine.
- The password-protected tools URL, test keys, passwords other than the public seed password `CardVault-Demo-1`, or anything from `.env` files on the server.

## Refreshing CardVault data

Run CardVault locally (`make up`), then `tools/export-data.sh ../cardvault`, and update `cardvaultCommit` in `content/site.mjs`.
