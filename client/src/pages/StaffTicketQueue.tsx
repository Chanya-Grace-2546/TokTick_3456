import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Category, Priority, StaffOwner, StaffQueueError, StaffQueueItem,
  StaffQueueParams, StaffQueueResponse, StaffQueueSort, StaffTicketStatus,
  fetchCategories, fetchStaffOwners, fetchStaffTickets,
} from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { zenGreen } from "../theme.js";

const DEFAULT_QUERY: StaffQueueParams = { sortBy: "updatedAt", sortDir: "desc", page: 1, pageSize: 10 };
const STATUSES: StaffTicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const SORTS: Record<StaffQueueSort, string> = {
  updatedAt: "Updated", createdAt: "Created", ticketNumber: "Ticket Number",
  requestedPriority: "Requested Priority", itPriority: "IT Priority", status: "Status",
};
const PRIORITY_COLORS: Record<Priority, string> = { LOW: zenGreen.primary, MEDIUM: "#806000", HIGH: zenGreen.error };
const panelStyle = { backgroundColor: "white", border: "1px solid #E0E5E2", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };

function label(value: string) {
  if (value === "WAITING_FOR_REQUESTER") return "Waiting for Requester";
  return value.toLowerCase().split("_").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className="badge" style={{ backgroundColor: PRIORITY_COLORS[priority] }}>{label(priority)}</span>;
}

function Priorities({ ticket }: { ticket: StaffQueueItem }) {
  return <div className="d-flex flex-wrap gap-2">
    <span><span className="small text-muted">Requested Priority </span><PriorityBadge priority={ticket.requestedPriority} /></span>
    <span><span className="small text-muted">IT Priority </span><PriorityBadge priority={ticket.itPriority} /></span>
  </div>;
}

function RequesterEmail({ email }: { email: string }) {
  const domainStart = email.lastIndexOf("@") + 1;
  // Prefer a break at the domain boundary; only unusually long parts need
  // character wrapping. Both parts remain fully visible within the column.
  const partStyle = { display: "inline-block", maxWidth: "100%", verticalAlign: "top" };
  return <span>
    <span style={partStyle}>{email.slice(0, domainStart)}</span><wbr />
    <span style={partStyle}>{email.slice(domainStart)}</span>
  </span>;
}

function Status({ status }: { status: StaffTicketStatus }) {
  return <span className="badge text-wrap text-start" style={{ backgroundColor: zenGreen.pale, color: zenGreen.primary }}>{label(status)}</span>;
}

function Updated({ date }: { date: string }) {
  return <time dateTime={date}>{new Date(date).toLocaleString()}</time>;
}

