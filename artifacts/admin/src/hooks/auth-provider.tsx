import { ReactNode, useEffect } from "react";
import { useGetCurrentAdmin, useAdminLogin, useAdminLogout, LoginRequest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCurrentAdminQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { AuthContext } from "./auth-context";
import { useAuth } from "./use-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading, isError } = useGetCurrentAdmin({
    query: {
      queryKey: getGetCurrentAdminQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    }
  });

  const { mutateAsync: loginMutation, isPending: isLoggingIn } = useAdminLogin();
  const { mutateAsync: logoutMutation, isPending: isLoggingOut } = useAdminLogout();

  const login = async (data: LoginRequest) => {
    await loginMutation({ data });
    await queryClient.invalidateQueries({ queryKey: getGetCurrentAdminQueryKey() });
  };

  const logout = async () => {
    await logoutMutation();
    queryClient.setQueryData(getGetCurrentAdminQueryKey(), null);
    await queryClient.invalidateQueries();
  };

  const resolvedUser = isError ? null : (user || null);

  return (
    <AuthContext.Provider value={{
      user: resolvedUser,
      isLoading,
      login,
      logout,
      isLoggingIn,
      isLoggingOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
