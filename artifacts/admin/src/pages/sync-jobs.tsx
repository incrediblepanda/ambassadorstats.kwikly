import React, { useState } from "react";
import { useListSyncJobs, useTriggerSync } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, intervalToDuration } from "date-fns";
import { RefreshCw, Play, AlertCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED_WITH_ERRORS: 'bg-amber-50 text-amber-700 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  RUNNING: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING: 'bg-slate-50 text-slate-700 border-slate-200',
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completed",
  COMPLETED_WITH_ERRORS: "Completed with Errors",
  FAILED: "Failed",
  RUNNING: "In Progress",
  IN_PROGRESS: "In Progress",
  PENDING: "Pending",
};

function getDurationLabel(startedAt: string, completedAt?: string | null): string | null {
  if (!completedAt) return null;
  try {
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const ms = end.getTime() - start.getTime();
    if (ms < 1000) return `${ms}ms`;
    const dur = intervalToDuration({ start, end });
    if (dur.minutes) return `${dur.minutes}m ${dur.seconds || 0}s`;
    return `${dur.seconds || 0}s`;
  } catch {
    return null;
  }
}

function ErrorLog({ log }: { log: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = log.split("\n").filter(Boolean);
  const preview = lines.slice(0, 2).join("\n");
  const hasMore = lines.length > 2;

  return (
    <div className="mt-2 max-w-lg">
      <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-[11px] font-mono text-red-800 leading-relaxed whitespace-pre-wrap break-all">
        {expanded ? log : preview}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-medium"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show {lines.length - 2} more lines</>}
        </button>
      )}
    </div>
  );
}

export default function SyncJobs() {
  const [page, setPage] = useState(1);
  const limit = 15;
  const { data, isLoading } = useListSyncJobs({ page, limit });
  const { mutateAsync: triggerSync, isPending: isSyncing } = useTriggerSync();
  const [syncType, setSyncType] = useState<"FULL" | "AMBASSADORS_ONLY" | "REFERRALS_ONLY">("FULL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedError, setExpandedError] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleTriggerSync = async () => {
    try {
      await triggerSync({ data: { jobType: syncType } });
      toast({ title: "Sync Started", description: "A synchronization job has been queued." });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sync/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    } catch (err: any) {
      toast({ title: "Failed to start sync", description: err.message || "An error occurred", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Sync Jobs" 
        description="Monitor GetAmbassador data synchronization history and trigger manual syncs." 
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 shadow-sm shadow-primary/25 hover:shadow-md transition-all font-semibold">
                <Play className="w-3.5 h-3.5 mr-2" /> Trigger Sync
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="font-display">Run Manual Sync</DialogTitle>
                <DialogDescription>
                  Pull the latest ambassador and referral data from GetAmbassador.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Sync Type</label>
                  <Select value={syncType} onValueChange={(v: any) => setSyncType(v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select sync type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL">Full Sync — Ambassadors + Referrals</SelectItem>
                      <SelectItem value="AMBASSADORS_ONLY">Ambassadors Only</SelectItem>
                      <SelectItem value="REFERRALS_ONLY">Referrals Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Full sync is recommended for the most complete and up-to-date data.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleTriggerSync} disabled={isSyncing} className="font-semibold">
                  {isSyncing ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-2" />}
                  {isSyncing ? "Starting..." : "Start Sync"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold text-muted-foreground pl-5">ID</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right">Synced</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right">Failed</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right">Duration</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right pr-5">Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground/60" />
                    </TableCell>
                  </TableRow>
                ) : data?.jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <RefreshCw className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">No sync jobs yet</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Use "Trigger Sync" above to start your first sync.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.jobs.map((job) => (
                    <React.Fragment key={job.id}>
                      <TableRow 
                        className={`hover:bg-muted/20 transition-colors ${job.errorLog ? 'cursor-pointer' : ''}`}
                        onClick={() => job.errorLog ? setExpandedError(expandedError === job.id ? null : job.id) : null}
                      >
                        <TableCell className="font-mono text-[11px] text-muted-foreground pl-5">#{job.id}</TableCell>
                        <TableCell className="text-xs font-semibold text-foreground">
                          {job.jobType.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] h-5 px-1.5 font-semibold border ${STATUS_STYLES[job.status] || 'bg-muted text-muted-foreground'}`}
                          >
                            {(job.status === 'RUNNING' || job.status === 'IN_PROGRESS') && <RefreshCw className="w-2.5 h-2.5 mr-1 animate-spin" />}
                            {STATUS_LABELS[job.status] ?? job.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-foreground">{job.recordsProcessed}</TableCell>
                        <TableCell className="text-right text-xs">
                          {job.recordsFailed > 0 ? (
                            <span className="flex items-center justify-end text-red-600 font-bold gap-1">
                              <AlertCircle className="w-3 h-3" /> {job.recordsFailed}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground font-mono">
                          {getDurationLabel(job.startedAt, job.completedAt) || '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground pr-5">
                          <span className="flex items-center justify-end gap-1.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            {format(new Date(job.startedAt), "MMM d, h:mm a")}
                          </span>
                        </TableCell>
                      </TableRow>
                      {job.errorLog && expandedError === job.id && (
                        <TableRow className="bg-red-50/50 hover:bg-red-50/50">
                          <TableCell colSpan={7} className="pl-5 pr-5 py-3">
                            <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1">Error Log</p>
                            <ErrorLog log={job.errorLog} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {data && data.total > limit && (
            <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-muted/10">
              <span className="text-xs text-muted-foreground">
                {((page - 1) * limit) + 1}–{Math.min(page * limit, data.total)} of {data.total} jobs
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page * limit >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
