import { useRoute, Link } from "wouter";
import { useGetAmbassador, useGetAmbassadorProspects, getGetAmbassadorProspectsQueryKey } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ArrowLeft, Copy, ExternalLink, Check, MousePointer, Share2, UserPlus, DollarSign, Wallet, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function formatMoney(val: string | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return "$" + n.toFixed(2);
}

export default function AmbassadorDetail() {
  const [, params] = useRoute("/ambassadors/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: detailData, isLoading: isLoadingDetail } = useGetAmbassador(id);
  const { data: prospectsData, isLoading: isLoadingProspects } = useGetAmbassadorProspects(id, {
    query: { queryKey: getGetAmbassadorProspectsQueryKey(id) },
  });

  if (isLoadingDetail) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading profile...</div>;
  }

  if (!detailData) {
    return <div className="p-8 text-center text-destructive">Ambassador not found</div>;
  }

  const { ambassador: amb } = detailData;
  const prospects = prospectsData?.prospects ?? [];

  const copyUrl = () => {
    navigator.clipboard.writeText(amb.iframeUrl);
    setCopied(true);
    toast({ title: "URL Copied", description: "Iframe URL is ready to use." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <Link href="/ambassadors" className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to list
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-display font-bold text-2xl shadow-lg shadow-primary/20">
              {amb.firstName[0]}{amb.lastName[0]}
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {amb.firstName} {amb.lastName}
              </h1>
              <div className="flex items-center flex-wrap gap-2 mt-2">
                <span className="text-muted-foreground">{amb.email}</span>
                <span className="text-border mx-1">•</span>
                <Badge variant={amb.status === 'active' ? 'default' : 'secondary'} className="rounded-md capitalize">
                  {amb.status}
                </Badge>
                {amb.company && (
                  <>
                    <span className="text-border mx-1">•</span>
                    <span className="text-muted-foreground font-medium">{amb.company}</span>
                  </>
                )}
                {amb.shortCode && (
                  <>
                    <span className="text-border mx-1">•</span>
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                      Code: {amb.shortCode}
                    </span>
                  </>
                )}
              </div>
              {amb.enrolledAt && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Enrolled {format(new Date(amb.enrolledAt), "MMM d, yyyy")}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Public Dashboard Link</p>
            <div className="flex items-center gap-2 mt-1">
              <Button variant="secondary" size="sm" onClick={copyUrl} className="font-mono text-xs">
                {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-500" /> : <Copy className="w-4 h-4 mr-1.5 opacity-70" />}
                {amb.iframeUrl.substring(0, 32)}...
              </Button>
              <a href={amb.iframeUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="px-2">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatTile
          label="Leads Referred"
          value={amb.leadCount}
          icon={<UserPlus className="w-4 h-4" />}
          accent
        />
        <StatTile
          label="Link Clicks"
          value={amb.countClicks ?? 0}
          icon={<MousePointer className="w-4 h-4" />}
        />
        <StatTile
          label="Shares"
          value={amb.countShares ?? 0}
          icon={<Share2 className="w-4 h-4" />}
        />
        <StatTile
          label="Total Earned"
          value={formatMoney(amb.totalMoneyEarned)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatTile
          label="Balance"
          value={formatMoney(amb.balanceMoney)}
          icon={<Wallet className="w-4 h-4" />}
        />
        <StatTile
          label="Paid Out"
          value={formatMoney(amb.moneyPaid)}
          icon={<DollarSign className="w-4 h-4" />}
        />
      </div>

      {/* Pending payout note if any */}
      {amb.moneyPending && parseFloat(amb.moneyPending) > 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          <strong>{formatMoney(amb.moneyPending)}</strong> pending payout
        </p>
      )}

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-border/50 bg-muted/10">
          <CardTitle className="text-base font-semibold">
            Referred Leads
            {amb.leadCount > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({amb.leadCount} confirmed by GetAmbassador)</span>
            )}
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingProspects ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground animate-pulse">Loading leads...</TableCell></TableRow>
              ) : prospects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <div className="space-y-2">
                      <p className="text-muted-foreground font-medium">
                        {amb.leadCount > 0
                          ? "No linked leads yet"
                          : "No leads recorded"}
                      </p>
                      {amb.leadCount > 0 ? (
                        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
                          Referrals sync automatically via Zapier. Check your Zap is active if leads are missing.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/70">
                          {amb.firstName} has not referred any leads yet.
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                prospects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.firstName} {p.lastName}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted/50 capitalize">{p.status || 'prospect'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(p.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 shadow-sm ${accent ? "bg-primary/5 border-primary/20" : "bg-card border-border/50"}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${accent ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-display font-bold ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
