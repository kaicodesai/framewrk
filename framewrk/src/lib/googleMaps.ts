import type { Env } from "../types";

export interface ParsedMapsUrl {
  businessNameGuess: string | null;
  lat: number | null;
  lng: number | null;
  resolvedUrl: string;
}

export interface PlaceDetails {
  business_name: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  photo_references: string[];
}

/**
 * Google Maps share links come in two shapes we need to handle:
 *  - short links: https://maps.app.goo.gl/xxxxx (redirect to the long form)
 *  - long links:  https://www.google.com/maps/place/Business+Name/@lat,lng,17z/data=...
 * We resolve short links, then regex the business name + coordinates out of
 * the long form. This is enough to disambiguate a Places "Find Place" lookup
 * for the one specific place the founder pasted — no Maps scraping/search.
 */
export async function parseGoogleMapsUrl(rawUrl: string): Promise<ParsedMapsUrl> {
  let url = rawUrl.trim();

  if (/goo\.gl\/maps|maps\.app\.goo\.gl/.test(url)) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      url = res.url || url;
    } catch {
      // fall through with the original short URL; regexes below will just fail
      // to match and callers get nulls back, which is a valid (if thin) result.
    }
  }

  const placeMatch = url.match(/\/maps\/place\/([^/@]+)/);
  const businessNameGuess = placeMatch
    ? decodeURIComponent(placeMatch[1]).replace(/\+/g, " ")
    : null;

  const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const lat = coordMatch ? Number.parseFloat(coordMatch[1]) : null;
  const lng = coordMatch ? Number.parseFloat(coordMatch[2]) : null;

  return { businessNameGuess, lat, lng, resolvedUrl: url };
}

/**
 * Best-effort scrape of the public Maps page for phone/category/address, used
 * when no GOOGLE_PLACES_API_KEY is configured (see lookupPlaceDetails below).
 *
 * NOT the reliable/supported path: most of a Maps page renders via JS after
 * load, so a plain fetch may miss data a browser would show; Google changes
 * page markup without notice, so these patterns can silently stop matching;
 * and this is outside Google's supported API for programmatic Maps access.
 * Chosen deliberately for now to avoid the Places API's billing-account
 * requirement — revisit (or add the official key back) if this proves too
 * unreliable in practice.
 */
async function scrapeMapsPage(
  url: string
): Promise<{ phone: string | null; category: string | null; address: string | null }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();

  const phoneMatch = html.match(/href="tel:([+\d()\-.\s]+)"/i);
  const phone = phoneMatch ? phoneMatch[1].trim() : null;

  const descMatch =
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i);
  const description = descMatch ? descMatch[1] : null;

  let category: string | null = null;
  let address: string | null = null;
  if (description) {
    // Common observed shapes: "<Category> in <City, State>" or
    // "<Category> · <Address>" — loose best-effort parse, not guaranteed.
    const inMatch = description.match(/^([^·|]+?)\s+in\s+(.+)$/i);
    if (inMatch) {
      category = inMatch[1].trim();
      address = inMatch[2].trim();
    } else {
      const parts = description
        .split(/[·|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        category = parts[0];
        address = parts[parts.length - 1];
      }
    }
  }

  return { phone, category, address };
}

/**
 * Looks up structured details (address, phone, category, photo references)
 * for the single place the founder submitted, via the official Places API.
 * Requires GOOGLE_PLACES_API_KEY. If it's not configured (e.g. local dev
 * without a key yet), returns nulls so the rest of the flow still works —
 * the founder can fill in details by hand on the prospect detail page.
 */
export async function lookupPlaceDetails(
  env: Env,
  parsed: ParsedMapsUrl
): Promise<PlaceDetails> {
  const empty: PlaceDetails = {
    business_name: parsed.businessNameGuess,
    category: null,
    address: null,
    phone: null,
    photo_references: [],
  };

  if (!parsed.businessNameGuess) {
    return empty;
  }

  if (!env.GOOGLE_PLACES_API_KEY) {
    // No official API key configured — best-effort scrape instead (see
    // scrapeMapsPage's own doc comment for why this is opt-in and unreliable).
    try {
      const scraped = await scrapeMapsPage(parsed.resolvedUrl);
      return {
        business_name: parsed.businessNameGuess,
        category: scraped.category,
        address: scraped.address,
        phone: scraped.phone,
        photo_references: [],
      };
    } catch {
      return empty;
    }
  }

  // Places lookup is a nice-to-have enrichment, not a hard requirement — any
  // failure here (bad key, API not enabled, quota, network hiccup) should
  // degrade to `empty` rather than crash prospect creation entirely.
  try {
    const findParams = new URLSearchParams({
      input: parsed.businessNameGuess,
      inputtype: "textquery",
      fields: "place_id",
      key: env.GOOGLE_PLACES_API_KEY,
    });
    if (parsed.lat !== null && parsed.lng !== null) {
      findParams.set("locationbias", `circle:200@${parsed.lat},${parsed.lng}`);
    }

    const findRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${findParams}`
    );
    const findJson = (await findRes.json()) as {
      candidates?: { place_id?: string }[];
    };
    const placeId = findJson.candidates?.[0]?.place_id;
    if (!placeId) return empty;

    const detailsParams = new URLSearchParams({
      place_id: placeId,
      fields: "name,formatted_address,formatted_phone_number,type,photo",
      key: env.GOOGLE_PLACES_API_KEY,
    });
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${detailsParams}`
    );
    const detailsJson = (await detailsRes.json()) as {
      result?: {
        name?: string;
        formatted_address?: string;
        formatted_phone_number?: string;
        types?: string[];
        photos?: { photo_reference: string }[];
      };
    };
    const result = detailsJson.result;
    if (!result) return empty;

    return {
      business_name: result.name ?? parsed.businessNameGuess,
      category: result.types?.[0]?.replace(/_/g, " ") ?? null,
      address: result.formatted_address ?? null,
      phone: result.formatted_phone_number ?? null,
      photo_references: result.photos?.map((p) => p.photo_reference) ?? [],
    };
  } catch {
    return empty;
  }
}
