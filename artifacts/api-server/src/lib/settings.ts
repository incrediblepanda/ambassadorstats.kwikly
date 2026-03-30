import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function getSetting(key: string): Promise<string | null> {
  const [result] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key))
    .limit(1);
  return result?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Normalise a raw GetAmbassador base URL into the canonical form:
 * `https://api.getambassador.com/api/v2`
 *
 * Handles:
 *  - Trailing slashes
 *  - Embedded path-auth segments (`/{username}/{token}/json/...`)
 *  - Missing or wrong API version suffix (e.g. /api/v1 → /api/v2)
 *
 * Throws for empty values or non-absolute http(s) URLs so callers can
 * surface a validation error rather than silently storing bad config.
 */
export function normalizeBaseUrl(raw: string): string {
  if (!raw || !raw.trim()) {
    throw new Error("Base URL must not be empty");
  }

  let url = raw.trim().replace(/\/+$/, "");

  // Reject relative or non-HTTP(S) URLs
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Base URL must begin with http:// or https://");
  }

  // Strip embedded path-auth segments that look like /user/token/json/...
  url = url.replace(/\/[^/]+\/[^/]+\/json(?:\/.*)?$/, "");

  // Coerce any /api/vN version to the canonical /api/v2
  url = url.replace(/\/api\/v[0-9]+(?:\/.*)?$/, "/api/v2");

  // Append /api/v2 if the URL has no version path at all
  if (!/\/api\/v[0-9]/.test(url)) {
    url = `${url}/api/v2`;
  }

  return url;
}
