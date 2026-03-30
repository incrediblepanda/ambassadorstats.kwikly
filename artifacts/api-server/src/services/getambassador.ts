import { db } from "@workspace/db";
import { appSettingsTable, rawApiPayloadsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { mapCustomFields } from "../config/field-mapping";

interface GetAmbassadorConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
}

async function getDbSetting(key: string): Promise<string | null> {
  try {
    const [result] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, key))
      .limit(1);
    return result?.value ?? null;
  } catch {
    return null;
  }
}

export async function getConfig(): Promise<GetAmbassadorConfig | null> {
  const baseUrl =
    process.env.GETAMBASSADOR_API_BASE_URL ||
    (await getDbSetting("getAmbassadorApiBaseUrl"));
  const username =
    process.env.GETAMBASSADOR_API_USERNAME ||
    (await getDbSetting("getAmbassadorUsername"));
  const apiToken =
    process.env.GETAMBASSADOR_API_TOKEN ||
    (await getDbSetting("getAmbassadorApiToken"));

  if (!baseUrl || !username || !apiToken) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    username,
    apiToken,
  };
}

export function getConfigStatus(): {
  baseUrlSet: boolean;
  usernameSet: boolean;
  tokenSet: boolean;
  source: "env" | "db" | "none";
} {
  const baseUrlEnv = !!process.env.GETAMBASSADOR_API_BASE_URL;
  const usernameEnv = !!process.env.GETAMBASSADOR_API_USERNAME;
  const tokenEnv = !!process.env.GETAMBASSADOR_API_TOKEN;

  return {
    baseUrlSet: baseUrlEnv,
    usernameSet: usernameEnv,
    tokenSet: tokenEnv,
    source: baseUrlEnv || usernameEnv || tokenEnv ? "env" : "none",
  };
}

/**
 * Build the full Ambassador Backend API URL using path-based authentication.
 * Pattern: {baseUrl}/{username}/{token}/json/{endpoint}
 * No HTTP auth headers are used — credentials live entirely in the URL path.
 */
function buildUrl(
  config: GetAmbassadorConfig,
  endpoint: string,
  queryParams?: Record<string, string | number>,
): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  const ep = endpoint.replace(/^\/+/, "").replace(/\/+$/, "");
  let url = `${base}/${config.username}/${config.apiToken}/json/${ep}/`;
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(queryParams).map(([k, v]) => [k, String(v)]),
      ),
    );
    url = `${url}?${params.toString()}`;
  }
  return url;
}

/** Same as buildUrl but replaces the token with [REDACTED] — safe for logging. */
function buildUrlRedacted(
  config: GetAmbassadorConfig,
  endpoint: string,
  queryParams?: Record<string, string | number>,
): string {
  return buildUrl(
    { ...config, apiToken: "[REDACTED]" },
    endpoint,
    queryParams,
  );
}

function serializeError(error: unknown): { err: string; cause?: string } {
  if (error instanceof Error) {
    return {
      err: error.message,
      cause:
        (error as NodeJS.ErrnoException).cause instanceof Error
          ? ((error as NodeJS.ErrnoException).cause as Error).message
          : (error as NodeJS.ErrnoException).cause != null
            ? String((error as NodeJS.ErrnoException).cause)
            : undefined,
    };
  }
  return { err: String(error) };
}

/**
 * Actual API response wrapper: { response: { code: "200", data: { ... } } }
 */
interface ApiResponse<T> {
  response?: {
    code?: string;
    data?: T;
  };
}

export interface RawAmbassador {
  uid?: string | null;
  email: string;
  first_name?: string;
  last_name?: string;
  short_code?: string | null;
  memorable_url?: string | null;
  status?: string;
  company?: string | null;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  custom4?: string;
  custom5?: string;
  custom6?: string;
  custom7?: string;
  custom8?: string;
  custom9?: string;
  custom10?: string;
  [key: string]: unknown;
}

export interface RawReferral {
  uid?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  ambassador_email?: string;
  campaign_uid?: string;
  order_id?: string;
  transaction_uid?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  custom4?: string;
  custom5?: string;
  custom6?: string;
  custom7?: string;
  custom8?: string;
  custom9?: string;
  custom10?: string;
  created?: string;
  status?: string;
  [key: string]: unknown;
}

async function storeRawPayload(
  sourceEndpoint: string,
  sourceRecordId: string | null,
  payload: unknown,
): Promise<void> {
  try {
    await db.insert(rawApiPayloadsTable).values({
      sourceEndpoint,
      sourceRecordId,
      payloadJson: payload,
      fetchedAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err }, "Failed to store raw API payload");
  }
}

