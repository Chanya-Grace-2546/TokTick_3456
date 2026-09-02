import RequesterIndicator from "../components/RequesterIndicator.js";

// Stands in for the real My Tickets screen (Issue 5). Its only job right
// now is to prove RequesterGuard + RequesterContext work end-to-end: you
// can only land here with a Requester selected, and that Requester's name
// is shown with a working "Change Requester" action.
export default function TicketsPlaceholder() {
  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <RequesterIndicator />
      <h1 className="h4 mt-4">My Tickets</h1>
      <p className="text-muted">Coming in Issue 5.</p>
    </div>
  );
}
