import { createContext } from "react";
import type { AdminUser, LoginRequest } from "@workspace/api-client-react";

export interface AuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);
