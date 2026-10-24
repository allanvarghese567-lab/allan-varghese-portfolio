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
