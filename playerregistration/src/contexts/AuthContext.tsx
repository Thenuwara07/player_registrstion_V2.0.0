import React, { createContext, useContext, useState } from "react";
import { SignUpResponse, SigninData } from "../types/authTypes";
import { User } from "@/types";
import { API_BASE_URL, apiRequest, getAuthToken } from "@/api/client";

interface AuthContextType {
  user: User | null;
  login: (signinData: SigninData) => Promise<SignUpResponse>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// The signed-in user is kept in sessionStorage so it survives page reloads
const readStoredUser = (): User | null => {
  try {
    const userData = sessionStorage.getItem("userData");
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read synchronously so protected routes see the user on the first render
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (signinData: SigninData): Promise<SignUpResponse> => {
    setIsLoading(true);
    try {
      const data = await apiRequest("/auth/signin", {
        method: "POST",
        body: { username: signinData.username, password: signinData.password },
        errorMessage: "Signin failed",
      });
      if (data.token && data.user) {
        sessionStorage.setItem("authToken", data.token);
        sessionStorage.setItem("userData", JSON.stringify(data.user));
        setUser(data.user);
      }
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Record the logout in the activity log (best effort, don't wait)
    const token = getAuthToken();
    if (token) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    }
    setUser(null);
    sessionStorage.removeItem("userData");
    sessionStorage.removeItem("authToken");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