export default function StaffTicketQueue() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState<StaffQueueParams>(DEFAULT_QUERY);
  const [data, setData] = useState<StaffQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [owners, setOwners] = useState<StaffOwner[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filtersError, setFiltersError] = useState(false);
  const [filtersRetry, setFiltersRetry] = useState(0);

  async function handleAuthError(failure: unknown) {
    if (failure instanceof StaffQueueError && (failure.status === 401 || failure.code === "PASSWORD_CHANGE_REQUIRED")) {
      await refreshUser();
      navigate(failure.status === 401 ? "/login" : "/change-password", { replace: true });
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStaffTickets(query).then(result => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    }).catch(failure => {
      if (cancelled) return;
      setData(null);
      setError(failure);
      setLoading(false);
      if (failure instanceof StaffQueueError && failure.code === "INVALID_QUERY") setFiltersOpen(true);
      void handleAuthError(failure);
    });
    return () => { cancelled = true; };
  }, [query, retry]);

  useEffect(() => {
    let cancelled = false;
    setFiltersLoading(true);
    setFiltersError(false);
    Promise.all([fetchCategories(), fetchStaffOwners()]).then(([categoryRows, ownerRows]) => {
      if (cancelled) return;
      setCategories(categoryRows);
      setOwners(ownerRows);
    }).catch(failure => {
      if (cancelled) return;
      setFiltersError(true);
      void handleAuthError(failure);
    }).finally(() => { if (!cancelled) setFiltersLoading(false); });
    return () => { cancelled = true; };
  }, [filtersRetry]);

  function change(values: Partial<StaffQueueParams>) {
    setQuery(current => ({ ...current, ...values, page: 1 }));
  }

  const hasFilters = Boolean(query.search || query.category || query.requestedPriority || query.itPriority || query.status || query.owner);
  const fieldErrors = error instanceof StaffQueueError ? error.fields : {};
  const errorMessage = error instanceof StaffQueueError && error.code === "FORBIDDEN"
    ? "You do not have permission to view the ticket queue."
    : error instanceof StaffQueueError && error.code === "INVALID_QUERY"
      ? "Check the queue filters and try again."
      : "Could not load the ticket queue. Please try again.";

  function fieldError(name: string) {
    return fieldErrors[name] ? <div id={`queue-${name}-error`} className="small text-danger">{fieldErrors[name]}</div> : null;
  }
  function invalidProps(name: string) {
    return { "aria-invalid": Boolean(fieldErrors[name]), "aria-describedby": fieldErrors[name] ? `queue-${name}-error` : undefined };
  }

  return (
    <div className="container py-4" style={{ maxWidth: 1200, color: zenGreen.text, overflowWrap: "anywhere" }}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h4 mb-0">Ticket Queue</h1>
        {data && !loading && !error && <span className="small text-muted">{data.totalItems} tickets</span>}
      </div>

      <section aria-label="Queue controls" className="p-3 mb-3" style={panelStyle}>
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-8">
            <label htmlFor="queue-search" className="form-label">Search tickets</label>
            <input id="queue-search" className="form-control" type="search" placeholder="Ticket number, summary, requester name or email" value={query.search ?? ""} onChange={e => change({ search: e.target.value || undefined })} {...invalidProps("search")} />
            {fieldError("search")}
          </div>
          <div className="col-12 col-md-4 d-flex flex-wrap gap-2">
            <button className="btn btn-outline-secondary" type="button" aria-expanded={filtersOpen} aria-controls="queue-filters" onClick={() => setFiltersOpen(open => !open)}>Filters</button>
            <button className="btn btn-outline-secondary" type="button" disabled={!hasFilters} onClick={() => setQuery({ sortBy: query.sortBy, sortDir: query.sortDir, page: 1, pageSize: query.pageSize })}>Clear filters</button>
          </div>
        </div>

        {filtersError && <div role="alert" className="mt-3"><span>Could not load queue filters.</span> <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFiltersRetry(n => n + 1)}>Retry filters</button></div>}

        <div id="queue-filters" hidden={!filtersOpen}>
          <div className="row g-3 mt-1">
            <div className="col-12 col-md-6 col-lg-4">
              <label className="form-label" htmlFor="queue-category">Category</label>
              <select id="queue-category" className="form-select" value={query.category ?? ""} disabled={filtersLoading || filtersError} onChange={e => change({ category: e.target.value ? Number(e.target.value) : undefined })} {...invalidProps("category")}>
                <option value="">All categories</option>
                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              {fieldError("category")}
            </div>
            {(["requestedPriority", "itPriority"] as const).map(key => <div className="col-12 col-md-6 col-lg-4" key={key}>
              <label className="form-label" htmlFor={`queue-${key}`}>{key === "requestedPriority" ? "Requested Priority" : "IT Priority"}</label>
              <select id={`queue-${key}`} className="form-select" value={query[key] ?? ""} onChange={e => change({ [key]: e.target.value || undefined })} {...invalidProps(key)}>
                <option value="">All priorities</option>
                {(["LOW", "MEDIUM", "HIGH"] as const).map(priority => <option key={priority} value={priority}>{label(priority)}</option>)}
              </select>
              {fieldError(key)}
            </div>)}
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="queue-status">Status</label>
              <select id="queue-status" className="form-select" value={query.status ?? ""} onChange={e => change({ status: e.target.value as StaffTicketStatus || undefined })} {...invalidProps("status")}>
                <option value="">All statuses</option>
                {STATUSES.map(status => <option key={status} value={status}>{label(status)}</option>)}
              </select>
              {fieldError("status")}
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="queue-owner">Owner</label>
              <select id="queue-owner" className="form-select" value={query.owner ?? ""} disabled={filtersLoading || filtersError} onChange={e => {
                const owner = e.target.value;
                change({ owner: owner === "me" || owner === "unassigned" ? owner : owner ? Number(owner) : undefined });
              }} {...invalidProps("owner")}>
                <option value="">All owners</option><option value="unassigned">Unassigned</option><option value="me">Me</option>
                {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>)}
              </select>
              {fieldError("owner")}
            </div>
          </div>
        </div>

        <div className="row g-3 mt-1">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="queue-sortBy">Sort by</label>
            <select id="queue-sortBy" className="form-select" value={query.sortBy} onChange={e => change({ sortBy: e.target.value as StaffQueueSort })} {...invalidProps("sortBy")}>
              {Object.entries(SORTS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
            {fieldError("sortBy")}
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="queue-sortDir">Sort direction</label>
            <select id="queue-sortDir" className="form-select" value={query.sortDir} onChange={e => change({ sortDir: e.target.value as "asc" | "desc" })} {...invalidProps("sortDir")}><option value="desc">Descending</option><option value="asc">Ascending</option></select>
            {fieldError("sortDir")}
          </div>
        </div>
      </section>

      {loading && <p role="status">Loading tickets…</p>}
      {Boolean(error) && <div role="alert" className="p-3 mb-3" style={panelStyle}>
        <p>{errorMessage}</p>
        {fieldError("page")}
        <button type="button" className="btn btn-outline-secondary" onClick={() => setRetry(n => n + 1)}>Retry</button>
      </div>}

      {!loading && !error && data && <>
        {data.items.length === 0 ? <p className="p-4 text-center" style={panelStyle}>
          {data.totalItems > 0 ? "No tickets on this page. Use Previous to return." : hasFilters ? "No tickets match your search or filters." : "No tickets in the queue."}
        </p> : <>
          <div className="d-none d-lg-block" style={panelStyle}>
            <table className="table align-middle mb-0" aria-label="Ticket Queue" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead><tr>
                <th scope="col" style={{ width: "14%" }}>Ticket Number</th>
                <th scope="col" style={{ width: "18%" }}>Requester</th>
                <th scope="col" style={{ width: "12%" }}>Updated</th>
                <th scope="col" style={{ width: "18%" }}>Summary</th>
                <th scope="col" style={{ width: "10%" }}>Requested Priority</th>
                <th scope="col" style={{ width: "8%" }}>IT Priority</th>
                <th scope="col" style={{ width: "12%" }}>Status</th>
                <th scope="col" style={{ width: "8%" }}>Owner</th>
              </tr></thead>
              <tbody>{data.items.map(ticket => <tr
                key={ticket.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ticket ${ticket.ticketNumber}`}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/staff/tickets/${ticket.id}`)}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/staff/tickets/${ticket.id}`);
                  }
                }}
              >
                <td className="fw-semibold">{ticket.ticketNumber}</td>
                <td><div>{ticket.requester.name}</div><div className="small text-muted"><RequesterEmail email={ticket.requester.email} /></div></td>
                <td className="small"><Updated date={ticket.updatedAt} /></td>
                <td>{ticket.summary}<div className="small text-muted">{ticket.category.name}</div></td>
                <td><PriorityBadge priority={ticket.requestedPriority} /></td>
                <td><PriorityBadge priority={ticket.itPriority} /></td>
                <td><Status status={ticket.status} /></td><td>{ticket.owner?.name ?? "Unassigned"}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <ul
  className="list-unstyled d-lg-none mb-0"
  aria-label="Ticket Queue cards"
>
  {data.items.map((ticket) => (
    <li key={ticket.id} className="mb-3">
      <div
        className="d-block p-3"
        role="link"
        tabIndex={0}
        aria-label={`Open ticket ${ticket.ticketNumber}`}
        style={{
          ...panelStyle,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          minWidth: 0,
          cursor: "pointer",
        }}
        onClick={() => navigate(`/staff/tickets/${ticket.id}`)}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            navigate(`/staff/tickets/${ticket.id}`);
          }
        }}
      >
        <div className="row g-3">
          <div className="col-12">
            <div
              className="small text-muted mb-1"
              style={{ fontWeight: 600 }}
            >
              Ticket Number
            </div>
            <div style={{ fontWeight: 600 }}>
              {ticket.ticketNumber}
            </div>
          </div>

          <div className="col-12">
            <div
              className="small text-muted mb-1"
              style={{ fontWeight: 600 }}
            >
              Summary
            </div>
            <div>{ticket.summary}</div>
          </div>

          <div className="col-12">
            <div
              className="small text-muted mb-1"
              style={{ fontWeight: 600 }}
            >
              Category
            </div>
            <div>{ticket.category.name}</div>
          </div>

          <div className="col-12">
            <div
              className="small text-muted mb-1"
              style={{ fontWeight: 600 }}
            >
              Requester
            </div>
            <div>{ticket.requester.name}</div>
            <div className="small text-muted">
              <RequesterEmail email={ticket.requester.email} />
            </div>
          </div>

          <div className="col-6">
            <div
              className="small text-muted mb-1"
              style={{ fontWeight: 600 }}
            >
              Requested Priority
            </div>
            <PriorityBadge priority={ticket.requestedPriority} />
          </div>

          <div className="col-6">
            <div
              className="small text-muted mb-1"
              style={{ fontWeight: 600 }}
            >
              IT Priority
            </div>
            <PriorityBadge priority={ticket.itPriority} />
          </div>

          <div className="col-6">
            <div
              className="small text-muted mb-1"
              style={{ fontWeight: 600 }}
            >
              Status
            </div>
            <Status status={ticket.status} />
          </div>

          <div className="col-6">
            <div
              className="small text-muted mb-1"
              style={{ fontWeight: 600 }}
            >
              Owner
            </div>
            <div>{ticket.owner?.name ?? "Unassigned"}</div>
          </div>

          <div className="col-12">
            <div
              className="small text-muted mb-1"
              style={{ fontWeight: 600 }}
            >
              Last Updated
            </div>
            <div>
              <Updated date={ticket.updatedAt} />
            </div>
          </div>

        </div>
      </div>
    </li>
  ))}
</ul>
        </>}
      </>}
      <nav
  aria-label="Queue pagination"
  className="mt-3"
>
  <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
    <label
      className="form-label mb-0 small"
      htmlFor="queue-pageSize"
    >
      Tickets per page
    </label>

    <select
      id="queue-pageSize"
      className="form-select form-select-sm w-auto"
      value={query.pageSize}
      onChange={(e) =>
        change({
          pageSize: Number(e.target.value) as 10 | 20 | 50,
        })
      }
      {...invalidProps("pageSize")}
    >
      {[10, 20, 50].map((size) => (
        <option key={size} value={size}>
          {size}
        </option>
      ))}
    </select>

    {fieldError("pageSize")}
  </div>

  <div className="d-flex w-100 justify-content-between align-items-center flex-wrap gap-2">
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      disabled={
        loading ||
        Boolean(error) ||
        !data ||
        (query.page ?? 1) <= 1
      }
      onClick={() =>
        setQuery((current) => ({
          ...current,
          page: (current.page ?? 1) - 1,
        }))
      }
    >
      Previous
    </button>

    <span
      className="small text-muted text-center"
      aria-live="polite"
    >
      Page {data?.page ?? query.page} of {data?.totalPages ?? 1}
    </span>

    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      disabled={
        loading ||
        Boolean(error) ||
        !data ||
        (query.page ?? 1) >= data.totalPages
      }
      onClick={() =>
        setQuery((current) => ({
          ...current,
          page: (current.page ?? 1) + 1,
        }))
      }
    >
      Next
    </button>
  </div>
</nav>
    </div>
  );
}
