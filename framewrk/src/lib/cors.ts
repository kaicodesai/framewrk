// The dashboard (Cloudflare Pages) and this API (a Worker) are always
// different origins, in local dev and in production alike, so every
// response needs CORS headers or the browser silently blocks it. The
// Bearer token check is the actual security boundary, not CORS — so a
// permissive origin here is fine for this founder-only internal tool.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
