import { Link } from "react-router-dom";
import { zenGreen } from "../theme.js";



// Stands in for the real My Tickets screen (Issue 5). Its only job right
// now is to prove RequesterGuard + RequesterContext work end-to-end.
export default function TicketsPlaceholder() {
  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <div
        className="bg-white rounded p-4"
        style={{ border: "1px solid #E0E5E2", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        <div className="d-flex justify-content-between align-items-center">
          <h1 className="h4 mb-0" style={{ color: zenGreen.text }}>
            My Tickets
          </h1>
          <Link to="/tickets/new" className="btn btn-sm" style={{ backgroundColor: zenGreen.primary, color: "white" }}>
            + Create Ticket
          </Link>
        </div>
        <p className="text-muted mt-3 mb-0">Full list coming in Issue 5.</p>
      </div>
    </div>
  );
}