/**
 * Extract the mbsy numeric ID from a memorable_url like
 * "https://blue.mbsy.co/kwikly/164419482" → "164419482"
 */
function extractMbsyId(memorableUrl?: string | null): string | null {
  if (!memorableUrl) return null;
  const parts = memorableUrl.replace(/\/+$/, "").split("/");
  const last = parts[parts.length - 1];
  return last && /^\d+$/.test(last) ? last : null;
}

export async function getAllAmbassadors(
  page = 1,
): Promise<{ results: RawAmbassador[]; hasMore: boolean }> {
  const config = await getConfig();
  if (!config) {
    logger.warn("GetAmbassador API not configured, returning empty results");
    return { results: [], hasMore: false };
  }

  const queryParams = { page, limit: 100 };
  const url = buildUrl(config, "ambassador/all", queryParams);
  const safeUrl = buildUrlRedacted(config, "ambassador/all", queryParams);
  logger.info({ url: safeUrl, page }, "Fetching ambassadors from GetAmbassador API");

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `GetAmbassador API returned ${response.status}: ${response.statusText} — ${body.slice(0, 300)}`,
      );
    }

    const raw = (await response.json()) as ApiResponse<{
      ambassadors?: RawAmbassador[];
      [key: string]: unknown;
    }>;

    await storeRawPayload(`ambassador/all:page${page}`, null, raw);

    const results = raw?.response?.data?.ambassadors ?? [];
    const hasMore = results.length === 100;

    logger.info({ page, count: results.length, hasMore }, "Fetched ambassadors page");
    return { results, hasMore };
  } catch (error) {
    logger.error(
      { ...serializeError(error), url: safeUrl, page },
      "Failed to fetch ambassadors from GetAmbassador",
    );
    throw error;
  }
}

/**
 * Fetch one page of the `referral/all` endpoint and store the raw payload.
 * "Referrals" in GetAmbassador are prospect sign-up actions (different from
 * "commissions", which are the monetary rewards). This endpoint may expose
 * the ambassador attribution we cannot get from `ambassador/all`.
 * Returns the raw response object so callers can inspect unknown field names.
 */
export async function fetchReferralAllRaw(page = 1): Promise<unknown> {
  const config = await getConfig();
  if (!config) return null;

  const queryParams = { page, limit: 100 };
  const url = buildUrl(config, "referral/all", queryParams);
  const safeUrl = buildUrlRedacted(config, "referral/all", queryParams);
  logger.info({ url: safeUrl, page }, "Fetching referral/all from GetAmbassador API");

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    const bodyText = await response.text().catch(() => "");
    let parsed: unknown = null;
    try { parsed = JSON.parse(bodyText); } catch { parsed = null; }

    logger.info(
      { status: response.status, endpoint: "referral/all", page, bodySnippet: bodyText.slice(0, 500) },
      "referral/all raw response",
    );

    if (parsed) await storeRawPayload(`referral/all:page${page}`, null, parsed);
    return parsed;
  } catch (error) {
    logger.error({ ...serializeError(error), url: safeUrl }, "Failed to fetch referral/all");
    return null;
  }
}

/**
 * Fetch all commissions using the `commission/all` global endpoint.
 *
 * NOTE ON ENDPOINT CHOICE:
 * The GetAmbassador v2 API does NOT support a per-ambassador commission path
 * (e.g. `commission/ambassador/{email}`) — it returns HTTP 404 for any such URL.
 * Only `commission/all` (paginated, returns every commission across all ambassadors)
 * is available. Commissions are associated back to ambassadors in the sync engine
 * via the `ambassador_email` (or nested `ambassador.email`) field on each record.
 */
export async function getAllCommissions(
  page = 1,
): Promise<{ results: RawReferral[]; hasMore: boolean }> {
  const config = await getConfig();
  if (!config) return { results: [], hasMore: false };

  const queryParams = { page, limit: 100 };
  const url = buildUrl(config, "commission/all", queryParams);
  const safeUrl = buildUrlRedacted(config, "commission/all", queryParams);
  logger.info({ url: safeUrl, page }, "Fetching commissions from GetAmbassador API");

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `GetAmbassador API returned ${response.status}: ${response.statusText} — ${body.slice(0, 300)}`,
      );
    }

    const raw = (await response.json()) as ApiResponse<{
      commissions?: RawReferral[];
      [key: string]: unknown;
    }>;

    await storeRawPayload(`commission/all:page${page}`, null, raw);

    const results = raw?.response?.data?.commissions ?? [];
    const hasMore = results.length === 100;

    logger.info({ page, count: results.length }, "Fetched commissions page");
    return { results, hasMore };
  } catch (error) {
    logger.error(
      { ...serializeError(error), url: safeUrl, page },
      "Failed to fetch commissions",
    );
    throw error;
  }
}

