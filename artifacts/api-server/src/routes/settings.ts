import { randomUUID } from "crypto";
import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/auth";
import { testConnection, getConfigStatus } from "../services/getambassador";
import { getSetting, setSetting, normalizeBaseUrl } from "../lib/settings";
import { db } from "@workspace/db";
import { ambassadorsTable, syncJobsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
  TestConnectionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/settings", requireAdmin, async (req, res) => {
  try {
    const envStatus = getConfigStatus();

    const dbBaseUrl = await getSetting("getAmbassadorApiBaseUrl");
    const dbUsername = await getSetting("getAmbassadorUsername");
    const dbTokenSet = await getSetting("getAmbassadorApiTokenSet");

    const response = GetSettingsResponse.parse({
      getAmbassadorApiBaseUrl:
        process.env.GETAMBASSADOR_API_BASE_URL || dbBaseUrl || "",
      getAmbassadorUsername:
        process.env.GETAMBASSADOR_API_USERNAME || dbUsername || "",
      getAmbassadorApiTokenSet:
        envStatus.tokenSet || dbTokenSet === "true",
      appBaseUrl: process.env.APP_BASE_URL || (await getSetting("appBaseUrl")) || "",
      lastSyncAt: await getSetting("lastSyncAt"),
      syncEnabled: (await getSetting("syncEnabled")) === "true",
      connectionStatus: await getSetting("connectionStatus"),
      envBaseUrlSet: envStatus.baseUrlSet,
      envUsernameSet: envStatus.usernameSet,
      envTokenSet: envStatus.tokenSet,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ error }, "Get settings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", requireAdmin, async (req, res) => {
  try {
    const parsed = UpdateSettingsBody.parse(req.body);

    if (parsed.getAmbassadorApiBaseUrl !== undefined && parsed.getAmbassadorApiBaseUrl !== "") {
      // normalizeBaseUrl throws on invalid/relative URLs — let the outer catch
      // handle that and return a 500 (Zod already validated the shape above).
      await setSetting(
        "getAmbassadorApiBaseUrl",
        normalizeBaseUrl(parsed.getAmbassadorApiBaseUrl),
      );
    }
    if (parsed.getAmbassadorUsername !== undefined) {
      await setSetting("getAmbassadorUsername", parsed.getAmbassadorUsername);
    }
    if (parsed.getAmbassadorApiToken) {
      await setSetting("getAmbassadorApiToken", parsed.getAmbassadorApiToken);
      await setSetting("getAmbassadorApiTokenSet", "true");
    }
    if (parsed.appBaseUrl !== undefined) {
      await setSetting("appBaseUrl", parsed.appBaseUrl);
    }
    if (parsed.syncEnabled !== undefined) {
      await setSetting("syncEnabled", String(parsed.syncEnabled));
    }

    const envStatus = getConfigStatus();
    const dbTokenSet = await getSetting("getAmbassadorApiTokenSet");

    const response = UpdateSettingsResponse.parse({
      getAmbassadorApiBaseUrl:
        process.env.GETAMBASSADOR_API_BASE_URL ||
        (await getSetting("getAmbassadorApiBaseUrl")) || "",
      getAmbassadorUsername:
        process.env.GETAMBASSADOR_API_USERNAME ||
        (await getSetting("getAmbassadorUsername")) || "",
      getAmbassadorApiTokenSet:
        envStatus.tokenSet || dbTokenSet === "true",
      appBaseUrl:
        process.env.APP_BASE_URL ||
        (await getSetting("appBaseUrl")) || "",
      lastSyncAt: await getSetting("lastSyncAt"),
      syncEnabled: (await getSetting("syncEnabled")) === "true",
      connectionStatus: await getSetting("connectionStatus"),
      envBaseUrlSet: envStatus.baseUrlSet,
      envUsernameSet: envStatus.usernameSet,
      envTokenSet: envStatus.tokenSet,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ error }, "Update settings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/settings/test-connection", requireAdmin, async (req, res) => {
  try {
    const result = await testConnection();

    await setSetting(
      "connectionStatus",
      result.success ? "connected" : "failed",
    );

    if (result.success) {
      await setSetting("lastConnectionTestAt", new Date().toISOString());
    }

    const response = TestConnectionResponse.parse({
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
      details: result.details,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ error }, "Test connection error");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getOrCreateWebhookSecret(): Promise<string> {
  let secret = await getSetting("zapierWebhookSecret");
  if (!secret) {
    secret = randomUUID();
    await setSetting("zapierWebhookSecret", secret);
  }
  return secret;
}

async function buildWebhookUrl(): Promise<string> {
  if (process.env.APP_BASE_URL) {
    return `${process.env.APP_BASE_URL.replace(/\/$/, "")}/api/webhooks/zapier/contact`;
  }
  const persistedBase = await getSetting("appBaseUrl");
  if (persistedBase) {
    return `${persistedBase.replace(/\/$/, "")}/api/webhooks/zapier/contact`;
  }
  if (process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(",")[0];
    return `https://${domain}/api/webhooks/zapier/contact`;
  }
  return `http://localhost:${process.env.PORT || 8080}/api/webhooks/zapier/contact`;
}

router.get("/settings/webhook-info", requireAdmin, async (req, res) => {
  try {
    const secret = await getOrCreateWebhookSecret();
    const webhookUrl = await buildWebhookUrl();

    res.json({ webhookUrl, secret });
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : String(error) }, "Get webhook info error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/settings/rotate-webhook-secret", requireAdmin, async (req, res) => {
  try {
    const secret = randomUUID();
    await setSetting("zapierWebhookSecret", secret);
    const webhookUrl = await buildWebhookUrl();

    res.json({ webhookUrl, secret });
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : String(error) }, "Rotate webhook secret error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/settings/manual-attribution", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const email = typeof body["email"] === "string" ? body["email"].trim().toLowerCase() : null;
  const shortCode = typeof body["shortCode"] === "string" ? body["shortCode"].trim() : null;

  if (!email || !shortCode) {
    res.status(400).json({ error: "email and shortCode are required" });
    return;
  }

  const [job] = await db
    .insert(syncJobsTable)
    .values({ jobType: "HUBSPOT", status: "RUNNING", recordsProcessed: 0, recordsFailed: 0, startedAt: new Date() })
    .returning();

  try {
    const [prospect] = await db
      .select()
      .from(ambassadorsTable)
      .where(and(sql`LOWER(${ambassadorsTable.email}) = ${email}`, eq(ambassadorsTable.contactType, "prospect")))
      .limit(1);

    if (!prospect) {
      await db.update(syncJobsTable).set({ status: "COMPLETED", recordsProcessed: 0, recordsFailed: 1, errorLog: `No prospect with email: ${email}`, completedAt: new Date() }).where(eq(syncJobsTable.id, job.id));
      res.json({ matched: false, reason: "prospect_not_found", prospectId: null, referrerId: null });
      return;
    }

    const [advocate] = await db
      .select()
      .from(ambassadorsTable)
      .where(and(sql`LOWER(${ambassadorsTable.shortCode}) = LOWER(${shortCode})`, eq(ambassadorsTable.contactType, "advocate")))
      .limit(1);

    if (!advocate) {
      await db.update(syncJobsTable).set({ status: "COMPLETED", recordsProcessed: 0, recordsFailed: 1, errorLog: `No advocate with short code: ${shortCode}`, completedAt: new Date() }).where(eq(syncJobsTable.id, job.id));
      res.json({ matched: false, reason: "advocate_not_found", prospectId: prospect.id, referrerId: null });
      return;
    }

    const referrerName = `${advocate.firstName} ${advocate.lastName}`.trim();
    await db.update(ambassadorsTable).set({ referrerAmbassadorId: advocate.id, referrerName, referringShortCode: shortCode, updatedAt: new Date() }).where(eq(ambassadorsTable.id, prospect.id));
    await db.update(syncJobsTable).set({ status: "COMPLETED", recordsProcessed: 1, recordsFailed: 0, completedAt: new Date() }).where(eq(syncJobsTable.id, job.id));

    res.json({ matched: true, prospectId: prospect.id, referrerId: advocate.id, referrerName });
  } catch (error) {
    await db.update(syncJobsTable).set({ status: "FAILED", recordsFailed: 1, errorLog: error instanceof Error ? error.message : String(error), completedAt: new Date() }).where(eq(syncJobsTable.id, job.id));
    req.log.error({ err: error instanceof Error ? error.message : String(error) }, "Manual attribution error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
