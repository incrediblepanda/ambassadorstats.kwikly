import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { syncJobsTable } from "@workspace/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { runSync, resolveAllPendingReferrers } from "../services/sync-engine";
import {
  TriggerSyncBody,
  TriggerSyncResponse,
  ListSyncJobsQueryParams,
  ListSyncJobsResponse,
  GetSyncJobParams,
  GetSyncJobResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/sync/trigger", requireAdmin, async (req, res) => {
  try {
    const parsed = TriggerSyncBody.parse(req.body || {});
    const jobType = parsed.jobType ?? "FULL";

    const jobId = await runSync(jobType);

    const [job] = await db
      .select()
      .from(syncJobsTable)
      .where(eq(syncJobsTable.id, jobId))
      .limit(1);

    const response = TriggerSyncResponse.parse({
      job: {
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        recordsProcessed: job.recordsProcessed,
        recordsFailed: job.recordsFailed,
        errorLog: job.errorLog,
        startedAt: job.startedAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
      },
    });

    res.json(response);
  } catch (error) {
    req.log.error({ error }, "Trigger sync error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sync/resolve-referrers", requireAdmin, async (req, res) => {
  try {
    const result = await resolveAllPendingReferrers();
    res.json(result);
  } catch (error) {
    req.log.error({ error }, "Resolve referrers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/sync/jobs", requireAdmin, async (req, res) => {
  try {
    const params = ListSyncJobsQueryParams.parse(req.query);
    const { page, limit } = params;
    const p = page ?? 1;
    const l = limit ?? 20;
    const offset = (p - 1) * l;

    const jobs = await db
      .select()
      .from(syncJobsTable)
      .orderBy(sql`${syncJobsTable.createdAt} DESC`)
      .limit(l)
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(syncJobsTable);

    const response = ListSyncJobsResponse.parse({
      jobs: jobs.map((j) => ({
        id: j.id,
        jobType: j.jobType,
        status: j.status,
        recordsProcessed: j.recordsProcessed,
        recordsFailed: j.recordsFailed,
        errorLog: j.errorLog,
        startedAt: j.startedAt.toISOString(),
        completedAt: j.completedAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
      })),
      total: totalResult.count,
      page: p,
      limit: l,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ error }, "List sync jobs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/sync/jobs/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = GetSyncJobParams.parse(req.params);

    const [job] = await db
      .select()
      .from(syncJobsTable)
      .where(eq(syncJobsTable.id, id))
      .limit(1);

    if (!job) {
      res.status(404).json({ error: "Sync job not found" });
      return;
    }

    const response = GetSyncJobResponse.parse({
      job: {
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        recordsProcessed: job.recordsProcessed,
        recordsFailed: job.recordsFailed,
        errorLog: job.errorLog,
        startedAt: job.startedAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
      },
    });

    res.json(response);
  } catch (error) {
    req.log.error({ error }, "Get sync job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