export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}> {
  const config = await getConfig();
  if (!config) {
    const envStatus = getConfigStatus();
    const missing: string[] = [];
    if (!envStatus.baseUrlSet) missing.push("GETAMBASSADOR_API_BASE_URL");
    if (!envStatus.usernameSet) missing.push("GETAMBASSADOR_API_USERNAME");
    if (!envStatus.tokenSet) missing.push("GETAMBASSADOR_API_TOKEN");

    return {
      success: false,
      message: `Missing credentials: ${missing.join(", ")}. Add them as Replit Secrets or configure via Settings.`,
    };
  }

  const queryParams = { page: 1, limit: 1 };
  const url = buildUrl(config, "ambassador/all", queryParams);
  const safeUrl = buildUrlRedacted(config, "ambassador/all", queryParams);

  logger.info({ urlPattern: safeUrl }, "Testing Ambassador API connection");

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - startTime;
    const bodyText = await response.text().catch(() => "");

    logger.info(
      { urlPattern: safeUrl, httpStatus: response.status, latencyMs: latency },
      "Ambassador API connection test result",
    );

    if (response.ok) {
      let parsedData: unknown = null;
      try {
        parsedData = JSON.parse(bodyText);
      } catch {
        parsedData = null;
      }

      const ambassadors =
        parsedData &&
        typeof parsedData === "object" &&
        (parsedData as { response?: { data?: { ambassadors?: unknown[] } } })?.response?.data?.ambassadors;

      const ambassadorCount = Array.isArray(ambassadors) ? ambassadors.length : undefined;

      return {
        success: true,
        message: `Connected successfully to Ambassador API (${latency}ms)`,
        details: {
          latencyMs: latency,
          httpStatus: response.status,
          ambassadorCount,
          urlPattern: safeUrl,
          responseSnippet: bodyText.slice(0, 200),
        },
      };
    }

    logger.warn(
      {
        urlPattern: safeUrl,
        httpStatus: response.status,
        responseSnippet: bodyText.slice(0, 300),
      },
      "Ambassador API connection test failed",
    );

    return {
      success: false,
      message: `Connection failed: HTTP ${response.status} ${response.statusText}`,
      details: {
        httpStatus: response.status,
        urlPattern: safeUrl,
        responseSnippet: bodyText.slice(0, 500),
      },
    };
  } catch (error) {
    const { err, cause } = serializeError(error);
    logger.error(
      { err, cause, urlPattern: safeUrl },
      "Ambassador API connection test threw an error",
    );
    return {
      success: false,
      message: `Connection error: ${err}${cause ? ` (caused by: ${cause})` : ""}`,
      details: { urlPattern: safeUrl },
    };
  }
}

/**
 * Normalise a raw ambassador record from the GetAmbassador API.
 *
 * Key differences from the old schema assumption:
 * - `uid` is null — use email as the stable unique identifier
 * - `short_code` is absent — extract mbsyId from memorable_url instead
 * - `status` is "enrolled" (not "active") — map to "active"
 */
