const OWNER = process.env.NEXT_PUBLIC_GITHUB_OWNER!;
const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO!;

// Unicode-safe base64 for the GitHub Contents API
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export async function publishFile(opts: {
  token: string;   // personal access token entered by the admin at runtime
  path: string;    // e.g. "content/posts.json"
  content: string; // file contents
  message?: string;
  branch?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { token, path, content, message = `Update ${path}`, branch = 'main' } = opts;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  try {
    // Get the current sha if the file already exists (required for updates)
    let sha: string | undefined;
    const existing = await fetch(`${url}?ref=${branch}`, { headers });
    if (existing.ok) {
      sha = (await existing.json()).sha;
    } else if (existing.status !== 404) {
      return { ok: false, error: `Lookup failed (${existing.status})` };
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ message, content: toBase64(content), branch, sha }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.message ?? `Publish failed (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
