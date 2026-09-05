import { Routes, Route } from "react-router-dom";
import { RequesterProvider } from "./context/RequesterContext.js";
import RequesterGuard from "./components/RequesterGuard.js";
import RequesterSelection from "./pages/RequesterSelection.js";
import HealthCheck from "./pages/HealthCheck.js";
import TicketsPlaceholder from "./pages/TicketsPlaceholder.js";
import CreateTicket from "./pages/CreateTicket.js";
import TicketDetail from "./pages/TicketDetail.js";
import AppShell from "./components/AppShell.js";

// Lab 2 router shell. "/" is the Development Requester Selection screen
// (BR-04). "/tickets" is My Tickets (Issue 5). "/tickets/new" is Create
// Ticket (Issue 4). "/tickets/:id" is Requester Ticket Detail (Issue 6).
// All three are gated by RequesterGuard per BR-07. "/dev-check" keeps
// Lab 1's demo reachable. AppShell wraps everything so the Zen Green
// header/nav (handout §8) is consistent across every screen.
export default function App() {
  return (
    <RequesterProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<RequesterSelection />} />
          <Route
            path="/tickets"
            element={
              <RequesterGuard>
                <TicketsPlaceholder />
              </RequesterGuard>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <RequesterGuard>
                <CreateTicket />
              </RequesterGuard>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <RequesterGuard>
                <TicketDetail />
              </RequesterGuard>
            }
          />
          <Route path="/dev-check" element={<HealthCheck />} />
        </Routes>
      </AppShell>
    </RequesterProvider>
  );
}
