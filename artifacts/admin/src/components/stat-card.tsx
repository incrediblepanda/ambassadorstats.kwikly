import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  delay?: number;
  description?: string;
}

export function StatCard({ title, value, icon: Icon, trend, delay = 0, description }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
    >
      <Card className="overflow-hidden bg-card border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 group">
        <div className="h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
              <h3 className="text-2xl font-display font-bold text-foreground mt-2 leading-none tabular-nums">{value}</h3>
              {description && (
                <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{description}</p>
              )}
              {trend && (
                <p className="text-[11px] font-semibold text-emerald-700 mt-2 flex items-center bg-emerald-50 w-fit px-2 py-0.5 rounded-full border border-emerald-100">
                  {trend}
                </p>
              )}
            </div>
            <div className="p-2.5 bg-primary/8 rounded-xl group-hover:bg-primary/15 transition-colors shrink-0 ring-1 ring-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
