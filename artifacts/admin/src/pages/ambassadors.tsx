import { useState } from "react";
import { useListAmbassadors } from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Copy, Check, ChevronRight, LayoutDashboard, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Ambassadors() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const limit = 10;
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data, isLoading } = useListAmbassadors({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: statusFilter !== "ALL" ? statusFilter : undefined,
  });

  const handleCopyUrl = (url: string, id: number) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: "Copied to clipboard", description: "Iframe URL copied." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Ambassadors" 
        description="Manage enrolled advocates and their referral dashboard access." 
      />

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 bg-muted/20">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, email, or code..." 
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select 
              value={statusFilter} 
              onValueChange={(val) => { setStatusFilter(val); setPage(1); }}
            >
              <SelectTrigger className="w-full sm:w-[180px] bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Ambassador</TableHead>
                  <TableHead>Short Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Dashboard</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-16">
                        <div className="h-4 bg-muted animate-pulse rounded w-full max-w-[200px]" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.ambassadors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <img 
                          src={`${import.meta.env.BASE_URL}images/empty-state.png`} 
                          alt="No data" 
                          className="w-32 h-32 opacity-80 mix-blend-multiply"
                        />
                        <p className="text-lg font-medium text-foreground mt-4">No ambassadors found</p>
                        <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or triggering a sync.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.ambassadors.map((amb, idx) => (
                    <TableRow key={amb.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{amb.firstName} {amb.lastName}</span>
                          <span className="text-xs text-muted-foreground">{amb.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {amb.shortCode ? (
                          <code className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-mono font-semibold">
                            {amb.shortCode}
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={amb.status === 'active' ? 'default' : 'secondary'} className="font-medium">
                          {amb.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {amb.leadCount > 0 ? (
                          <Link href={`/leads?referrer=${amb.id}`}>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
                              <UserPlus className="w-3 h-3" />
                              {amb.leadCount}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {amb.dashboardAccountCreated ? (
                          <div className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">
                            <LayoutDashboard className="w-3 h-3 mr-1" /> Ready
                          </div>
                        ) : (
                          <div className="flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
                            Pending Sync
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {amb.lastSyncedAt ? format(new Date(amb.lastSyncedAt), "MMM d, yy") : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {amb.iframeUrl && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 shadow-sm hover:shadow"
                              onClick={() => handleCopyUrl(amb.iframeUrl!, amb.id)}
                            >
                              {copiedId === amb.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                              <span className="sr-only">Copy Link</span>
                            </Button>
                          )}
                          <Link href={`/ambassadors/${amb.id}`}>
                            <Button size="sm" className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow group-hover:-translate-y-0.5 transition-transform">
                              View <ChevronRight className="w-4 h-4 ml-1 opacity-70" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data && data.total > limit && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
              <span className="text-sm text-muted-foreground">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, data.total)} of {data.total}
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
                  disabled={page * limit >= data.total}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
