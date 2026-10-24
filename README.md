# Allan Varghese — JSON-driven developer portfolio

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

### One-time setup

1. Push this repository to GitHub (if you haven’t already).
2. Create a **fine-grained Personal Access Token**:
   - GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Resource owner: your account
   - Repository access: **Only select repositories** → choose this portfolio repo
   - Permissions → Repository permissions → **Contents: Read and write**
   - Generate and copy the token
3. Open `/admin` → click **GitHub settings**
   - Owner: your GitHub username (default already set to `allanvarghese567-lab`)
   - Repository name: the exact name of this portfolio repository
   - Paste the token (stored only in your browser’s `localStorage`)

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

## Deploy

### GitHub Pages (static)

If you want a pure static site on GitHub Pages, change `next.config.ts` to:

```ts
const nextConfig = { output: 'export' };
```

Then configure the repository’s Pages source to the `gh-pages` branch or GitHub Actions static export workflow.

### Vercel / Node host

Import the repository into Vercel (or any Node host). Framework preset: Next.js. Build command: `npm run build`.
