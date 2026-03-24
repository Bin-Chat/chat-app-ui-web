import type { JSX } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "@/hooks/useRedux";

interface Props {
  children?: JSX.Element;
}

// Route to restrict access to authentication pages for logged-in users
const AuthRoute = ({ children }: Props) => {
  const { user } = useAppSelector((state) => state.auth);
  const hasLoginFlag = localStorage.getItem("userLoggedIn") === "true";

  // If user is logged in, redirect to home
  if (user && hasLoginFlag) {
    return <Navigate to="/" replace />;
  }

  // Return children if provided, otherwise use Outlet for nested routes
  return children || <Outlet />;
};

export default AuthRoute;
