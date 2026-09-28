import { ReactNode } from "react";
import {
  Navigate,
  useLocation,
} from "react-router-dom";
import { UserRole } from "../api.js";
import { useAuth } from "../context/AuthContext.js";

interface AuthGuardProps {
  children: ReactNode;
  roles?: UserRole[];
  allowPasswordChange?: boolean;
}

export default function AuthGuard({
  children,
  roles,
  allowPasswordChange = false,
}: AuthGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container py-5 text-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (
    user.mustChangePassword &&
    !allowPasswordChange
  ) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }

  if (
    roles &&
    !roles.includes(user.role)
  ) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}