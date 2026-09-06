import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchTickets, TicketListItem, Priority } from "../api.js";
import { useRequester } from "../context/RequesterContext.js";
import { zenGreen } from "../theme.js";

type ScreenState = "loading" | "error" | "ready";
type SortField = "ticketNumber" | "createdAt" | "updatedAt";

const cardStyle: React.CSSProperties = {
  backgroundColor: "white",
  border: "1px solid #E0E5E2",
  borderRadius: 8,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: "#0B7A46",
  MEDIUM: "#B8860B",
  HIGH: "#B3261E",
};

const SORT_LABELS: Record<SortField, string> = {
  ticketNumber: "Ticket No.",
  createdAt: "Created Date",
  updatedAt: "Last Updated",
};

// Lab 2 Issue 5 — My Tickets
// Reused this file from Issue 2's placeholder rather than creating a new
// one, since it already owns the /tickets route.
export default function TicketsPlaceholder() {
  const { requester } = useRequester();
  const navigate = useNavigate();

  const [state, setState] = useState<ScreenState>("loading");
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [search, setSearch] = useState("");
  const [requestedPriority, setRequestedPriority] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const hasActiveFilters = Boolean(search || requestedPriority || currentStatus);

  useEffect(() => {
    if (!requester) return;
    let cancelled = false;
    setState("loading");

    fetchTickets({
      requesterId: requester.id,
      search: search || undefined,
      requestedPriority: (requestedPriority as Priority) || undefined,
      currentStatus: currentStatus || undefined,
      sortBy,
      sortDir,
      page,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotalPages(res.totalPages);
        setTotalItems(res.totalItems);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [requester, search, requestedPriority, currentStatus, sortBy, sortDir, page]);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setRequestedPriority("");
    setCurrentStatus("");
    setPage(1);
  }

  return (
    <div className="container py-5" style={{ maxWidth: 960 }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0" style={{ color: zenGreen.text }}>
          My Tickets
        </h1>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
          >
            Clear Filters
          </button>
          <Link
            to="/tickets/new"
            className="btn btn-sm"
            style={{ backgroundColor: zenGreen.primary, color: "white" }}
          >
            + Create Ticket
          </Link>
        </div>
      </div>

      <div className="p-3 mb-3" style={cardStyle}>
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <input
              type="text"
              className="form-control"
              placeholder="Search by ticket number or summary…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search tickets"
            />
          </div>
          <div className="col-12 col-md-3">
            <select
              className="form-select"
              value={requestedPriority}
              onChange={(e) => {
                setRequestedPriority(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by priority"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div className="col-12 col-md-3">
            <select
              className="form-select"
              value={currentStatus}
              onChange={(e) => {
                setCurrentStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="position-relative">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setSortMenuOpen((v) => !v)}
            aria-expanded={sortMenuOpen}
          >
            Sort: {SORT_LABELS[sortBy]} ({sortDir === "asc" ? "▲" : "▼"})
          </button>
          {sortMenuOpen && (
            <div
              role="menu"
              className="position-absolute start-0 mt-1 bg-white shadow rounded"
              style={{ minWidth: 220, zIndex: 10 }}
            >
              {(Object.keys(SORT_LABELS) as SortField[]).map((field) => (
                <button
                  key={field}
                  type="button"
                  role="menuitem"
                  className="btn btn-sm w-100 text-start d-flex justify-content-between"
                  style={sortBy === field ? { backgroundColor: zenGreen.pale } : undefined}
                  onClick={() => {
                    toggleSort(field);
                    setSortMenuOpen(false);
                  }}
                >
                  <span>{SORT_LABELS[field]}</span>
                  {sortBy === field && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {state === "loading" && <p role="status">Loading tickets…</p>}
      {state === "error" && (
        <p role="alert" className="text-danger">
          Couldn't load your tickets. Please try again.
        </p>
      )}

      {state === "ready" && totalItems === 0 && !hasActiveFilters && (
        <div className="p-4 text-center" style={cardStyle}>
          <p className="mb-3">You don't have any tickets yet.</p>
          <Link
            to="/tickets/new"
            className="btn btn-sm"
            style={{ backgroundColor: zenGreen.primary, color: "white" }}
          >
            + Create Ticket
          </Link>
        </div>
      )}

      {state === "ready" && totalItems === 0 && hasActiveFilters && (
        <div className="p-4 text-center" style={cardStyle}>
          <p className="mb-3">No tickets match your search or filters.</p>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      )}

      {state === "ready" && items.length > 0 && (
        <>
          <div className="table-responsive" style={cardStyle}>
            <table className="table mb-0">
              <thead>
                <tr>
                  <th role="button" onClick={() => toggleSort("ticketNumber")}>
                    Ticket No. {sortBy === "ticketNumber" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th>Summary</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th role="button" onClick={() => toggleSort("createdAt")}>
                    Created Date {sortBy === "createdAt" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th role="button" onClick={() => toggleSort("updatedAt")}>
                    Last Updated {sortBy === "updatedAt" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr
                    key={t.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                  >
                    <td>{t.ticketNumber}</td>
                    <td>{t.summary}</td>
                    <td>{t.category}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ backgroundColor: PRIORITY_BADGE[t.requestedPriority] }}
                      >
                        {t.requestedPriority}
                      </span>
                    </td>
                    <td>{t.currentStatus}</td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td>{new Date(t.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="small text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