export function normalizeAmbassador(raw: RawAmbassador) {
  // Extract last URL segment of memorable_url (e.g. "https://blue.mbsy.co/kwikly/172397363").
  // The GA API sometimes returns a real alphanumeric share code here (e.g. "7g3bRG") and
  // sometimes returns a pure numeric internal contact ID ("172397363").
  // Pure numeric values are NOT real referral short codes — they're internal GA identifiers.
  // Store null in that case; the UI will render "—".
  const rawSegment = raw.memorable_url
    ? (raw.memorable_url as string).replace(/\/+$/, "").split("/").pop() ?? null
    : (raw.short_code ?? null);
  const shortCode =
    rawSegment && /^\d+$/.test(rawSegment) ? null : rawSegment;

  const mbsyId = extractMbsyId(raw.memorable_url as string | undefined);
  const uid = raw.uid || mbsyId || raw.email;

  const rawStatus = (raw.status || "").toLowerCase();
  const isProspect = rawStatus === "prospect";
  const status = isProspect ? "prospect" : (rawStatus === "enrolled" || rawStatus === "active" ? "active" : rawStatus || "active");
  const contactType: "advocate" | "prospect" = isProspect ? "prospect" : "advocate";

  // GetAmbassador API v2 does not include a referrer field on prospect records
  // through any available endpoint. If the API ever exposes it, extract it here.
  const referrerEmail: string | null =
    (raw as Record<string, unknown>)["referrer_email"] as string | null ??
    (raw as Record<string, unknown>)["referred_by_email"] as string | null ??
    (raw as Record<string, unknown>)["ambassador_email"] as string | null ??
    null;

  // unique_referrals is the GA-tracked count of people this ambassador referred.
  // Stored as a string in the API (e.g. "0", "89") — parse to integer.
  const uniqueReferrals = parseInt(
    String((raw as Record<string, unknown>)["unique_referrals"] ?? "0"),
    10,
  ) || 0;

  // Activity and financial fields available from the GA API.
  const countClicks = parseInt(String((raw as Record<string, unknown>)["count_clicks"] ?? "0"), 10) || 0;
  const countShares = parseInt(String((raw as Record<string, unknown>)["count_shares"] ?? "0"), 10) || 0;
  const totalMoneyEarned = String((raw as Record<string, unknown>)["total_money_earned"] ?? "0");
  const moneyPaid = String((raw as Record<string, unknown>)["money_paid"] ?? "0.00");
  const moneyPending = String((raw as Record<string, unknown>)["money_pending"] ?? "0");
  const balanceMoney = String((raw as Record<string, unknown>)["balance_money"] ?? "0.00");

  const enrolledAtRaw = (raw as Record<string, unknown>)["enrolled_at"] as string | null | undefined;
  const enrolledAt = enrolledAtRaw ? new Date(enrolledAtRaw) : null;

  // Map custom1-custom10 to business field names using the shared field-mapping config.
  // custom2=totalShiftsWorked, custom4=approvedAt, custom5=numberShiftsWorked,
  // custom6=jobTitleOrReferralType, custom8=referringShortCode (for Referred By resolution)
  const customFields = mapCustomFields(raw as Record<string, unknown>);

  // Job title: prefer custom6, fall back to the raw GA job_title field
  const rawJobTitle = ((raw as Record<string, unknown>)["job_title"] as string | null) || null;
  const jobTitle = customFields["jobTitleOrReferralType"] || rawJobTitle || null;

  // Parse approved_at from custom4 (may be a date string like "2024-03-15" or empty)
  const approvedAtRaw = customFields["approvedAt"];
  const approvedAt = approvedAtRaw ? (() => {
    const d = new Date(approvedAtRaw);
    return isNaN(d.getTime()) ? null : d;
  })() : null;

  const shiftsCount = customFields["numberShiftsWorked"]
    ? (parseInt(customFields["numberShiftsWorked"], 10) || null)
    : null;

  const totalShifts = customFields["totalShiftsWorked"]
    ? (parseInt(customFields["totalShiftsWorked"], 10) || null)
    : null;

  // custom8 = the referring ambassador's share short code (e.g. "7g3bRG").
  const referringShortCode = customFields["referringShortCode"] || null;

  // journey_status: The GA API does not expose per-contact journey stage through
  // ambassador/all. A separate sync step populates this via journey/all once
  // per-contact stage data becomes available. Default null.
  const journeyStatus: string | null = null;

  return {
    getAmbassadorUid: uid as string,
    email: raw.email,
    firstName: raw.first_name || "",
    lastName: raw.last_name || "",
    shortCode: shortCode ?? null,
    status,
    contactType,
    company: raw.company || null,
    jobTitle,
    approvedAt,
    shiftsCount,
    totalShifts,
    referringShortCode,
    journeyStatus,
    referrerEmail,
    uniqueReferrals,
    countClicks,
    countShares,
    totalMoneyEarned,
    moneyPaid,
    moneyPending,
    balanceMoney,
    enrolledAt,
  };
}

export function normalizeReferral(raw: RawReferral) {
  return {
    sourceRecordId: raw.uid || null,
    campaignUid: raw.campaign_uid || null,
    orderId: raw.order_id || null,
    transactionUid: raw.transaction_uid || null,
    email: raw.email || null,
    firstName: raw.first_name || null,
    lastName: raw.last_name || null,
    rawCustom1: raw.custom1 || null,
    rawCustom2: raw.custom2 || null,
    rawCustom3: raw.custom3 || null,
    rawCustom4: raw.custom4 || null,
    rawCustom5: raw.custom5 || null,
    rawCustom6: raw.custom6 || null,
    rawCustom7: raw.custom7 || null,
    rawCustom8: raw.custom8 || null,
    rawCustom9: raw.custom9 || null,
    rawCustom10: raw.custom10 || null,
    createdAtSource: raw.created ? new Date(raw.created) : null,
    status: raw.status || null,
  };
}
