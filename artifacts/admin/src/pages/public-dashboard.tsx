import React, { useState } from "react";
import { useParams, useSearch } from "wouter";
import { useGetDashboardData, getGetDashboardDataQueryKey } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Users, Briefcase, Building2, CheckCheck, Activity, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import kwiklyLogo from "@assets/Kwikly_Logo_1774727053483.png";

function StatusBadge({ status }: { status?: string | null }) {
  const isActive = status === "active";
  return (
    <Badge variant={isActive ? "default" : "secondary"} className="rounded-md capitalize">
      {isActive ? "Active" : status ? status : "Inactive"}
    </Badge>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-display font-bold text-foreground">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        <div className="h-7 w-16 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

interface ProfReferral {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  status?: string | null;
  numberShiftsWorked?: number | null;
  createdAtSource?: string | null;
  approvedAt?: string | null;
}

interface CompReferral {
  id: number;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  status?: string | null;
  totalShiftsWorked?: number | null;
  associatedOfficeId?: string | null;
  createdAtSource?: string | null;
  approvedAt?: string | null;
}

type ProfSortKey = "firstName" | "lastName" | "email" | "jobTitle" | "status" | "numberShiftsWorked" | "createdAtSource" | "approvedAt";

function ProfessionalTable({ referrals }: { referrals: ProfReferral[] }) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<ProfSortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const itemsPerPage = 10;

  const sortedReferrals = [...referrals].sort((a, b) => {
    if (!sortBy) return 0;
    const aVal = a[sortBy as keyof ProfReferral];
    const bVal = b[sortBy as keyof ProfReferral];
    
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedReferrals.length / itemsPerPage);
  const paginatedReferrals = sortedReferrals.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  const handleSort = (key: ProfSortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
    setPage(0);
  };

  const SortIcon = ({ columnKey }: { columnKey: ProfSortKey }) => {
    if (sortBy !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  if (referrals.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No professional referrals yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("firstName")}>
                <div className="flex items-center gap-1">First Name <SortIcon columnKey="firstName" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("lastName")}>
                <div className="flex items-center gap-1">Last Name <SortIcon columnKey="lastName" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("email")}>
                <div className="flex items-center gap-1">Email <SortIcon columnKey="email" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("jobTitle")}>
                <div className="flex items-center gap-1">Job Title <SortIcon columnKey="jobTitle" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("status")}>
                <div className="flex items-center gap-1">Status <SortIcon columnKey="status" /></div>
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("numberShiftsWorked")}>
                <div className="flex items-center justify-end gap-1">Shifts Worked <SortIcon columnKey="numberShiftsWorked" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("createdAtSource")}>
                <div className="flex items-center gap-1">Created At <SortIcon columnKey="createdAtSource" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("approvedAt")}>
                <div className="flex items-center gap-1">Approved At <SortIcon columnKey="approvedAt" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedReferrals.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.firstName || "—"}</TableCell>
                <TableCell>{r.lastName || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.email || "—"}</TableCell>
                <TableCell className="text-sm">{r.jobTitle || "—"}</TableCell>
                <TableCell>
                  {r.status ? (
                    <Badge variant="outline" className="bg-muted/50 capitalize text-xs">
                      {r.status}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold">{r.numberShiftsWorked != null ? r.numberShiftsWorked : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.createdAtSource ? format(new Date(r.createdAtSource), "MMM d") : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.approvedAt ? format(new Date(r.approvedAt), "MMM d") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} ({referrals.length} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type CompSortKey = "companyName" | "firstName" | "lastName" | "email" | "status" | "totalShiftsWorked" | "createdAtSource" | "approvedAt";

function CompanyTable({ referrals }: { referrals: CompReferral[] }) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<CompSortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const itemsPerPage = 10;

  const sortedReferrals = [...referrals].sort((a, b) => {
    if (!sortBy) return 0;
    const aVal = a[sortBy as keyof CompReferral];
    const bVal = b[sortBy as keyof CompReferral];
    
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedReferrals.length / itemsPerPage);
  const paginatedReferrals = sortedReferrals.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  const handleSort = (key: CompSortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
    setPage(0);
  };

  const SortIcon = ({ columnKey }: { columnKey: CompSortKey }) => {
    if (sortBy !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  if (referrals.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No company referrals yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("companyName")}>
                <div className="flex items-center gap-1">Company Name <SortIcon columnKey="companyName" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("firstName")}>
                <div className="flex items-center gap-1">First Name <SortIcon columnKey="firstName" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("lastName")}>
                <div className="flex items-center gap-1">Last Name <SortIcon columnKey="lastName" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("email")}>
                <div className="flex items-center gap-1">Email <SortIcon columnKey="email" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("status")}>
                <div className="flex items-center gap-1">Status <SortIcon columnKey="status" /></div>
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("totalShiftsWorked")}>
                <div className="flex items-center justify-end gap-1">Total Shifts <SortIcon columnKey="totalShiftsWorked" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("createdAtSource")}>
                <div className="flex items-center gap-1">Created At <SortIcon columnKey="createdAtSource" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("approvedAt")}>
                <div className="flex items-center gap-1">Approved At <SortIcon columnKey="approvedAt" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedReferrals.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-semibold">{r.companyName || "—"}</TableCell>
                <TableCell>{r.firstName || "—"}</TableCell>
                <TableCell>{r.lastName || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.email || "—"}</TableCell>
                <TableCell>
                  {r.status ? (
                    <Badge variant="outline" className="bg-muted/50 capitalize text-xs">
                      {r.status}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold">{r.totalShiftsWorked != null ? r.totalShiftsWorked : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.createdAtSource ? format(new Date(r.createdAtSource), "MMM d") : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.approvedAt ? format(new Date(r.approvedAt), "MMM d") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} ({referrals.length} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicDashboard() {
  const params = useParams<{ shortCode: string }>();
  const shortCode = params.shortCode ?? "";
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";

  const missingToken = !token;

  const { data, isLoading, isError, error } = useGetDashboardData(
    shortCode,
    { token },
    { query: { queryKey: getGetDashboardDataQueryKey(shortCode, { token }), retry: false, enabled: !!shortCode && !missingToken } },
  );

  const [activeTab, setActiveTab] = useState<"professionals" | "companies">("professionals");

  const isAccessDenied =
    missingToken ||
    (isError && (error as { status?: number })?.status === 401);

  const isNotFound =
    isError &&
    (error as { status?: number })?.status === 404;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <img 
            src={kwiklyLogo}
            alt="Kwikly" 
            className="h-8 w-auto"
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-6">
            <div>
              <div className="h-8 w-48 bg-muted rounded-lg mb-3 animate-pulse" />
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
            </div>
          </div>
        )}

        {/* Access denied */}
        {isAccessDenied && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-8 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-destructive/10 mb-4">
                <XCircle className="w-7 h-7 text-destructive" />
              </div>
              <h1 className="text-xl font-display font-bold text-foreground mb-2">Access Denied</h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                This dashboard link is invalid or has expired. Please contact your program administrator for a new link.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Not found */}
        {isNotFound && (
          <Card className="border-muted-foreground/20 bg-muted/5">
            <CardContent className="p-8 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-muted/30 mb-4">
                <Users className="w-7 h-7 text-muted-foreground" />
              </div>
              <h1 className="text-xl font-display font-bold text-foreground mb-2">Ambassador Not Found</h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                No ambassador dashboard was found at this address.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Generic error */}
        {isError && !isAccessDenied && !isNotFound && (
          <Card className="border-amber-200/50 bg-amber-50/30">
            <CardContent className="p-8 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-100/50 mb-4">
                <XCircle className="w-7 h-7 text-amber-600" />
              </div>
              <h1 className="text-xl font-display font-bold text-foreground mb-2">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">Unable to load dashboard. Please try again.</p>
            </CardContent>
          </Card>
        )}

        {/* Dashboard content */}
        {data && (
          <div className="space-y-7">
            {/* Ambassador header */}
            <div>
              <h1 className="text-3xl font-display font-bold mb-3 text-foreground">
                {data.ambassador.fullName}
              </h1>
              <StatusBadge status={data.ambassador.status} />
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="Total Referrals" value={data.summary.totalReferrals} icon={Users} />
              <KpiCard label="Approved" value={data.summary.approvedReferrals} icon={CheckCheck} />
              <KpiCard label="Professionals" value={data.summary.professionalReferrals} icon={Briefcase} />
              <KpiCard label="Companies" value={data.summary.companyReferrals} icon={Building2} />
              <KpiCard label="Prof. Shifts" value={data.summary.totalProfessionalShiftsWorked} icon={Activity} />
              <KpiCard label="Company Shifts" value={data.summary.totalCompanyShiftsFilled} icon={Activity} />
            </div>

            {/* Referral tabs */}
            <Card className="border-border/50 shadow-sm">
              {/* Tab switcher */}
              <div className="border-b border-border flex">
                <button
                  className={`px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
                    activeTab === "professionals"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab("professionals")}
                >
                  Professionals
                  <span className="ml-2 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                    {data.summary.professionalReferrals}
                  </span>
                </button>
                <button
                  className={`px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
                    activeTab === "companies"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab("companies")}
                >
                  Companies
                  <span className="ml-2 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                    {data.summary.companyReferrals}
                  </span>
                </button>
              </div>

              {/* Tab content */}
              <CardContent className="p-6">
                {activeTab === "professionals" ? (
                  <ProfessionalTable referrals={data.professionalReferrals as ProfReferral[]} />
                ) : (
                  <CompanyTable referrals={data.companyReferrals as CompReferral[]} />
                )}
              </CardContent>
            </Card>

            {/* Footer */}
            {data.ambassador.lastSyncedAt && (
              <p className="text-xs text-muted-foreground text-center">
                Last updated {format(new Date(data.ambassador.lastSyncedAt), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
