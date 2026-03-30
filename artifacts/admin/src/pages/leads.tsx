import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListProspects,
  useGetAmbassadorProspects,
  getListProspectsQueryKey,
  getGetAmbassadorProspectsQueryKey,
} from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, X, UserPlus } from "lucide-react";
import { format } from "date-fns";

function useQuery() {
  const [location] = useLocation();
  const search = location.includes("?") ? location.split("?")[1] : "";
  return new URLSearchParams(search);
}

function Dash() {
  return <span className="text-muted-foreground/40">—</span>;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return null;
  }
}

function JourneyBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Dash />;
  const lower = status.toLowerCase();
  let variant: "default" | "secondary" | "outline" = "outline";
  let color = "text-muted-foreground";
  if (lower === "approved" || lower === "active") {
    variant = "default";
    color = "bg-green-100 text-green-800 border-green-200";
  } else if (lower === "onboarding") {
    variant = "secondary";
    color = "bg-blue-100 text-blue-800 border-blue-200";
  } else if (lower === "disengaged" || lower === "declined service") {
    color = "bg-red-100 text-red-800 border-red-200";
  }
  return (
    <Badge variant={variant} className={`text-xs font-normal ${color}`}>
      {status}
    </Badge>
  );
}

export default function Leads() {
  const query = useQuery();
  const referrerIdParam = query.get("referrer");
  const referrerId = referrerIdParam ? parseInt(referrerIdParam, 10) : null;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const limit = 500;

  const listParams = referrerId ? undefined : { page, limit, search: debouncedSearch || undefined };
  const allProspects = useListProspects(
    listParams,
    { query: { queryKey: getListProspectsQueryKey(listParams), enabled: !referrerId } },
  );

  const referrerProspects = useGetAmbassadorProspects(
    referrerId ?? 0,
    { query: { queryKey: getGetAmbassadorProspectsQueryKey(referrerId ?? 0), enabled: !!referrerId } },
  );

  const isLoading = referrerId ? referrerProspects.isLoading : allProspects.isLoading;

  const rawProspects = referrerId
    ? (referrerProspects.data?.prospects ?? [])
    : (allProspects.data?.prospects ?? []);

  const filteredProspects = referrerId && search
    ? rawProspects.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
        );
      })
    : rawProspects;

  const total = referrerId
    ? (referrerProspects.data?.total ?? 0)
    : (allProspects.data?.total ?? 0);

  const referrerName = referrerProspects.data?.prospects?.[0]?.referrerName ?? null;

  const [, setLocation] = useLocation();

  function clearReferrer() {
    setSearch("");
    setPage(1);
    setLocation("/leads");
  }

  const COLS = 8;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={
          referrerId && referrerName
            ? `Showing prospects referred by ${referrerName}.`
            : "All prospects who have been referred to Kwikly."
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 bg-muted/20">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            {referrerId && (
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={clearReferrer}>
                <X className="w-3.5 h-3.5" />
                Clear referrer filter
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="whitespace-nowrap">First Name</TableHead>
                  <TableHead className="whitespace-nowrap">Last Name</TableHead>
                  <TableHead className="whitespace-nowrap">Email</TableHead>
                  <TableHead className="whitespace-nowrap">Created At</TableHead>
                  <TableHead className="whitespace-nowrap">Referred By</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Job Title</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Shifts Worked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: COLS }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-3.5 bg-muted animate-pulse rounded w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredProspects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLS} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <UserPlus className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-base font-medium text-foreground">No leads found</p>
                        <p className="text-sm text-muted-foreground">
                          {referrerId
                            ? "This ambassador has not referred any prospects yet."
                            : "Leads will appear here once ambassadors refer prospects."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProspects.map((prospect) => {
                    const createdDate = formatDate(prospect.enrolledAt ?? prospect.createdAt);

                    return (
                      <TableRow key={prospect.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-foreground whitespace-nowrap">
                          {prospect.firstName || <Dash />}
                        </TableCell>

                        <TableCell className="text-foreground whitespace-nowrap">
                          {prospect.lastName || <Dash />}
                        </TableCell>

                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {prospect.email}
                        </TableCell>

                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {createdDate ?? <Dash />}
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          {prospect.referrerName ? (
                            <div className="flex flex-col leading-tight">
                              <span className="font-medium text-foreground">{prospect.referrerName}</span>
                              {prospect.referrerEmail && (
                                <span className="text-xs text-muted-foreground">{prospect.referrerEmail}</span>
                              )}
                            </div>
                          ) : (
                            <Dash />
                          )}
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          <JourneyBadge status={(prospect as { journeyStatus?: string | null }).journeyStatus} />
                        </TableCell>

                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {prospect.jobTitle || <Dash />}
                        </TableCell>

                        <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                          {prospect.shiftsCount != null ? prospect.shiftsCount : <Dash />}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!referrerId && allProspects.data && allProspects.data.total > limit && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
              <span className="text-sm text-muted-foreground">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * limit >= total}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {referrerId && (
            <div className="p-3 border-t border-border/50 bg-muted/10 text-center">
              <span className="text-xs text-muted-foreground">
                {filteredProspects.length} of {total} lead{total !== 1 ? "s" : ""}
                {search ? ` matching "${search}"` : ""}
              </span>
            </div>
          )}

          {!referrerId && filteredProspects.length > 0 && (
            <div className="p-3 border-t border-border/50 bg-muted/10 text-center">
              <span className="text-xs text-muted-foreground">
                {filteredProspects.length} lead{filteredProspects.length !== 1 ? "s" : ""} shown
                {search ? ` matching "${search}"` : ""}
                {" · "}Synced from GetAmbassador
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
