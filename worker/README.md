# Publish proxy (Cloudflare Worker)

Keeps the GitHub PAT out of the browser. The admin page sends the portfolio JSON +
a PUBLISH KEY to this Worker; the Worker checks the key and triggers the
`update-portfolio` workflow using the PAT stored as a Worker secret.

## Setup (one time)
1. Create a fine-grained PAT: repo `allan-varghese-portfolio` only, **Contents: Read and write**.
2. `cd worker && npx wrangler login`
3. `npx wrangler secret put GITHUB_TOKEN`   → paste the PAT
4. `npx wrangler secret put PUBLISH_KEY`    → make up a long random string
5. `npx wrangler deploy`                    → note the `*.workers.dev` URL
6. GitHub repo → Settings → Secrets and variables → Actions → **Variables** →
   add `PUBLISH_PROXY_URL` = the Worker URL, then re-run "Deploy to GitHub Pages".
   (Or skip this and paste the URL into /admin → GitHub credentials once.)
7. In /admin → GitHub credentials, enter PUBLISH KEY (same string as step 4). Publish.

Delete the old `PORTFOLIO_GITHUB_TOKEN` repository variable and revoke any PAT that was stored in it.

## Deploying from Cloudflare's git integration (dashboard)

If you connect this repo to a Worker in the Cloudflare dashboard (Workers & Pages -> your Worker -> Settings -> Builds):

- **Root directory:** `worker`  (the repo root is the Next.js site, which must NOT be built here)
- **Build command:** leave empty
- **Deploy command:** `npx wrangler deploy`
- **Worker name:** must match `name` in `worker/wrangler.toml` (`allan-varghese-portfolio`)

`GITHUB_OWNER`, `GITHUB_REPO` and `ALLOWED_ORIGIN` come from `wrangler.toml` on every deploy.
Add only the two secrets in the dashboard (Settings -> Variables and Secrets -> type **Secret**):
`GITHUB_TOKEN` and `PUBLISH_KEY`.

## Troubleshooting

| Message in /admin | Meaning |
|---|---|
| `GitHub API error 401: Bad credentials` (direct mode) | The TOKEN field holds an expired/invalid/empty token |
| `Publish failed (401): Invalid publish key` | PUBLISH KEY in /admin differs from the Worker secret `PUBLISH_KEY` |
| `Publish failed (502): GitHub API 401` | The Worker secret `GITHUB_TOKEN` is bad; run `wrangler secret put GITHUB_TOKEN` again |
| `Publish failed (403): Origin not allowed` | Publish from the origin listed in `ALLOWED_ORIGIN` |
