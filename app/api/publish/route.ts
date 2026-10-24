// Static export (GitHub Pages) can't run server code.
// This stub only exists so `next build` with output: 'export' succeeds.
export const dynamic = 'force-static';

export async function GET() {
  return Response.json({
    ok: false,
    message: 'Publishing runs in the browser on the static site.',
  });
}
