import { Routes, Route } from "react-router-dom";
import { RequesterProvider } from "./context/RequesterContext.js";
import RequesterGuard from "./components/RequesterGuard.js";
import RequesterSelection from "./pages/RequesterSelection.js";
import HealthCheck from "./pages/HealthCheck.js";
import TicketsPlaceholder from "./pages/TicketsPlaceholder.js";

export default function App() {
  return (
    <RequesterProvider>
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
        <Route path="/dev-check" element={<HealthCheck />} />
      </Routes>
    </RequesterProvider>
  );
}