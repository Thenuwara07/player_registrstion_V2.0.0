import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const PublicRoute = ({
  children,
  redirectTo = "/",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) => {
  const { user, isLoading } = useAuth();

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
