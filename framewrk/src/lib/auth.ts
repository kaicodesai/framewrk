import type { Env } from "../types";

export function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return (
    scheme === "Bearer" &&
    Boolean(token) &&
    Boolean(env.FRAMEWRK_DASHBOARD_TOKEN) &&
    token === env.FRAMEWRK_DASHBOARD_TOKEN
  );
}
