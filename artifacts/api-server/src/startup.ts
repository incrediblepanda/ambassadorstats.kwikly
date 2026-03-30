import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  adminUsersTable,
  ambassadorsTable,
  referralsTable,
  rawApiPayloadsTable,
} from "@workspace/db/schema";
import { or, sql, count, isNull, eq } from "drizzle-orm";
import { logger } from "./lib/logger";
import { getSetting, setSetting, normalizeBaseUrl } from "./lib/settings";
import { generateIframeUrl } from "./services/dashboard-generator";
import { runSync } from "./services/sync-engine";

function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(",");
    return `https://${domains[0]}`;
  }
  return "http://localhost";
}

export async function runStartupTasks(): Promise<void> {
  logEnvStatus();
  await bootstrapAdmin();
  await migrateBaseUrl();
  await migrateAppBaseUrl();
  await seedSyncEnabled();
  await clearSeededDataAndSync();
  await regenerateIframeUrls();
}

function logEnvStatus(): void {
  const envVars = {
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    GETAMBASSADOR_API_BASE_URL: !!process.env.GETAMBASSADOR_API_BASE_URL,
    GETAMBASSADOR_API_USERNAME: !!process.env.GETAMBASSADOR_API_USERNAME,
    GETAMBASSADOR_API_TOKEN: !!process.env.GETAMBASSADOR_API_TOKEN,
    APP_BASE_URL: !!process.env.APP_BASE_URL,
    REPLIT_DOMAINS: !!process.env.REPLIT_DOMAINS,
    ADMIN_BOOTSTRAP_EMAIL: !!process.env.ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD: !!process.env.ADMIN_BOOTSTRAP_PASSWORD,
  };

  logger.info({ envVars }, "Environment variable status");

  if (!process.env.SESSION_SECRET) {
    logger.warn(
      "SESSION_SECRET not set — using insecure fallback. Set this secret before deploying.",
    );
  }

  const apiConfigured =
    envVars.GETAMBASSADOR_API_BASE_URL &&
    envVars.GETAMBASSADOR_API_USERNAME &&
    envVars.GETAMBASSADOR_API_TOKEN;

  if (apiConfigured) {
    logger.info("GetAmbassador API credentials configured via environment");
  } else {
    const missing: string[] = [];
    if (!envVars.GETAMBASSADOR_API_BASE_URL) missing.push("GETAMBASSADOR_API_BASE_URL");
    if (!envVars.GETAMBASSADOR_API_USERNAME) missing.push("GETAMBASSADOR_API_USERNAME");
    if (!envVars.GETAMBASSADOR_API_TOKEN) missing.push("GETAMBASSADOR_API_TOKEN");
    logger.warn(
      { missing },
      "GetAmbassador API partially or not configured. Live sync will not work until all credentials are set. Missing: " +
        missing.join(", "),
    );
  }
}

async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    logger.info(
      "No ADMIN_BOOTSTRAP_EMAIL/PASSWORD set — skipping admin bootstrap. Use seed script or set secrets to create an admin.",
    );
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    await db
      .insert(adminUsersTable)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        role: "admin",
        isActive: true,
      })
      .onConflictDoNothing();

    logger.info({ email: email.toLowerCase() }, "Admin user bootstrapped (or already exists)");
  } catch (err) {
    logger.error({ err }, "Failed to bootstrap admin user");
  }
}

/**
 * One-time migration: ensure any previously stored GetAmbassador base URL is
 * in the canonical form `https://api.getambassador.com/api/v2`.
 */
async function migrateBaseUrl(): Promise<void> {
  try {
    const stored = await getSetting("getAmbassadorApiBaseUrl");
    if (!stored) return;
    const normalized = normalizeBaseUrl(stored);
    if (normalized === stored) return;
    await setSetting("getAmbassadorApiBaseUrl", normalized);
    logger.info(
      { before: stored, after: normalized },
      "Migrated stored getAmbassadorApiBaseUrl to canonical form",
    );
  } catch (err) {
    logger.error({ err }, "Failed to migrate getAmbassadorApiBaseUrl");
  }
}

/**
 * Set appBaseUrl in app_settings from REPLIT_DOMAINS env if:
 * - it is not yet set, OR
 * - the stored value contains a stale pattern (localhost, worf.replit.dev)
 */
async function migrateAppBaseUrl(): Promise<void> {
  try {
    const computed = getAppBaseUrl();
    if (!computed || computed === "http://localhost") return;

    const stored = await getSetting("appBaseUrl");
    const isStale =
      !stored ||
      stored === "http://localhost" ||
      stored.includes("worf.replit.dev");

    if (isStale) {
      await setSetting("appBaseUrl", computed);
      logger.info({ appBaseUrl: computed }, "Set appBaseUrl from environment");
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "Failed to migrate appBaseUrl");
  }
}

/**
 * Ensure syncEnabled defaults to "true" if not already set.
 */
async function seedSyncEnabled(): Promise<void> {
  try {
    const existing = await getSetting("syncEnabled");
    if (!existing) {
      await setSetting("syncEnabled", "true");
      logger.info("Set syncEnabled default to true");
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "Failed to seed syncEnabled");
  }
}

/**
 * Detect fake/seeded ambassador data and clear it, then trigger a full sync.
 *
 * Detection criteria:
 *  1. Any ambassador row has get_ambassador_uid starting with "seed-" or "fake-"
 *  2. Ambassador rows exist but raw_api_payloads is empty (implies seed data, not live data)
 */
async function clearSeededDataAndSync(): Promise<void> {
  try {
    let shouldClear = false;

    const [seededRow] = await db
      .select({ id: ambassadorsTable.id })
      .from(ambassadorsTable)
      .where(
        or(
          sql`${ambassadorsTable.getAmbassadorUid} LIKE 'seed-%'`,
          sql`${ambassadorsTable.getAmbassadorUid} LIKE 'fake-%'`,
        ),
      )
      .limit(1);

    if (seededRow) {
      shouldClear = true;
    } else {
      const [{ ambTotal }] = await db
        .select({ ambTotal: count() })
        .from(ambassadorsTable);
      const [{ rawTotal }] = await db
        .select({ rawTotal: count() })
        .from(rawApiPayloadsTable);
      if (Number(ambTotal) > 0 && Number(rawTotal) === 0) {
        shouldClear = true;
      }
    }

    if (!shouldClear) {
      logger.info("No seeded data detected — skipping data clear");
      return;
    }

    logger.info("Detected seeded/fake ambassador data — clearing tables and starting real sync");

    await db.delete(referralsTable);
    await db.delete(ambassadorsTable);
    await db.delete(rawApiPayloadsTable);

    logger.info("Seeded data cleared. Running full sync against GetAmbassador API…");
    await runSync("FULL");
    logger.info("Startup full sync completed");
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed during startup data clear/sync",
    );
  }
}

/**
 * Regenerate iframe_url for any ambassador where the URL is null, empty,
 * or still contains a stale host pattern (localhost, worf.replit.dev).
 */
async function regenerateIframeUrls(): Promise<void> {
  try {
    const baseUrl = getAppBaseUrl();
    if (!baseUrl || baseUrl === "http://localhost") return;

    const staleAmbassadors = await db
      .select({
        id: ambassadorsTable.id,
        shortCode: ambassadorsTable.shortCode,
        dashboardToken: ambassadorsTable.dashboardToken,
        iframeUrl: ambassadorsTable.iframeUrl,
      })
      .from(ambassadorsTable)
      .where(
        or(
          isNull(ambassadorsTable.iframeUrl),
          sql`${ambassadorsTable.iframeUrl} = ''`,
          sql`${ambassadorsTable.iframeUrl} LIKE '%localhost%'`,
          sql`${ambassadorsTable.iframeUrl} LIKE '%worf.replit.dev%'`,
        ),
      );

    if (staleAmbassadors.length === 0) {
      logger.info("All ambassador iframeUrls are up to date");
      return;
    }

    logger.info({ count: staleAmbassadors.length }, "Regenerating stale iframeUrls");

    for (const amb of staleAmbassadors) {
      const newUrl = generateIframeUrl(baseUrl, amb.shortCode, amb.dashboardToken);
      await db
        .update(ambassadorsTable)
        .set({ iframeUrl: newUrl, updatedAt: new Date() })
        .where(eq(ambassadorsTable.id, amb.id));
    }

    logger.info({ count: staleAmbassadors.length }, "iframeUrls regenerated successfully");
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to regenerate iframeUrls",
    );
  }
}
