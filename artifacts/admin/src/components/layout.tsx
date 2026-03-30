import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Users, 
  UserPlus,
  RefreshCw, 
  Settings, 
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import kwiklyLogo from "@assets/Kwikly_Logo_1774727053483.png";
import kwiklyIcon from "@assets/favicon_1774726558525.webp";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ambassadors", label: "Ambassadors", icon: Users },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/sync-jobs", label: "Sync Jobs", icon: RefreshCw },
  { href: "/settings", label: "Settings", icon: Settings },
];

function KwiklyLogoMark() {
  return (
    <img 
      src={kwiklyIcon}
      alt="Kwikly" 
      className="w-8 h-8 shrink-0"
    />
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return <>{children}</>;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-gradient-to-b from-card via-card to-muted/20 z-20 fixed inset-y-0">
        {/* Logo area */}
        <div className="h-14 flex items-center px-4 border-b border-border/70">
          <img 
            src={kwiklyLogo}
            alt="Kwikly"
            className="h-9 w-auto"
          />
        </div>
        
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`
                  flex items-center px-3 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 group
                  ${isActive 
                    ? "bg-primary text-white shadow-sm shadow-primary/30" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                `}
              >
                <item.icon className={`w-4 h-4 mr-3 shrink-0 ${isActive ? "text-white/90" : "text-muted-foreground group-hover:text-foreground"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/70">
          <div className="flex items-center mb-2.5 px-2 py-1.5 rounded-lg bg-muted/40">
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
              {user.email.substring(0, 1)}
            </div>
            <div className="ml-2.5 overflow-hidden min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user.email}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Administrator</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/8 text-xs h-8" 
            onClick={handleLogout}
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 border-b border-border bg-card z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <KwiklyLogoMark />
          <h1 className="font-display font-bold text-base text-foreground">Kwikly</h1>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="w-4 h-4" />
        </Button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed right-0 inset-y-0 w-60 bg-card z-50 flex flex-col shadow-2xl lg:hidden border-l border-border"
            >
              <div className="h-14 flex items-center justify-between px-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <KwiklyLogoMark />
                  <span className="font-display font-bold text-sm">Kwikly</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <nav className="flex-1 py-4 px-3 space-y-0.5">
                {navItems.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link 
                      key={item.href} 
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`
                        flex items-center px-3 py-2.5 rounded-lg font-medium text-sm transition-all
                        ${isActive 
                          ? "bg-primary text-white shadow-sm shadow-primary/25" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }
                      `}
                    >
                      <item.icon className="w-4 h-4 mr-3" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-border">
                <Button variant="outline" size="sm" className="w-full text-destructive border-destructive/30 hover:bg-destructive/8 hover:border-destructive/50" onClick={handleLogout}>
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sign out
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 w-full lg:pl-60 pt-14 lg:pt-0">
        <div className="p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
