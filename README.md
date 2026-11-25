# CardVault Learn

A learning site that explains how [CardVault](https://github.com/lemegetonV/cardvault) works: what it does, how its services fit together, and how to test it. It is plain static HTML, built by a small Node script and served from a Cloudflare Worker at **https://cardvault-learn.x-bookmarks.workers.dev**.

The site grows in three tracks:

1. **Understand CardVault**: the architecture, in 9 modules. Modules 1 and 2 are written.
2. **Test the API with pytest**: later.
3. **Test the web app with Playwright**: later.

## Run it locally

You need Node.js 20 or newer.

```bash
npm ci
npm run build      # writes the site to dist/
npm run preview    # serves dist/ at http://localhost:4321
```

The build stops with a list of problems if a lesson links to a lesson id that does not exist. Links to lessons that are planned but not yet written render as plain text marked "later".

## Where things are

| Path | What it holds |
| --- | --- |
| `content/site.mjs` | Site facts, the tracks, modules and lessons, and which lessons are ready |
| `content/lessons/<id>.mjs` | One file per lesson: `minutes`, `lede`, `youWill` and `body` |
| `content/diagrams/` | Hand-drawn SVG diagrams, as functions that return SVG strings |
| `content/pages/` | The home page, service map, API explorer and event catalogue |
| `content/services.mjs` | Facts about each service and mock, used by the map and API pages |
| `src/components.mjs` | Building blocks: figures, callouts, code, tables, the step-through diagram, checks |
| `src/styles.css`, `src/site.js` | The design and the little JavaScript the pages need |
| `data/openapi/`, `data/events/` | OpenAPI documents and event schemas exported from CardVault |
| `tools/export-data.sh` | Refreshes `data/` from a running local CardVault stack |

## Adding a lesson

1. Create `content/lessons/<id>.mjs` (copy an existing lesson for the shape).
2. Mark the lesson ready in `content/site.mjs`.
3. Build and look at it at desktop and phone width, in light and dark mode.

Read `CLAUDE.md` first: it holds the writing and design rules every lesson follows.

## Deploying

Every push to `main` builds the site and deploys it with `wrangler deploy` (`.github/workflows/deploy.yml`). Pull requests run a build and a dry-run deploy. The workflow needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: an API token with the "Edit Cloudflare Workers" permission
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID
