# Allan Varghese — JSON-driven developer portfolio

**Live:** [https://allanvarghese567-lab.github.io/allan-varghese-portfolio/](https://allanvarghese567-lab.github.io/allan-varghese-portfolio/)

Premium dark / emerald responsive portfolio built with Next.js 15, React 19, TypeScript, and Lucide icons.

## Features
- All public portfolio content is sourced from `src/data/portfolio.json`.
- Sections: About, Experience, Skills, Projects, Achievements, Contact.
- Experience is calculated from the union of calendar months across all roles; overlapping jobs are only counted once.
- `/admin` provides forms for profile, about, roles, skill groups, projects, achievements, and contact links.
- Admin supports:
  - **Password-protected access** (authentication required)
  - Saving a browser-local draft
  - Importing / exporting JSON
  - Advanced JSON editing
  - **One-click Publish to GitHub** (triggers a GitHub Action)
- Previous versions of `portfolio.json` are automatically backed up under `src/data/old/`.
- Responsive dark emerald UI.

## Run locally

```bash
npm install
# Create .env.local (see Admin authentication below)
npm run dev
```

Open http://localhost:3000.  
Admin editor: http://localhost:3000/admin (password required).

## Admin authentication

The `/admin` page is protected by a password.

1. Create a file `.env.local` in the project root:

```bash
NEXT_PUBLIC_ADMIN_PASSWORD=your-strong-password-here
```

2. Restart the dev server (`npm run dev`).
3. Open `/admin` and enter the password.
4. Optionally check **Remember me on this device** so you stay logged in across browser restarts.
5. Use **Log out** in the header when finished.

**On production (Vercel / host):**  
Set the same environment variable `NEXT_PUBLIC_ADMIN_PASSWORD` in your hosting dashboard, then redeploy.

> Note: This is client-side protection suitable for a personal portfolio. The password value is embedded in the built JavaScript (as with any `NEXT_PUBLIC_` variable). Do not reuse an important password. For higher security you would need a server-side auth solution.

## Publish content changes (recommended)

The portfolio uses a local JSON file. The admin page cannot write files on the server directly, so publishing goes through a GitHub Action.

### Credentials (owner, repo, token)

GitHub Actions secrets (Repo → **Settings** → **Secrets and variables** → **Actions**):

| Secret name | Example value | Purpose |
|-------------|---------------|---------|
| **`NEXT_PUBLIC_ADMIN_PASSWORD`** | your admin login password | Required to open `/admin` |
| **`NEXT_PUBLIC_GITHUB_OWNER`** | `allanvarghese567-lab` | OWNER baked into admin at Pages build |
| **`NEXT_PUBLIC_GITHUB_REPO`** | `allan-varghese-portfolio` | REPO baked into admin at Pages build |

| Credential | Where it comes from | Notes |
|------------|---------------------|--------|
| **OWNER** | Secret `NEXT_PUBLIC_GITHUB_OWNER` (or admin form) | Default if secret missing: `allanvarghese567-lab` |
| **REPO** | Secret `NEXT_PUBLIC_GITHUB_REPO` (or admin form) | Default if secret missing: `allan-varghese-portfolio` |
| **TOKEN** | Admin → **GitHub credentials** only | Fine-grained PAT. **Never** an Actions secret on static Pages (browser cannot read secrets). Never use `NEXT_PUBLIC_` for the PAT |
| **Admin password** | Secret / `.env.local` `NEXT_PUBLIC_ADMIN_PASSWORD` | Required to open `/admin` |

**Vercel / Node (optional):** you can also set `PORTFOLIO_GITHUB_TOKEN` as a server env var so `/api/publish` works without a browser TOKEN. That path is not used on pure GitHub Pages.

### One-time setup

1. Push this repository to GitHub (if you haven’t already).
2. Add Actions secrets: `NEXT_PUBLIC_ADMIN_PASSWORD`, `NEXT_PUBLIC_GITHUB_OWNER`, `NEXT_PUBLIC_GITHUB_REPO` (values above).
3. Create a **fine-grained Personal Access Token** (this is TOKEN — for the admin form only):
   - Your **account** → Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Resource owner: your account
   - Repository access: **Only select repositories** → `allan-varghese-portfolio`
   - Permissions → Repository permissions → **Contents: Read and write**
   - Generate and copy the token once
4. Open `/admin` → **GitHub credentials**
   - OWNER / REPO should already match the secrets after a Pages deploy
   - **TOKEN:** paste the PAT (saved only in this browser’s `localStorage`)

### Everyday workflow

1. Open `/admin` and edit content with the forms.
2. Click **Publish to GitHub** (or go to the Publish tab).
3. The admin sends a `repository_dispatch` event with the updated JSON.
4. The workflow `.github/workflows/update-portfolio.yml` runs and:
   - Copies the current `src/data/portfolio.json` → `src/data/old/portfolio-YYYYMMDD-HHMMSS.json`
   - Writes the new content to `src/data/portfolio.json`
   - Runs `git add`, `git commit -m "Update portfolio content via admin"`, and `git push`
5. GitHub Pages (or any hosting that deploys on push) will rebuild with the new content.

You can still use **Download portfolio.json** and do a manual commit if you prefer.

### Manual fallback

```bash
# After downloading the new portfolio.json
cp ~/Downloads/portfolio.json src/data/portfolio.json
git add src/data/portfolio.json
git commit -m "Update portfolio content"
git push origin main
```

## Experience calculation

Experience is based on month-level dates. Current roles use the current month. Every calendar month is put into a set, so overlapping concurrent roles are only counted once.

## Accuracy notes

Role dates, degree, grade, current company, and passed Angular assessment are based on screenshots supplied by Allan. Project summaries and statuses are descriptive placeholders based on the project concepts/repositories discussed; confirm completion and public links before publishing. No unverified performance metrics are claimed.

## Live site

**GitHub Pages:** [https://allanvarghese567-lab.github.io/allan-varghese-portfolio/](https://allanvarghese567-lab.github.io/allan-varghese-portfolio/)

**Admin:** [https://allanvarghese567-lab.github.io/allan-varghese-portfolio/admin](https://allanvarghese567-lab.github.io/allan-varghese-portfolio/admin)

## Deploy

### GitHub Pages (static)

This repo is set up for GitHub Pages (no `gh-pages` branch — deploy via Actions):

1. Repo → **Settings** → **Pages** → Source: **GitHub Actions**
2. Add Actions secrets:
   - `NEXT_PUBLIC_ADMIN_PASSWORD`
   - `NEXT_PUBLIC_GITHUB_OWNER` = `allanvarghese567-lab`
   - `NEXT_PUBLIC_GITHUB_REPO` = `allan-varghese-portfolio`
3. Push to `main` (or run workflow **Deploy to GitHub Pages**)
4. Site: [https://allanvarghese567-lab.github.io/allan-varghese-portfolio/](https://allanvarghese567-lab.github.io/allan-varghese-portfolio/)

`next.config.ts` uses `output: 'export'`. The deploy workflow sets `GITHUB_PAGES=true` so `basePath` is applied, and injects OWNER/REPO from the secrets above.

Publish from `/admin` still needs a **browser TOKEN** (PAT in GitHub credentials), because Pages has no server API.

### Custom domain (optional)

GitHub Pages can serve the site from your own domain instead of `allanvarghese567-lab.github.io`.

**Suggested domains for this portfolio**

| Style | Examples |
|--------|----------|
| Name | `allanvarghese.dev`, `allanvarghese.com`, `allanvarghese.in` |
| Short / personal | `hiallan.dev`, `heyallan.dev`, `builtbyallan.dev` |
| Role-focused | `allan.codes`, `allanbuilds.dev`, `fullstackallan.dev` |
| India / local | `allanvarghese.in`, `allan.kerala.dev` (if available) |
| Product-style | `meridian.dev` only if it matches a brand you own long-term |

Practical picks: **`allanvarghese.dev`** or **`allanvarghese.com`** — clear, professional, easy to put on a résumé and LinkedIn.

**How to attach a custom domain**

1. Buy the domain (Namecheap, Google Domains / Squarespace, Cloudflare, Porkbun, etc.).
2. Repo → **Settings** → **Pages** → **Custom domain** → enter e.g. `allanvarghese.dev` → Save.
3. At your DNS provider, add:
   - **Apex (`allanvarghese.dev`):** A records to GitHub Pages IPs:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - **Or www:** CNAME `www` → `allanvarghese567-lab.github.io`
4. Wait for DNS (often 5–30 minutes). Enable **Enforce HTTPS** in Pages settings when available.
5. If the site is on a **custom domain at the root**, you may remove `basePath` / `assetPrefix` from `next.config.ts` (or stop setting `GITHUB_PAGES=true`) so assets load from `/` instead of `/allan-varghese-portfolio/`.

### Vercel / Node host

Import the repository into Vercel (or any Node host). Framework preset: Next.js. Build command: `npm run build`.
