// Cloudflare Worker: holds the GitHub PAT as a secret and triggers the
// "update-portfolio" repository_dispatch on behalf of the admin page.
//
// Secrets (wrangler secret put ...):  GITHUB_TOKEN, PUBLISH_KEY
// Vars (wrangler.toml):               GITHUB_OWNER, GITHUB_REPO, ALLOWED_ORIGIN

const MAX_PAYLOAD_CHARS = 64000; // GitHub caps client_payload at ~65,535 chars

const sha256 = async (s) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

async function keyMatches(given, expected) {
  if (!given || !expected) return false;
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const originOk = allowed.includes(origin);

    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Publish-Key',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
    if (!originOk) return reply(403, { error: 'Origin not allowed' });

    if (!(await keyMatches(request.headers.get('X-Publish-Key'), env.PUBLISH_KEY))) {
      return reply(401, { error: 'Invalid publish key' });
    }

    let portfolio;
    try {
      ({ portfolio } = await request.json());
    } catch {
      return reply(400, { error: 'Body must be JSON: { "portfolio": {...} }' });
    }
    if (!portfolio || typeof portfolio !== 'object') {
      return reply(400, { error: 'Missing "portfolio" object' });
    }
    for (const k of ['profile', 'experience', 'projects']) {
      if (!(k in portfolio)) return reply(400, { error: `Missing required key: ${k}` });
    }

    const serialized = JSON.stringify(portfolio);
    if (serialized.length > MAX_PAYLOAD_CHARS) {
      return reply(413, {
        error: `portfolio.json is ${serialized.length} chars; GitHub dispatch limit is ~65,000. Remove embedded images/large text.`,
      });
    }

    // Owner/repo come from the Worker config, never from the client.
    const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`;
    const gh = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'portfolio-publish-proxy', // GitHub rejects requests without a UA
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'update-portfolio',
        client_payload: { portfolio: serialized },
      }),
    });

    if (gh.status === 204) return reply(200, { ok: true });
    const text = await gh.text();
    return reply(502, { error: `GitHub API ${gh.status}`, detail: text.slice(0, 300) });
  },
};
