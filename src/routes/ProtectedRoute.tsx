import type { JSX } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { UserRole } from "@/types/user.type";
import { useAppSelector, useAppDispatch } from "@/hooks/useRedux";
import { fetchProfile } from "@/store/slices";
import { useEffect } from "react";

interface Props {
  children?: JSX.Element;
  role?: UserRole;
}

const ProtectedRoute = ({ children, role }: Props) => {
  const { user, loading, error } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  // Check if user is logged in but user data is missing (after page refresh)
  useEffect(() => {
    const hasLoginFlag = localStorage.getItem("userLoggedIn") === "true";
    if (hasLoginFlag && !user && !loading && !error) {
      dispatch(fetchProfile(undefined));
    }
  }, [dispatch, user, loading, error]);

  // Check authentication with localStorage flag and server validation
  const hasLoginFlag = localStorage.getItem("userLoggedIn") === "true";

  // If no login flag at all, redirect immediately
  if (!hasLoginFlag) {
    return <Navigate to="/login" replace />;
  }

  // If has login flag but no user data, wait for profile verification.
  // This avoids redirecting to /login before fetchProfile() has a chance to run.
  if (hasLoginFlag && !user && (loading || !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // If verification failed, redirect to login
  if (hasLoginFlag && !user && error) {
    return <Navigate to="/login" replace />;
  }

  // Check role authorization only if role is specified
  if (role && user && user.role !== role) {
    // If user is logged in but doesn't have required role, redirect to home
    return <Navigate to="/" replace />;
  }

  // Return children if provided, otherwise use Outlet for nested routes
  return children || <Outlet />;
};

export default ProtectedRoute;
