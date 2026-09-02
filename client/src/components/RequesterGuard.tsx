import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext.js";

// BR-07: without a selected Development Requester, any attempt to open
// My Tickets, Create Ticket, or Ticket Detail redirects to Selection.
export default function RequesterGuard({ children }: { children: ReactNode }) {
  const { requester } = useRequester();

  if (!requester) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
