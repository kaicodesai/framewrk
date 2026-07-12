import type { Env } from "../types";

// OpenRouter's free-tier catalog changes over time and hardcoding more
// guesses here just repeats the same failure mode (a model that's since
// been retired/moved to paid). This one known-good default is tried first;
// if it's congested, completeChat below asks OpenRouter's own /models
// endpoint for whatever is actually free right now instead of guessing.
const DEFAULT_FREE_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

async function fetchLiveFreeModelIds(env: Env, exclude: Set<string>): Promise<string[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id: string }[] };
    return (data.data ?? [])
      .map((m) => m.id)
      .filter((id) => id.endsWith(":free") && !exclude.has(id));
  } catch {
    return [];
  }
}

async function callModel(
  env: Env,
  model: string,
  params: { system: string; user: string },
  maxAttempts = 2
): Promise<string> {
  // Free-tier models get transiently 429 rate-limited under load — retry a
  // couple of times with a short, capped backoff before moving on.
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    });

    if (res.ok) {
      const responseJson = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = responseJson.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`OpenRouter response had no message content (model: ${model})`);
      }
      return content;
    }

    const body = await res.text().catch(() => "");
    lastError = `OpenRouter request failed (${res.status}) for model ${model}: ${body}`;

    if (res.status !== 429 || attempt === maxAttempts) {
      throw new Error(lastError);
    }

    const retryAfterHeader = Number(res.headers.get("retry-after"));
    const waitSeconds = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? Math.min(retryAfterHeader, 8)
      : 4;
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  }

  throw new Error(lastError);
}

export async function completeChat(
  env: Env,
  params: { system: string; user: string }
): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    return (
      `[STUB — OPENROUTER_API_KEY not set, this is placeholder output for local dev]\n\n` +
      `System prompt was:\n${params.system}\n\nUser prompt was:\n${params.user}`
    );
  }

  if (env.OPENROUTER_MODEL) {
    return callModel(env, env.OPENROUTER_MODEL, params);
  }

  const errors: string[] = [];
  const tried = new Set<string>([DEFAULT_FREE_MODEL]);

  try {
    return await callModel(env, DEFAULT_FREE_MODEL, params);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // Default was unavailable (congested or retired) — ask OpenRouter what's
  // actually free right now and try a few, one attempt each (breadth over
  // depth, since we may be working through several candidates).
  const liveCandidates = (await fetchLiveFreeModelIds(env, tried)).slice(0, 4);
  for (const model of liveCandidates) {
    try {
      return await callModel(env, model, params, 1);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error(`All models exhausted:\n${errors.join("\n")}`);
}
