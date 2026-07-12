export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function notFound(message = "Not found"): Response {
  return json({ error: message }, 404);
}

export function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

export function unauthorized(): Response {
  return json({ error: "Unauthorized" }, 401);
}
