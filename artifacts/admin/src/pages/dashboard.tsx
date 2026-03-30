import { useGetAdminStats } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Users, UserPlus, Briefcase, Activity, ExternalLink, Settings, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardSkeleton() {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-xl p-5 h-64">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 h-64">
          <Skeleton className="h-4 w-28 mb-6" />
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useGetAdminStats();

  if (isLoading) {
    return (
      <div className="space-y-7">
        <PageHeader title="Dashboard" description="Monitor your ambassador program performance." />
        <DashboardSkeleton />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3 opacity-80" />
        <p className="text-base font-semibold text-foreground">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground mt-1">Please refresh to try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader 
        title="Dashboard" 
        description="Monitor your Kwikly ambassador program performance and sync status." 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Advocates" 
          value={(stats.totalAdvocates ?? stats.totalAmbassadors).toLocaleString()} 
          icon={Users}
          description="Enrolled referral partners"
          delay={0.05}
        />
        <StatCard 
          title="Leads" 
          value={(stats.totalLeads ?? 0).toLocaleString()} 
          icon={UserPlus}
          description="Prospects referred to Kwikly"
          delay={0.1}
        />
        <StatCard 
          title="Total Referrals" 
          value={stats.totalReferrals.toLocaleString()} 
          icon={Briefcase}
          description="Completed referral commissions"
          delay={0.15}
        />
        <StatCard 
          title="Sync Health" 
          value={stats.syncHealthy ? "Healthy" : "Failing"} 
          icon={Activity}
          description={stats.syncHealthy ? "All systems operational" : "Recent sync failures detected"}
          delay={0.2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Sync Jobs */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-4 px-5 border-b border-border">
            <CardTitle className="text-sm font-semibold text-foreground">Recent Sync Jobs</CardTitle>
            <Link href="/sync-jobs" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
              View all <ExternalLink className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentJobs.length === 0 ? (
              <div className="py-12 text-center">
                <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No sync jobs run yet.</p>
                <p className="text-xs text-muted-foreground mt-0.5">Trigger your first sync from the Sync Jobs page.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] h-5 px-1.5 shrink-0 font-semibold border ${
                          job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          job.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                          (job.status === 'RUNNING' || job.status === 'IN_PROGRESS') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {{
                          COMPLETED: "Completed",
                          FAILED: "Failed",
                          RUNNING: "In Progress",
                          IN_PROGRESS: "In Progress",
                          COMPLETED_WITH_ERRORS: "With Errors",
                        }[job.status] ?? job.status}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{job.jobType.replace(/_/g, ' ')}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(job.startedAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs font-semibold text-foreground">{job.recordsProcessed} synced</p>
                      {job.recordsFailed > 0 && (
                        <p className="text-[10px] text-destructive font-medium">{job.recordsFailed} failed</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="border-border shadow-sm">
          <CardHeader className="py-4 px-5 border-b border-border">
            <CardTitle className="text-sm font-semibold text-foreground">Integration Health</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Last Data Sync</p>
              <p className="text-sm font-semibold text-foreground">
                {stats.lastSyncAt ? format(new Date(stats.lastSyncAt), "MMMM d, yyyy 'at' h:mm a") : "Never synced"}
              </p>
            </div>
            
            {!stats.lastSyncAt ? (
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-slate-50 border-slate-200">
                <MinusCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-600">No syncs have run yet</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed text-slate-500">
                    Trigger your first sync from the Sync Jobs page to pull ambassador data.
                  </p>
                </div>
              </div>
            ) : stats.syncHealthy ? (
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-emerald-50 border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-800">Syncing normally</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed text-emerald-700">
                    Ambassador data is up to date and the integration is healthy.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-red-50 border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-800">Sync errors detected</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed text-red-700">
                    Recent sync jobs have failed or completed with errors. Check the Sync Jobs page for details.
                  </p>
                </div>
              </div>
            )}

            <Link href="/settings">
              <Button variant="outline" size="sm" className="w-full h-8 text-xs font-semibold">
                <Settings className="w-3.5 h-3.5 mr-2" />
                Manage Integration Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
