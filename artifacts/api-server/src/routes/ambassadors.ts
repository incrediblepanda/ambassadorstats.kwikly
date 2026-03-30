import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ambassadorsTable, referralsTable } from "@workspace/db/schema";
import { eq, ilike, or, sql, count, sum, and } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import {
  ListAmbassadorsQueryParams,
  ListAmbassadorsResponse,
  GetAmbassadorParams,
  GetAmbassadorResponse,
  GetAmbassadorReferralsParams,
  GetAmbassadorReferralsQueryParams,
  GetAmbassadorReferralsResponse,
  GetAdminStatsResponse,
  ListProspectsQueryParams,
  ListProspectsResponse,
  GetAmbassadorProspectsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/ambassadors", requireAdmin, async (req, res) => {
  try {
    const params = ListAmbassadorsQueryParams.parse(req.query);
    const { search, status, page, limit } = params;
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const conditions: ReturnType<typeof eq>[] = [
      eq(ambassadorsTable.contactType, "advocate"),
    ];

    if (search) {
      conditions.push(
        or(
          ilike(ambassadorsTable.firstName, `%${search}%`),
          ilike(ambassadorsTable.lastName, `%${search}%`),
          ilike(ambassadorsTable.email, `%${search}%`),
          ilike(ambassadorsTable.shortCode, `%${search}%`),
        ) as ReturnType<typeof eq>,
      );
    }
    if (status) {
      conditions.push(eq(ambassadorsTable.status, status));
    }

    const results = await db
      .select({
        id: ambassadorsTable.id,
        getAmbassadorUid: ambassadorsTable.getAmbassadorUid,
        email: ambassadorsTable.email,
        firstName: ambassadorsTable.firstName,
        lastName: ambassadorsTable.lastName,
        shortCode: ambassadorsTable.shortCode,
        status: ambassadorsTable.status,
        contactType: ambassadorsTable.contactType,
        company: ambassadorsTable.company,
        dashboardAccountCreated: ambassadorsTable.dashboardAccountCreated,
        iframeUrl: ambassadorsTable.iframeUrl,
        lastSyncedAt: ambassadorsTable.lastSyncedAt,
        createdAt: ambassadorsTable.createdAt,
        uniqueReferrals: ambassadorsTable.uniqueReferrals,
      })
      .from(ambassadorsTable)
      .where(and(...conditions))
      .limit(limit ?? 50)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(ambassadorsTable)
      .where(and(...conditions));

    const response = ListAmbassadorsResponse.parse({
      ambassadors: results.map((a) => ({
        id: a.id,
        getAmbassadorUid: a.getAmbassadorUid,
        email: a.email,
        firstName: a.firstName,
        lastName: a.lastName,
        shortCode: a.shortCode,
        status: a.status,
        company: a.company,
        dashboardAccountCreated: a.dashboardAccountCreated,
        iframeUrl: a.iframeUrl ?? null,
        lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
        leadCount: Number(a.uniqueReferrals) || 0,
      })),
      total: totalResult.count,
      page: page ?? 1,
      limit: limit ?? 50,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : String(error) }, "List ambassadors error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/prospects", requireAdmin, async (req, res) => {
  try {
    const params = ListProspectsQueryParams.parse(req.query);
    const { search, page, limit } = params;
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const conditions: ReturnType<typeof eq>[] = [
      eq(ambassadorsTable.contactType, "prospect"),
    ];

    if (search) {
      conditions.push(
        or(
          ilike(ambassadorsTable.firstName, `%${search}%`),
          ilike(ambassadorsTable.lastName, `%${search}%`),
          ilike(ambassadorsTable.email, `%${search}%`),
        ) as ReturnType<typeof eq>,
      );
    }

    const referrerAlias = db
      .select({
        id: ambassadorsTable.id,
        firstName: ambassadorsTable.firstName,
        lastName: ambassadorsTable.lastName,
        email: ambassadorsTable.email,
      })
      .from(ambassadorsTable)
      .as("referrer");

    const results = await db
      .select({
        id: ambassadorsTable.id,
        email: ambassadorsTable.email,
        firstName: ambassadorsTable.firstName,
        lastName: ambassadorsTable.lastName,
        shortCode: ambassadorsTable.shortCode,
        status: ambassadorsTable.status,
        company: ambassadorsTable.company,
        jobTitle: ambassadorsTable.jobTitle,
        enrolledAt: ambassadorsTable.enrolledAt,
        approvedAt: ambassadorsTable.approvedAt,
        shiftsCount: ambassadorsTable.shiftsCount,
        totalShifts: ambassadorsTable.totalShifts,
        journeyStatus: ambassadorsTable.journeyStatus,
        referrerAmbassadorId: ambassadorsTable.referrerAmbassadorId,
        referrerName: ambassadorsTable.referrerName,
        referrerFirstName: referrerAlias.firstName,
        referrerLastName: referrerAlias.lastName,
        referrerEmail: referrerAlias.email,
        lastSyncedAt: ambassadorsTable.lastSyncedAt,
        createdAt: ambassadorsTable.createdAt,
      })
      .from(ambassadorsTable)
      .leftJoin(referrerAlias, eq(ambassadorsTable.referrerAmbassadorId, referrerAlias.id))
      .where(and(...conditions))
      .limit(limit ?? 50)
      .offset(offset)
      .orderBy(ambassadorsTable.createdAt);

    const [totalResult] = await db
      .select({ count: count() })
      .from(ambassadorsTable)
      .where(and(...conditions));

    const response = ListProspectsResponse.parse({
      prospects: results.map((p) => ({
        id: p.id,
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        shortCode: p.shortCode,
        status: p.status,
        company: p.company ?? null,
        jobTitle: p.jobTitle ?? null,
        enrolledAt: p.enrolledAt?.toISOString() ?? null,
        approvedAt: p.approvedAt?.toISOString() ?? null,
        shiftsCount: p.shiftsCount ?? null,
        totalShifts: p.totalShifts ?? null,
        journeyStatus: p.journeyStatus ?? null,
        referrerAmbassadorId: p.referrerAmbassadorId ?? null,
        referrerName: p.referrerFirstName && p.referrerLastName
          ? `${p.referrerFirstName} ${p.referrerLastName}`
          : (p.referrerName ?? null),
        referrerEmail: p.referrerEmail ?? null,
        lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      total: totalResult.count,
      page: page ?? 1,
      limit: limit ?? 50,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : String(error) }, "List prospects error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ambassadors/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = GetAmbassadorParams.parse(req.params);

    const [ambassador] = await db
      .select()
      .from(ambassadorsTable)
      .where(eq(ambassadorsTable.id, id))
      .limit(1);

    if (!ambassador) {
      res.status(404).json({ error: "Ambassador not found" });
      return;
    }

    const referralStats = await db
      .select({
        totalReferrals: count(),
        professionalReferrals: sum(
          sql`CASE WHEN ${referralsTable.sourceType} = 'PROFESSIONAL' THEN 1 ELSE 0 END`,
        ),
        companyReferrals: sum(
          sql`CASE WHEN ${referralsTable.sourceType} = 'COMPANY' THEN 1 ELSE 0 END`,
        ),
        approvedReferrals: sum(
          sql`CASE WHEN ${referralsTable.approvedAt} IS NOT NULL THEN 1 ELSE 0 END`,
        ),
        totalProfessionalShiftsWorked: sum(
          sql`CASE WHEN ${referralsTable.sourceType} = 'PROFESSIONAL' THEN COALESCE(${referralsTable.numberShiftsWorked}, 0) ELSE 0 END`,
        ),
        totalCompanyShiftsFilled: sum(
          sql`CASE WHEN ${referralsTable.sourceType} = 'COMPANY' THEN COALESCE(${referralsTable.totalShiftsWorked}, 0) ELSE 0 END`,
        ),
      })
      .from(referralsTable)
      .where(eq(referralsTable.ambassadorId, id));

    const stats = referralStats[0] || {};


    const response = GetAmbassadorResponse.parse({
      ambassador: {
        id: ambassador.id,
        getAmbassadorUid: ambassador.getAmbassadorUid,
        email: ambassador.email,
        firstName: ambassador.firstName,
        lastName: ambassador.lastName,
        shortCode: ambassador.shortCode,
        status: ambassador.status,
        company: ambassador.company,
        dashboardSlug: ambassador.dashboardSlug,
        dashboardToken: ambassador.dashboardToken,
        iframeUrl: ambassador.iframeUrl ?? "",
        dashboardAccountCreated: ambassador.dashboardAccountCreated,
        lastSyncedAt: ambassador.lastSyncedAt?.toISOString() ?? null,
        createdAt: ambassador.createdAt.toISOString(),
        updatedAt: ambassador.updatedAt.toISOString(),
        totalReferrals: Number(stats.totalReferrals) || 0,
        professionalReferrals: Number(stats.professionalReferrals) || 0,
        companyReferrals: Number(stats.companyReferrals) || 0,
        approvedReferrals: Number(stats.approvedReferrals) || 0,
        totalProfessionalShiftsWorked: Number(stats.totalProfessionalShiftsWorked) || 0,
        totalCompanyShiftsFilled: Number(stats.totalCompanyShiftsFilled) || 0,
        leadCount: ambassador.uniqueReferrals ?? 0,
        countClicks: ambassador.countClicks ?? 0,
        countShares: ambassador.countShares ?? 0,
        totalMoneyEarned: ambassador.totalMoneyEarned ?? null,
        moneyPaid: ambassador.moneyPaid ?? null,
        moneyPending: ambassador.moneyPending ?? null,
        balanceMoney: ambassador.balanceMoney ?? null,
        enrolledAt: ambassador.enrolledAt?.toISOString() ?? null,
      },
    });

    res.json(response);
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : String(error) }, "Get ambassador error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ambassadors/:id/prospects", requireAdmin, async (req, res) => {
  try {
    const { id } = GetAmbassadorProspectsParams.parse(req.params);

    const referrerAlias = db
      .select({
        id: ambassadorsTable.id,
        firstName: ambassadorsTable.firstName,
        lastName: ambassadorsTable.lastName,
        email: ambassadorsTable.email,
      })
      .from(ambassadorsTable)
      .as("referrer");

    const results = await db
      .select({
        id: ambassadorsTable.id,
        email: ambassadorsTable.email,
        firstName: ambassadorsTable.firstName,
        lastName: ambassadorsTable.lastName,
        shortCode: ambassadorsTable.shortCode,
        status: ambassadorsTable.status,
        company: ambassadorsTable.company,
        jobTitle: ambassadorsTable.jobTitle,
        enrolledAt: ambassadorsTable.enrolledAt,
        approvedAt: ambassadorsTable.approvedAt,
        shiftsCount: ambassadorsTable.shiftsCount,
        totalShifts: ambassadorsTable.totalShifts,
        journeyStatus: ambassadorsTable.journeyStatus,
        referrerAmbassadorId: ambassadorsTable.referrerAmbassadorId,
        referrerName: ambassadorsTable.referrerName,
        referrerFirstName: referrerAlias.firstName,
        referrerLastName: referrerAlias.lastName,
        referrerEmail: referrerAlias.email,
        lastSyncedAt: ambassadorsTable.lastSyncedAt,
        createdAt: ambassadorsTable.createdAt,
      })
      .from(ambassadorsTable)
      .leftJoin(referrerAlias, eq(ambassadorsTable.referrerAmbassadorId, referrerAlias.id))
      .where(and(
        eq(ambassadorsTable.contactType, "prospect"),
        eq(ambassadorsTable.referrerAmbassadorId, id),
      ));
    const totalResult = await db
      .select({ count: count() })
      .from(ambassadorsTable)
      .where(and(
        eq(ambassadorsTable.contactType, "prospect"),
        eq(ambassadorsTable.referrerAmbassadorId, id),
      ));

    const response = ListProspectsResponse.parse({
      prospects: results.map((p) => ({
        id: p.id,
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        shortCode: p.shortCode,
        status: p.status,
        company: p.company ?? null,
        jobTitle: p.jobTitle ?? null,
        enrolledAt: p.enrolledAt?.toISOString() ?? null,
        approvedAt: p.approvedAt?.toISOString() ?? null,
        shiftsCount: p.shiftsCount ?? null,
        totalShifts: p.totalShifts ?? null,
        journeyStatus: p.journeyStatus ?? null,
        referrerAmbassadorId: p.referrerAmbassadorId ?? null,
        referrerName: p.referrerFirstName && p.referrerLastName
          ? `${p.referrerFirstName} ${p.referrerLastName}`
          : (p.referrerName ?? null),
        referrerEmail: p.referrerEmail ?? null,
        lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      total: totalResult[0]?.count ?? 0,
      page: 1,
      limit: results.length,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : String(error) }, "Get ambassador prospects error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ambassadors/:id/referrals", requireAdmin, async (req, res) => {
  try {
    const { id } = GetAmbassadorReferralsParams.parse(req.params);
    const { sourceType } = GetAmbassadorReferralsQueryParams.parse(req.query);

    let query = db
      .select()
      .from(referralsTable)
      .where(eq(referralsTable.ambassadorId, id))
      .$dynamic();

    if (sourceType) {
      query = query.where(eq(referralsTable.sourceType, sourceType));
    }

    const results = await query;
    const [totalResult] = await db
      .select({ count: count() })
      .from(referralsTable)
      .where(eq(referralsTable.ambassadorId, id));

    const response = GetAmbassadorReferralsResponse.parse({
      referrals: results.map((r) => ({
        id: r.id,
        ambassadorId: r.ambassadorId,
        sourceType: r.sourceType,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        companyName: r.companyName,
        jobTitle: r.jobTitle,
        associatedOfficeId: r.associatedOfficeId,
        status: r.status,
        approvedAt: r.approvedAt?.toISOString() ?? null,
        createdAtSource: r.createdAtSource?.toISOString() ?? null,
        numberShiftsWorked: r.numberShiftsWorked,
        totalShiftsWorked: r.totalShiftsWorked,
        createdAt: r.createdAt.toISOString(),
      })),
      total: totalResult.count,
    });

    res.json(response);
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : String(error) }, "Get referrals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [totalAmb] = await db.select({ count: count() }).from(ambassadorsTable);
    const [totalAdvocates] = await db
      .select({ count: count() })
      .from(ambassadorsTable)
      .where(eq(ambassadorsTable.contactType, "advocate"));
    const [totalLeads] = await db
      .select({ count: count() })
      .from(ambassadorsTable)
      .where(eq(ambassadorsTable.contactType, "prospect"));
    const [activeAmb] = await db
      .select({ count: count() })
      .from(ambassadorsTable)
      .where(and(
        eq(ambassadorsTable.contactType, "advocate"),
        eq(ambassadorsTable.status, "active"),
      ));
    const [totalRef] = await db.select({ count: count() }).from(referralsTable);

    const { syncJobsTable } = await import("@workspace/db/schema");
    const recentJobs = await db
      .select()
      .from(syncJobsTable)
      .orderBy(sql`${syncJobsTable.createdAt} DESC`)
      .limit(5);

    const { appSettingsTable } = await import("@workspace/db/schema");
    const [lastSync] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "lastSyncAt"))
      .limit(1);

    const lastJob = recentJobs[0];
    let syncHealthy: boolean;
    if (!lastJob) {
      syncHealthy = false;
    } else if (lastJob.status === "FAILED" || lastJob.status === "COMPLETED_WITH_ERRORS") {
      syncHealthy = false;
    } else if (
      lastJob.status === "COMPLETED" &&
      (lastJob.recordsProcessed ?? 0) === 0 &&
      lastJob.errorLog
    ) {
      syncHealthy = false;
    } else {
      syncHealthy = true;
    }

    const response = GetAdminStatsResponse.parse({
      totalAmbassadors: totalAmb.count,
      activeAmbassadors: activeAmb.count,
      totalAdvocates: totalAdvocates.count,
      totalLeads: totalLeads.count,
      totalReferrals: totalRef.count,
      lastSyncAt: lastSync?.value ?? null,
      syncHealthy,
      recentJobs: recentJobs.map((j) => ({
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
    });

    res.json(response);
  } catch (error) {
    req.log.error({ err: error instanceof Error ? error.message : String(error) }, "Admin stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
