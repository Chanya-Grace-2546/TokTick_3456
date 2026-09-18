import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext.js";
import AuthGuard from "./components/AuthGuard.js";
import AppShell from "./components/AppShell.js";
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";
import HealthCheck from "./pages/HealthCheck.js";
import MyTickets from "./pages/MyTickets.js";
import CreateTicket from "./pages/CreateTicket.js";
import TicketDetail from "./pages/TicketDetail.js";
import StaffTicketQueue from "./pages/StaffTicketQueue.js";
import StaffTicketDetail from "./pages/StaffTicketDetail.js";
import UserManagement from "./pages/UserManagement.js";

function HomeRedirect() {
  const { user, loading } =
    useAuth();

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
      />
    );
  }

  if (
    user.mustChangePassword
  ) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }

  if (
    user.role === "REQUESTER"
  ) {
    return (
      <Navigate
        to="/tickets"
        replace
      />
    );
  }

  if (user.role === "IT_STAFF") {
    return <Navigate to="/staff/tickets" replace />;
  }

  return <Navigate to="/admin/users" replace />;
}

function AdministratorPage() {
  const { user } = useAuth();
  return user?.role === "ADMINISTRATOR" ? <UserManagement /> : (
    <div className="container py-4"><div role="alert" className="alert alert-danger">You do not have permission to manage Users.</div></div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell>
        <Routes>
          <Route path="/admin/users" element={<AuthGuard><AdministratorPage /></AuthGuard>} />
          <Route
            path="/"
            element={
              <HomeRedirect />
            }
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/change-password"
            element={
              <AuthGuard
                allowPasswordChange
              >
                <ChangePassword />
              </AuthGuard>
            }
          />

          <Route
            path="/tickets"
            element={
              <AuthGuard
                roles={["REQUESTER"]}
              >
                <MyTickets />
              </AuthGuard>
            }
          />

          <Route
            path="/tickets/new"
            element={
              <AuthGuard
                roles={["REQUESTER"]}
              >
                <CreateTicket />
              </AuthGuard>
            }
          />

          <Route
            path="/tickets/:id"
            element={
              <AuthGuard
                roles={["REQUESTER"]}
              >
                <TicketDetail />
              </AuthGuard>
            }
          />

          <Route
            path="/dev-check"
            element={<HealthCheck />}
          />

          <Route
            path="/staff/tickets"
            element={
              <AuthGuard roles={["IT_STAFF", "ADMINISTRATOR"]}>
                <StaffTicketQueue />
              </AuthGuard>
            }
          />

          <Route
            path="/staff/tickets/:id"
            element={
              <AuthGuard roles={["IT_STAFF", "ADMINISTRATOR"]}>
                <StaffTicketDetail />
              </AuthGuard>
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Routes>
      </AppShell>
    </AuthProvider>
  );
}
