# CardVault Learn

Interview prep built around [CardVault](https://github.com/lemegetonV/cardvault), a bank's card and wallet app. Plain static HTML, built by a small Node script and served from a Cloudflare Worker at **https://cardvault-learn.x-bookmarks.workers.dev**.

Three tracks of short lessons:

1. **Know the app**: the product, its screens, its services and how to explain the architecture.
2. **API testing with Python and pytest**: Python from zero, then a small, readable framework.
3. **UI testing with TypeScript and Playwright**: TypeScript from zero, then a Playwright framework.

## Run it locally

You need Node.js 20 or newer.

```bash
npm ci
npm run build      # writes the site to dist/
npm run preview    # serves dist/ at http://localhost:4321
```

The build stops with a list of problems if a lesson links to a lesson id that does not exist. Links to lessons that are planned but not yet written render as plain text marked "soon".

## Where things are

| Path | What it holds |
| --- | --- |
| `content/site.mjs` | Site facts, the tracks, modules and lessons, and which lessons are ready |
| `content/lessons/<id>.mjs` | One file per lesson: `minutes`, `lede`, `youWill` and `body` |
| `content/diagrams/` | Hand-drawn SVG diagrams, as functions that return SVG strings |
| `content/images/` | Screenshots of the real app |
| `content/pages/home.mjs` | The home page |
| `src/components.mjs` | Building blocks: figures, screenshots, callouts, code, tables, the step-through diagram, the interview corner |
| `src/styles.css`, `src/site.js` | The design and the little JavaScript the pages need |

## Adding a lesson

1. Create `content/lessons/<id>.mjs` (copy an existing lesson for the shape).
2. Mark the lesson ready in `content/site.mjs`.
3. Build and look at it at desktop and phone width, in light and dark mode.

Read `CLAUDE.md` first: it holds the writing and design rules every lesson follows.

## Deploying

Every push to `main` builds the site and deploys it with `wrangler deploy` (`.github/workflows/deploy.yml`). Pull requests run a build and a dry-run deploy. The workflow needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: an API token with the "Edit Cloudflare Workers" permission
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID
