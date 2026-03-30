import { db } from "@workspace/db";
import {
  ambassadorsTable,
  referralsTable,
  syncJobsTable,
  appSettingsTable,
} from "@workspace/db/schema";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  getConfig,
  getAllAmbassadors,
  getAllCommissions,
  normalizeAmbassador,
  normalizeReferral,
} from "./getambassador";
import {
  generateDashboardSlug,
  generateDashboardToken,
  generateIframeUrl,
} from "./dashboard-generator";
import { mapCustomFields } from "../config/field-mapping";
import { classifyReferralType } from "./referral-classifier";

function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(",");
    return `https://${domains[0]}`;
  }
  return "http://localhost";
}

export async function runSync(jobType: string = "FULL"): Promise<number> {
  // Check credentials before creating a job record
  const config = await getConfig();
  if (!config) {
    const [job] = await db
      .insert(syncJobsTable)
      .values({
        jobType,
        status: "FAILED",
        startedAt: new Date(),
        completedAt: new Date(),
        recordsProcessed: 0,
        recordsFailed: 0,
        errorLog:
          "GetAmbassador API credentials are not configured. Set GETAMBASSADOR_API_BASE_URL, GETAMBASSADOR_API_USERNAME, and GETAMBASSADOR_API_TOKEN as Replit Secrets, or configure them in Settings.",
        updatedAt: new Date(),
      })
      .returning();
    logger.warn("Sync aborted: GetAmbassador API not configured");
    return job.id;
  }

  const [job] = await db
    .insert(syncJobsTable)
    .values({
      jobType,
      status: "RUNNING",
      startedAt: new Date(),
    })
    .returning();

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    if (jobType === "FULL" || jobType === "AMBASSADORS_ONLY") {
      const result = await syncAmbassadors();
      processed += result.processed;
      failed += result.failed;
      if (result.errors.length > 0) errors.push(...result.errors);

      // After contacts are saved, resolve referrerAmbassadorId FKs for every prospect
      // that has a referrerEmail recorded. Runs on every sync so new advocates added
      // after their prospects were first synced get linked retroactively.
      await resolveReferrerLinks();

      // Resolve custom8 (referring short code) → referrer_ambassador_id for prospects
      // that had a custom8 value during this sync. Complements email-based resolution.
      if (result.shortCodeReferrals.size > 0) {
        await resolveShortCodeReferrers(result.shortCodeReferrals);
      }
    }

    if (jobType === "FULL" || jobType === "REFERRALS_ONLY") {
      const result = await syncReferrals();
      processed += result.processed;
      failed += result.failed;
      if (result.errors.length > 0) errors.push(...result.errors);
    }

    const finalStatus =
      processed === 0 && errors.length > 0
        ? "FAILED"
        : failed > 0
          ? "COMPLETED_WITH_ERRORS"
          : "COMPLETED";

    await db
      .update(syncJobsTable)
      .set({
        status: finalStatus,
        recordsProcessed: processed,
        recordsFailed: failed,
        errorLog: errors.length > 0 ? errors.slice(0, 50).join("\n") : null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(syncJobsTable.id, job.id));

    await db
      .insert(appSettingsTable)
      .values({ key: "lastSyncAt", value: new Date().toISOString() })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: new Date().toISOString(), updatedAt: new Date() },
      });

    logger.info({ jobId: job.id, processed, failed, finalStatus }, "Sync completed");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    await db
      .update(syncJobsTable)
      .set({
        status: "FAILED",
        recordsProcessed: processed,
        recordsFailed: failed,
        errorLog: errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(syncJobsTable.id, job.id));

    logger.error({ err: error instanceof Error ? error.message : String(error), jobId: job.id }, "Sync failed");
  }

  return job.id;
}

async function syncAmbassadors(): Promise<{
  processed: number;
  failed: number;
  errors: string[];
  shortCodeReferrals: Map<number, string>;
}> {
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];
  // Map of prospect DB id → custom8 referring short code, for post-sync resolution
  const shortCodeReferrals = new Map<number, string>();
  let page = 1;
  let hasMore = true;

  const baseUrl = getAppBaseUrl();

  while (hasMore) {
    try {
      const data = await getAllAmbassadors(page);
      hasMore = data.hasMore;

      for (const raw of data.results) {
        try {
          // normalized now includes referringShortCode which maps to the DB column referring_short_code
          const normalized = normalizeAmbassador(raw);

          const [existing] = await db
            .select({ id: ambassadorsTable.id, shortCode: ambassadorsTable.shortCode })
            .from(ambassadorsTable)
            .where(
              eq(ambassadorsTable.getAmbassadorUid, normalized.getAmbassadorUid),
            )
            .limit(1);

          const isProspect = normalized.contactType === "prospect";

          if (existing) {
            // normalizeAmbassador returns null for numeric-only mbsy IDs.
            // For advocates: prefer the normalized code; if null, preserve any
            //   existing alphanumeric code that was set manually.
            // For prospects: never store a short code — they have no referral links.
            const existingIsAlphanumeric =
              !!existing.shortCode && !/^\d+$/.test(existing.shortCode);
            const shortCodeToWrite = isProspect
              ? null
              : (normalized.shortCode ?? (existingIsAlphanumeric ? existing.shortCode : null));

            await db
              .update(ambassadorsTable)
              .set({
                email: normalized.email,
                firstName: normalized.firstName,
                lastName: normalized.lastName,
                shortCode: shortCodeToWrite,
                status: normalized.status,
                contactType: normalized.contactType,
                company: normalized.company,
                jobTitle: normalized.jobTitle,
                approvedAt: normalized.approvedAt,
                shiftsCount: normalized.shiftsCount,
                totalShifts: normalized.totalShifts,
                referringShortCode: normalized.referringShortCode,
                journeyStatus: normalized.journeyStatus,
                referrerEmail: normalized.referrerEmail,
                uniqueReferrals: normalized.uniqueReferrals,
                countClicks: normalized.countClicks,
                countShares: normalized.countShares,
                totalMoneyEarned: normalized.totalMoneyEarned,
                moneyPaid: normalized.moneyPaid,
                moneyPending: normalized.moneyPending,
                balanceMoney: normalized.balanceMoney,
                enrolledAt: normalized.enrolledAt,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(
                eq(
                  ambassadorsTable.getAmbassadorUid,
                  normalized.getAmbassadorUid,
                ),
              );

            // Track custom8 for post-sync short code referrer resolution
            if (isProspect && normalized.referringShortCode) {
              shortCodeReferrals.set(existing.id, normalized.referringShortCode);
            }
          } else if (isProspect) {
            // Prospects don't have dashboards — generate a stable unique slug
            // prefix with "prospect-". Use shortCode when available, else uid.
            const slugKey = normalized.shortCode ?? normalized.getAmbassadorUid;
            const slug = `prospect-${slugKey}`;
            const [inserted] = await db.insert(ambassadorsTable).values({
              ...normalized,
              dashboardSlug: slug,
              dashboardToken: "",
              iframeUrl: null,
              dashboardAccountCreated: false,
              lastSyncedAt: new Date(),
            }).returning({ id: ambassadorsTable.id });

            // Track custom8 for post-sync short code referrer resolution
            if (inserted && normalized.referringShortCode) {
              shortCodeReferrals.set(inserted.id, normalized.referringShortCode);
            }
          } else {
            // Advocates may not have a GA referral short code yet (no referral link set up).
            // Fall back to the email prefix for slug/iframeUrl generation in that case.
            const slugKey = normalized.shortCode ?? normalized.email.split("@")[0];
            const token = generateDashboardToken();
            const slug = generateDashboardSlug(slugKey);
            const iframeUrl = generateIframeUrl(
              baseUrl,
              slugKey,
              token,
            );

            await db.insert(ambassadorsTable).values({
              ...normalized,
              dashboardSlug: slug,
              dashboardToken: token,
              iframeUrl,
              dashboardAccountCreated: true,
              lastSyncedAt: new Date(),
            });
          }
          processed++;
        } catch (err) {
          failed++;
          const msg = `Failed to sync ambassador ${raw.uid}: ${
            err instanceof Error ? err.message : String(err)
          }`;
          errors.push(msg);
          logger.error(
            { err: err instanceof Error ? err.message : String(err), ambassadorUid: raw.uid },
            "Failed to sync ambassador",
          );
        }
      }

      page++;
    } catch (err) {
      hasMore = false;
      failed++;
      const msg = `Failed to fetch ambassadors page ${page}: ${
        err instanceof Error ? err.message : String(err)
      }`;
      errors.push(msg);
      logger.error({ err: err instanceof Error ? err.message : String(err), page }, "Failed to fetch ambassadors page");
    }
  }

  return { processed, failed, errors, shortCodeReferrals };
}

async function syncReferrals(): Promise<{
  processed: number;
  failed: number;
  errors: string[];
}> {
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  // Build a lookup map from ambassador email → ambassador DB record.
  // Used to link commissions fetched from `commission/all` back to ambassadors.
  const ambassadors = await db
    .select({
      id: ambassadorsTable.id,
      email: ambassadorsTable.email,
    })
    .from(ambassadorsTable);

  const ambassadorByEmail = new Map(ambassadors.map((a) => [a.email.toLowerCase(), a]));

  // Fetch commissions via `commission/all` — the only valid commission endpoint
  // in the GetAmbassador v2 API. Per-ambassador endpoints (e.g. commission/ambassador/{email})
  // return HTTP 404 for this account. Each commission record is expected to carry
  // an `ambassador_email` or nested `ambassador.email` field for association.
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const data = await getAllCommissions(page);
      hasMore = data.hasMore;

      for (const raw of data.results) {
        try {
          // Find the ambassador this commission belongs to
          const ambassadorEmail =
            (raw.ambassador_email as string | undefined) ||
            (raw.ambassador as { email?: string } | undefined)?.email;

          const ambassador = ambassadorEmail
            ? ambassadorByEmail.get(ambassadorEmail.toLowerCase())
            : undefined;

          if (!ambassador) {
            failed++;
            const skipMsg = ambassadorEmail
              ? `Commission ${raw.uid ?? "unknown"} references ambassador email "${ambassadorEmail}" not found in DB — skipping`
              : `Commission ${raw.uid ?? "unknown"} has no ambassador email field — cannot associate`;
            errors.push(skipMsg);
            logger.warn(
              { ambassadorEmail, commissionUid: raw.uid },
              "Commission could not be associated with an ambassador",
            );
            continue;
          }

          const normalized = normalizeReferral(raw);
          const customFields = mapCustomFields({
            custom1: raw.custom1,
            custom2: raw.custom2,
            custom3: raw.custom3,
            custom4: raw.custom4,
            custom5: raw.custom5,
            custom6: raw.custom6,
            custom9: raw.custom9,
            custom10: raw.custom10,
          });

          const sourceType = classifyReferralType({
            companyName: customFields.companyName,
            associatedOfficeId: customFields.associatedOfficeId,
            totalShiftsWorked: customFields.totalShiftsWorked,
            jobTitle: customFields.jobTitleOrReferralType,
          });

          const referralData = {
            ...normalized,
            ambassadorId: ambassador.id,
            sourceType,
            companyName: customFields.companyName || null,
            jobTitle: customFields.jobTitleOrReferralType || null,
            associatedOfficeId: customFields.associatedOfficeId || null,
            numberShiftsWorked: customFields.numberShiftsWorked
              ? parseInt(customFields.numberShiftsWorked, 10) || 0
              : null,
            totalShiftsWorked: customFields.totalShiftsWorked
              ? parseInt(customFields.totalShiftsWorked, 10) || 0
              : null,
            approvedAt: customFields.approvedAt
              ? new Date(customFields.approvedAt)
              : null,
          };

          // Upsert by sourceRecordId to keep sync idempotent
          if (normalized.sourceRecordId) {
            const [existing] = await db
              .select({ id: referralsTable.id })
              .from(referralsTable)
              .where(eq(referralsTable.sourceRecordId, normalized.sourceRecordId))
              .limit(1);

            if (existing) {
              await db
                .update(referralsTable)
                .set({ ...referralData, updatedAt: new Date() })
                .where(eq(referralsTable.sourceRecordId, normalized.sourceRecordId));
            } else {
              await db.insert(referralsTable).values(referralData);
            }
          } else {
            // No unique ID — insert only (cannot safely upsert)
            await db.insert(referralsTable).values(referralData);
          }

          processed++;
        } catch (err) {
          failed++;
          const msg = `Failed to sync commission ${raw.uid || "unknown"}: ${
            err instanceof Error ? err.message : String(err)
          }`;
          errors.push(msg);
          logger.error(
            { err: err instanceof Error ? err.message : String(err), commissionUid: raw.uid },
            "Failed to sync commission",
          );
        }
      }

      page++;
    } catch (err) {
      hasMore = false;
      failed++;
      const msg = `Failed to fetch commissions page ${page}: ${
        err instanceof Error ? err.message : String(err)
      }`;
      errors.push(msg);
      logger.error(
        { err: err instanceof Error ? err.message : String(err), page },
        "Failed to fetch commissions page",
      );
    }
  }

  return { processed, failed, errors };
}

/**
 * For every prospect that has a non-null referrerEmail stored, attempt to find
 * the matching advocate in the ambassadors table (by email, case-insensitive)
 * and write their DB id into referrerAmbassadorId.
 *
 * This runs on every sync so:
 *  - Prospects synced before their referrer was added get linked retroactively.
 *  - Any new prospects with referrerEmail set are linked immediately.
 *
 * Note: The GetAmbassador API v2 /ambassador/all endpoint does not currently
 * return a referrer field on prospect records. This function fires when that
 * data becomes available (e.g. via webhooks writing referrerEmail, or a future
 * API field mapped in normalizeAmbassador).
 */
async function resolveReferrerLinks(): Promise<void> {
  // Build lookup: advocate email (lowercased) -> { id, firstName, lastName }
  const advocates = await db
    .select({ id: ambassadorsTable.id, email: ambassadorsTable.email, firstName: ambassadorsTable.firstName, lastName: ambassadorsTable.lastName })
    .from(ambassadorsTable)
    .where(eq(ambassadorsTable.contactType, "advocate"));

  const advocateByEmail = new Map(
    advocates.map((a) => [a.email.toLowerCase(), a]),
  );

  // Find prospects that have a referrerEmail but no resolved FK yet
  const prospectsToResolve = await db
    .select({
      id: ambassadorsTable.id,
      referrerEmail: ambassadorsTable.referrerEmail,
    })
    .from(ambassadorsTable)
    .where(
      and(
        eq(ambassadorsTable.contactType, "prospect"),
        isNotNull(ambassadorsTable.referrerEmail),
        isNull(ambassadorsTable.referrerAmbassadorId),
      ),
    );

  let resolved = 0;
  for (const prospect of prospectsToResolve) {
    if (!prospect.referrerEmail) continue;
    const advocate = advocateByEmail.get(prospect.referrerEmail.toLowerCase());
    if (!advocate) continue;

    await db
      .update(ambassadorsTable)
      .set({
        referrerAmbassadorId: advocate.id,
        referrerName: `${advocate.firstName} ${advocate.lastName}`.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(ambassadorsTable.id, prospect.id));
    resolved++;
  }

  logger.info(
    { resolved, totalProspectsWithReferrerEmail: prospectsToResolve.length },
    "Referrer link resolution complete",
  );
}

/**
 * For every prospect where custom8 contained a referring ambassador's short code,
 * look up that short code in the ambassadors table and write their DB id into
 * referrerAmbassadorId. This is the primary referral attribution mechanism when
 * the GA API does not provide a referrer email directly.
 *
 * @param shortCodeReferrals Map of prospect DB id → custom8 referring short code
 */
async function resolveShortCodeReferrers(
  shortCodeReferrals: Map<number, string>,
): Promise<void> {
  // In-memory pass: resolve records processed in this sync run
  if (shortCodeReferrals.size > 0) {
    const advocates = await db
      .select({ id: ambassadorsTable.id, shortCode: ambassadorsTable.shortCode, firstName: ambassadorsTable.firstName, lastName: ambassadorsTable.lastName })
      .from(ambassadorsTable)
      .where(
        and(
          eq(ambassadorsTable.contactType, "advocate"),
          isNotNull(ambassadorsTable.shortCode),
        ),
      );

    const advocateByShortCode = new Map(
      advocates
        .filter((a) => a.shortCode)
        .map((a) => [a.shortCode!.toLowerCase(), a.id]),
    );

    const advocateById = new Map(
      advocates.filter((a) => a.shortCode).map((a) => [a.id, a]),
    );

    let resolved = 0;
    for (const [prospectId, referringCode] of shortCodeReferrals) {
      const advocateId = advocateByShortCode.get(referringCode.toLowerCase());
      if (!advocateId) continue;
      const advocate = advocateById.get(advocateId);

      await db
        .update(ambassadorsTable)
        .set({
          referrerAmbassadorId: advocateId,
          referrerName: advocate ? `${advocate.firstName} ${advocate.lastName}`.trim() || null : null,
          updatedAt: new Date(),
        })
        .where(eq(ambassadorsTable.id, prospectId));
      resolved++;
    }

    logger.info(
      { resolved, totalProspectsWithShortCode: shortCodeReferrals.size },
      "Short code referrer resolution (in-memory pass) complete",
    );
  }

  // DB-level pass: resolve any previously synced records that still have
  // referring_short_code populated but no referrer_ambassador_id resolved yet
  await runDbLevelReferrerResolution();
}

/**
 * Runs a single SQL UPDATE to resolve all prospects whose referring_short_code
 * matches an advocate's short_code but whose referrer_ambassador_id is still NULL.
 * Returns { resolved, unresolved, errors }.
 */
export async function resolveAllPendingReferrers(): Promise<{
  resolved: number;
  unresolved: number;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    await runDbLevelReferrerResolution();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    logger.error({ err }, "DB-level referrer resolution error");
  }

  // Count unresolved after the pass
  const unresolvedRows = await db
    .select({ id: ambassadorsTable.id })
    .from(ambassadorsTable)
    .where(
      and(
        isNotNull(ambassadorsTable.referringShortCode),
        isNull(ambassadorsTable.referrerAmbassadorId),
      ),
    );

  // Count resolved (has both referringShortCode and referrerAmbassadorId)
  const resolvedRows = await db
    .select({ id: ambassadorsTable.id })
    .from(ambassadorsTable)
    .where(
      and(
        isNotNull(ambassadorsTable.referringShortCode),
        isNotNull(ambassadorsTable.referrerAmbassadorId),
      ),
    );

  return {
    resolved: resolvedRows.length,
    unresolved: unresolvedRows.length,
    errors,
  };
}

async function runDbLevelReferrerResolution(): Promise<void> {
  await db.execute(sql`
    UPDATE ambassadors AS prospect
    SET referrer_ambassador_id = advocate.id,
        referrer_name = TRIM(CONCAT(advocate.first_name, ' ', advocate.last_name)),
        updated_at = NOW()
    FROM ambassadors AS advocate
    WHERE prospect.referring_short_code IS NOT NULL
      AND prospect.referrer_ambassador_id IS NULL
      AND LOWER(prospect.referring_short_code) = LOWER(advocate.short_code)
  `);
  logger.info("DB-level referrer resolution pass complete");
}
