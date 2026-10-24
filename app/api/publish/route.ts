import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side publish: uses a GitHub token from environment secrets.
 *
 * Set one of these on the host (Vercel / Node server), never NEXT_PUBLIC_:
 *   PORTFOLIO_GITHUB_TOKEN  (preferred)
 *   GH_PAT
 *   GITHUB_TOKEN
 *
 * Optional:
 *   PORTFOLIO_GITHUB_OWNER  (default allanvarghese567-lab)
 *   PORTFOLIO_GITHUB_REPO   (default allan-varghese-portfolio)
 */

const OWNER =
  process.env.PORTFOLIO_GITHUB_OWNER ||
  process.env.NEXT_PUBLIC_GITHUB_OWNER ||
  'allanvarghese567-lab';
const REPO =
  process.env.PORTFOLIO_GITHUB_REPO ||
  process.env.NEXT_PUBLIC_GITHUB_REPO ||
  'allan-varghese-portfolio';
const TOKEN =
  process.env.PORTFOLIO_GITHUB_TOKEN ||
  process.env.GH_PAT ||
  process.env.GITHUB_TOKEN ||
  '';

const PATH = 'src/data/portfolio.json';

function ghHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function getFileSha(path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    { headers: ghHeaders(), cache: 'no-store' }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Get file failed ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function putFile(
  path: string,
  content: string,
  message: string,
  sha: string | null
) {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: ghHeaders(),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Put ${path} failed ${res.status}: ${t.slice(0, 400)}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Server token not configured. Set secret PORTFOLIO_GITHUB_TOKEN (or GH_PAT) on the host.',
        code: 'NO_SERVER_TOKEN',
      },
      { status: 503 }
    );
  }

  let portfolio: unknown;
  try {
    const body = await req.json();
    portfolio = body?.portfolio ?? body;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (
    !portfolio ||
    typeof portfolio !== 'object' ||
    !(portfolio as { profile?: unknown }).profile ||
    !(portfolio as { experience?: unknown }).experience ||
    !(portfolio as { projects?: unknown }).projects
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Body must include portfolio with profile, experience, projects',
      },
      { status: 400 }
    );
  }

  const jsonText = JSON.stringify(portfolio, null, 2) + '\n';

  try {
    const currentSha = await getFileSha(PATH);
    if (currentSha) {
      const getRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
        { headers: ghHeaders(), cache: 'no-store' }
      );
      if (getRes.ok) {
        const file = (await getRes.json()) as { content?: string; encoding?: string };
        if (file.content) {
          const raw = Buffer.from(file.content, 'base64').toString('utf-8');
          const ts = new Date()
            .toISOString()
            .replace(/[:.]/g, '-')
            .slice(0, 19);
          const backupPath = `src/data/old/portfolio-${ts}.json`;
          await putFile(
            backupPath,
            raw,
            `Backup portfolio.json before admin publish (${ts})`,
            null
          );
        }
      }
    }

    const latestSha = await getFileSha(PATH);
    await putFile(
      PATH,
      jsonText,
      'Update portfolio content via admin (server secret)',
      latestSha
    );

    return NextResponse.json({
      ok: true,
      message:
        'Published via server secret. portfolio.json updated and previous version backed up under src/data/old/.',
      owner: OWNER,
      repo: REPO,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Publish failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    serverTokenConfigured: Boolean(TOKEN),
    owner: OWNER,
    repo: REPO,
    hint: TOKEN
      ? 'POST portfolio JSON to this endpoint to publish using the server secret.'
      : 'Set PORTFOLIO_GITHUB_TOKEN (fine-grained PAT, Contents: read/write) on the host.',
  });
}
