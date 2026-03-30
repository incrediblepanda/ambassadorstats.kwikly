import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import kwiklyLogo from "@assets/Kwikly_Logo_1774727053483.png";

export default function Login() {
  const { login, user, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
      toast({
        title: "Welcome back",
        description: "You're now signed in to the Kwikly Admin Portal.",
      });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Sign in failed",
        description: err?.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-accent/40 via-background to-secondary/30 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="z-10 w-full max-w-sm px-4"
      >
        {/* Logo block */}
        <div className="text-center mb-8">
          <img 
            src={kwiklyLogo}
            alt="Kwikly" 
            className="h-14 w-auto mx-auto mb-4"
          />
          <h1 className="text-xl font-display font-bold text-foreground tracking-tight mt-3">Ambassador Admin</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Sign in to manage your ambassador program</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-lg shadow-primary/5 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@joinkwikly.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10 bg-muted/40 border-border focus:border-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-10 bg-muted/40 border-border focus:border-primary/50"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-10 text-sm font-semibold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all mt-2"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Kwikly Ambassador Admin &mdash; Internal Use Only
        </p>
      </motion.div>
    </div>
  );
}
