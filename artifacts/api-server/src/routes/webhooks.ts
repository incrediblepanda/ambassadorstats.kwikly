import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ambassadorsTable, syncJobsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSetting } from "../lib/settings";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface ZapierBody {
  email: string;
  referral_shortcode: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  shiftsWorked?: string | number;
  approvedAt?: string;
}

function parseBody(raw: unknown): { ok: true; data: ZapierBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body must be a JSON object" };
  const b = raw as Record<string, unknown>;
  if (typeof b["email"] !== "string" || !b["email"].trim()) return { ok: false, error: "email is required" };
  if (typeof b["referral_shortcode"] !== "string" || !b["referral_shortcode"].trim()) {
    return { ok: false, error: "referral_shortcode is required" };
  }
  return {
    ok: true,
    data: {
      email: b["email"] as string,
      referral_shortcode: b["referral_shortcode"] as string,
      firstName: typeof b["firstName"] === "string" ? b["firstName"] : undefined,
      lastName: typeof b["lastName"] === "string" ? b["lastName"] : undefined,
      jobTitle: typeof b["jobTitle"] === "string" ? b["jobTitle"] : undefined,
      shiftsWorked: (typeof b["shiftsWorked"] === "string" || typeof b["shiftsWorked"] === "number") ? b["shiftsWorked"] : undefined,
      approvedAt: typeof b["approvedAt"] === "string" ? b["approvedAt"] : undefined,
    },
  };
}

router.post("/webhooks/zapier/contact", async (req, res) => {
  const providedSecret = req.headers["x-kwikly-secret"];
  let storedSecret = await getSetting("zapierWebhookSecret");
  if (!storedSecret) {
    const { randomUUID } = await import("crypto");
    storedSecret = randomUUID();
    await setSetting("zapierWebhookSecret", storedSecret);
  }

  if (!providedSecret || providedSecret !== storedSecret) {
    logger.warn({ hasSecret: !!providedSecret }, "Zapier webhook: unauthorized request");
    res.status(401).json({ error: "Invalid or missing secret" });
    return;
  }

  const parsed = parseBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const body = parsed.data;

  const [job] = await db
    .insert(syncJobsTable)
    .values({
      jobType: "HUBSPOT",
      status: "RUNNING",
      recordsProcessed: 0,
      recordsFailed: 0,
      startedAt: new Date(),
    })
    .returning();

  try {
    const emailLower = body.email.toLowerCase().trim();

    const [prospect] = await db
      .select()
      .from(ambassadorsTable)
      .where(
        and(
          sql`LOWER(${ambassadorsTable.email}) = ${emailLower}`,
          eq(ambassadorsTable.contactType, "prospect"),
        ),
      )
      .limit(1);

    if (!prospect) {
      logger.info({ email: emailLower }, "Zapier webhook: no prospect found");
      await db
        .update(syncJobsTable)
        .set({
          status: "COMPLETED",
          recordsProcessed: 0,
          recordsFailed: 1,
          errorLog: `No prospect found with email: ${emailLower}`,
          completedAt: new Date(),
        })
        .where(eq(syncJobsTable.id, job.id));

      res.json({ matched: false, reason: "prospect_not_found", prospectId: null, referrerId: null });
      return;
    }

    const [advocate] = await db
      .select()
      .from(ambassadorsTable)
      .where(
        and(
          sql`LOWER(${ambassadorsTable.shortCode}) = LOWER(${body.referral_shortcode})`,
          eq(ambassadorsTable.contactType, "advocate"),
        ),
      )
      .limit(1);

    if (!advocate) {
      await db
        .update(syncJobsTable)
        .set({
          status: "COMPLETED",
          recordsProcessed: 0,
          recordsFailed: 1,
          errorLog: `No advocate found with short code: ${body.referral_shortcode}`,
          completedAt: new Date(),
        })
        .where(eq(syncJobsTable.id, job.id));

      res.json({ matched: false, reason: "advocate_not_found", prospectId: prospect.id, referrerId: null });
      return;
    }

    const referrerName = `${advocate.firstName} ${advocate.lastName}`.trim();

    const updates: Partial<typeof ambassadorsTable.$inferInsert> & { updatedAt: Date } = {
      referrerAmbassadorId: advocate.id,
      referrerName,
      referringShortCode: body.referral_shortcode,
      updatedAt: new Date(),
    };

    if (body.jobTitle) updates.jobTitle = body.jobTitle;

    if (body.shiftsWorked !== undefined && body.shiftsWorked !== "") {
      const n = Number(body.shiftsWorked);
      if (!isNaN(n)) updates.shiftsCount = n;
    }

    if (body.approvedAt) {
      const d = new Date(body.approvedAt);
      if (!isNaN(d.getTime())) updates.approvedAt = d;
    }

    await db
      .update(ambassadorsTable)
      .set(updates)
      .where(eq(ambassadorsTable.id, prospect.id));

    logger.info(
      { prospectId: prospect.id, advocateId: advocate.id, referrerName },
      "Zapier webhook: prospect linked to advocate",
    );

    await db
      .update(syncJobsTable)
      .set({
        status: "COMPLETED",
        recordsProcessed: 1,
        recordsFailed: 0,
        completedAt: new Date(),
      })
      .where(eq(syncJobsTable.id, job.id));

    res.json({
      matched: true,
      prospectId: prospect.id,
      referrerId: advocate.id,
      referrerName,
    });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "Zapier webhook error");

    await db
      .update(syncJobsTable)
      .set({
        status: "FAILED",
        recordsFailed: 1,
        errorLog: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(syncJobsTable.id, job.id));

    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
