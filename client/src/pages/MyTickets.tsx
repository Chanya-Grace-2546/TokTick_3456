import { useAuth } from "../context/AuthContext.js";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { fetchTickets, TicketListItem, TicketListParams, RequesterApiError, Priority } from "../api.js";
import { ticketTableHeaderStyle, zenGreen } from "../theme.js";

const statusLabels: Record<string, string> = {
  NEW: "New", OPEN: "Open", IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester", RESOLVED: "Resolved",
  CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled",
};

type ScreenState = "loading" | "error" | "ready" | "forbidden";
type SortField = "ticketNumber" | "createdAt" | "updatedAt";

const cardStyle: React.CSSProperties = {
  backgroundColor: "white",
  border: "1px solid #E0E5E2",
  borderRadius: 8,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: zenGreen.success,
  MEDIUM: zenGreen.warningBackground,
  HIGH: zenGreen.error,
};

const SORT_LABELS: Record<SortField, string> = {
  ticketNumber: "Ticket No.",
  createdAt: "Created Date",
  updatedAt: "Last Updated",
};

// Lab 2 Issue 5 — My Tickets
// Reused this file from Issue 2's placeholder rather than creating a new
// one, since it already owns the /tickets route.
// Lab 3 — Requester identity now comes from the authenticated Session.
export default function TicketsPlaceholder() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#ticket-search") document.getElementById("ticket-search")?.focus();
  }, [location.hash]);
  const sortTrigger = useRef<HTMLButtonElement>(null);
  const sortId = useId();
  const sortFocus = useRef<SortField>();
  const headerButtons = useRef<Partial<Record<SortField, HTMLButtonElement | null>>>({});
  const closeSort = () => { setSortMenuOpen(false); sortTrigger.current?.focus(); };

  const [state, setState] = useState<ScreenState>("loading");
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const { refreshUser } = useAuth();
  const [params,setParams] = useSearchParams();
  const [sortMenuOpen,setSortMenuOpen] = useState(false),[retry,setRetry] = useState(0);
  const query = useMemo(()=>{
    const values:Record<string,unknown>=Object.create(null);
    for(const [key,value] of params) values[key]=key==="category"?Number(value):value;
    const page=Number(params.get("page")),size=Number(params.get("pageSize"));
    values.page=Number.isInteger(page)&&page>0?page:1;
    if(params.has("pageSize"))values.pageSize=Number.isInteger(size)&&size>0?Math.min(size,50):10;
    values.sortBy=["ticketNumber","createdAt","updatedAt"].includes(params.get("sortBy")??"")?params.get("sortBy"):"createdAt";
    values.sortDir=params.get("sortDir")==="asc"?"asc":"desc";
    return values as TicketListParams;
  },[params]);
  const search=query.search??"",requestedPriority=query.requestedPriority??"",currentStatus=query.status??query.currentStatus??"";
  const sortBy=query.sortBy as SortField,sortDir=query.sortDir!,page=query.page!;
  const hasActiveFilters=Object.entries(query).some(([key,value])=>!["page","pageSize","sortBy","sortDir","requesterId"].includes(key)&&value!==undefined&&value!=="");
  function change(values:Record<string,string|number|undefined>,resetPage=true){
    const next=new URLSearchParams(params);
    for(const [key,value] of Object.entries(values)){if(value===undefined||value==="")next.delete(key);else next.set(key,String(value));}
    if(resetPage)next.set("page","1");setParams(next);
  }
  useEffect(()=>{
    let cancelled=false;setState("loading");setItems([]);
    const duplicate=Array.from(params.keys()).some(key=>key!=="requesterId"&&params.getAll(key).length>1);
    const request=duplicate?Promise.reject(new RequesterApiError(400,"INVALID_QUERY")):fetchTickets(query);
    void request.then(res=>{if(cancelled)return;setItems(res.items);setTotalPages(res.totalPages);setTotalItems(res.totalItems);setState("ready");}).catch(async error=>{
      if(cancelled)return;
      if(error instanceof RequesterApiError&&(error.status===401||error.code==="PASSWORD_CHANGE_REQUIRED")){
        await refreshUser();if(!cancelled)navigate(error.status===401?"/login":"/change-password",{replace:true});
      }else if(error instanceof RequesterApiError&&error.status===403)setState("forbidden");else setState("error");
    });return()=>{cancelled=true;};
  },[query,retry]);
  useEffect(() => {
    if (state !== "ready" || !sortFocus.current) return;
    if (document.activeElement === document.body) headerButtons.current[sortFocus.current]?.focus();
    sortFocus.current = undefined;
  }, [state]);
  function toggleSort(field:SortField, fromHeader = false){if (fromHeader) sortFocus.current = field; change({sortBy:field,sortDir:sortBy===field&&sortDir==="desc"?"asc":"desc"});}
  function clearFilters(){const next=new URLSearchParams({sortBy,sortDir,page:"1"});if(query.pageSize)next.set("pageSize",String(query.pageSize));setParams(next);}

  return (
    <div className="container py-5" style={{ maxWidth: 1320 }}>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="h4 mb-0" style={{ color: zenGreen.text }}>
          My Tickets
        </h1>

        <div className="d-flex gap-2 flex-wrap">
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
              id="ticket-search"
              type="text"
              className="form-control"
              placeholder="Search by ticket number or summary…"
              value={search}
              onChange={(e) => {
                change({search:e.target.value});
              }}
              aria-label="Search tickets"
            />
          </div>

          <div className="col-12 col-md-3">
            <select
              className="form-select"
              value={requestedPriority}
              onChange={(e) => {
                change({requestedPriority:e.target.value});
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
                change({currentStatus:e.target.value,status:undefined});
              }}
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_REQUESTER">Waiting for Requester</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="REOPENED">Reopened</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="position-relative" onKeyDown={event => { if (event.key === "Escape" && sortMenuOpen) { event.preventDefault(); closeSort(); } }}>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setSortMenuOpen((v) => !v)}
            ref={sortTrigger}
            aria-controls={sortId}
            aria-expanded={sortMenuOpen}
          >
            Sort: {SORT_LABELS[sortBy]} ({sortDir === "asc" ? "▲" : "▼"})
          </button>

          {sortMenuOpen && (
            <div
              id={sortId}
              role="group" aria-label="Ticket sorting"
              className="position-absolute start-0 mt-1 bg-white shadow rounded"
              style={{ minWidth: 220, zIndex: 10 }}
            >
              {(Object.keys(SORT_LABELS) as SortField[]).map((field) => (
                <button
                  key={field}
                  type="button"
                  className="btn btn-sm w-100 text-start d-flex justify-content-between"
                  style={
                    sortBy === field
                      ? { backgroundColor: zenGreen.pale }
                      : undefined
                  }
                  onClick={() => {
                    toggleSort(field);
                    closeSort();
                  }}
                >
                  <span>{SORT_LABELS[field]}</span>
                  {sortBy === field && (
                    <span>{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {query.statusGroup && <p role="status">Dashboard filter: Open Tickets</p>}
      {state === "forbidden" && <p role="alert">You do not have permission to view these Tickets.</p>}
      {state === "loading" && <p role="status">Loading tickets…</p>}

      {state === "error" && (
        <p role="alert" className="text-danger">
          Couldn't load your tickets. Please try again. <button type="button" className="btn btn-sm btn-outline-success" onClick={()=>setRetry(value=>value+1)}>Retry Tickets</button>
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

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>
      )}

      {state === "ready" && totalItems > 0 && items.length === 0 && <p role="status">No Tickets on this page. <button type="button" className="btn btn-sm btn-outline-success" onClick={()=>change({page:1},false)}>Return to first page</button></p>}

      {state === "ready" && items.length > 0 && (
        <>
          <div
            className="table-responsive requester-ticket-scroll d-none d-lg-block"
            role="region" aria-label="My Tickets table" tabIndex={0}
            style={{ ...cardStyle, borderRadius: 10 }}
          >
            <table className="table mb-0 requester-ticket-table">
              <thead>
                <tr>
                  <th scope="col" style={ticketTableHeaderStyle} aria-sort={sortBy === "ticketNumber" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" className="ticket-sort-button" ref={node => { headerButtons.current.ticketNumber = node; }} onClick={() => toggleSort("ticketNumber", true)}>
                      Ticket No. {sortBy === "ticketNumber" && (sortDir === "asc" ? "▲" : "▼")}
                    </button>
                  </th>

                  <th scope="col" style={ticketTableHeaderStyle}>Summary</th>
                  <th scope="col" style={ticketTableHeaderStyle}>Category</th>
                  <th scope="col" style={ticketTableHeaderStyle}>Priority</th>
                  <th scope="col" style={ticketTableHeaderStyle}>Status</th>

                  <th scope="col" style={ticketTableHeaderStyle} aria-sort={sortBy === "createdAt" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" className="ticket-sort-button" ref={node => { headerButtons.current.createdAt = node; }} onClick={() => toggleSort("createdAt", true)}>
                      Created Date {sortBy === "createdAt" && (sortDir === "asc" ? "▲" : "▼")}
                    </button>
                  </th>

                  <th scope="col" style={ticketTableHeaderStyle} aria-sort={sortBy === "updatedAt" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" className="ticket-sort-button" ref={node => { headerButtons.current.updatedAt = node; }} onClick={() => toggleSort("updatedAt", true)}>
                      Last Updated {sortBy === "updatedAt" && (sortDir === "asc" ? "▲" : "▼")}
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((t) => (
                  <tr
                    key={t.id}
                    style={{ cursor: "pointer" }}
                    onClick={event => { if (!(event.target as HTMLElement).closest("a")) navigate(`/tickets/${t.id}`); }}
                  >
                    <td><Link to={`/tickets/${t.id}`} aria-label={`Open ticket ${t.ticketNumber}`}>{t.ticketNumber}</Link></td>
                    <td>{t.summary}</td>
                    <td>{t.category}</td>

                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            PRIORITY_BADGE[t.requestedPriority],
                          color: t.requestedPriority === "MEDIUM" ? zenGreen.text : "white",
                        }}
                      >
                        {t.requestedPriority}
                      </span>
                    </td>

                    <td>{statusLabels[t.currentStatus] ?? t.currentStatus}</td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td>{new Date(t.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul
            className="list-unstyled d-lg-none mb-0"
            aria-label="My Tickets cards"
          >
            {items.map((t) => (
              <li key={t.id} className="mb-3">
                <Link
                  to={`/tickets/${t.id}`}
                  aria-label={`View ticket ${t.ticketNumber}`}
                  className="d-block text-decoration-none text-reset p-3"
                  style={{
                    ...cardStyle,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    minWidth: 0,
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
                      <div className="ticket-link-label" style={{ fontWeight: 600 }}>
                        {t.ticketNumber}
                      </div>
                    </div>

                    <div className="col-12">
                      <div
                        className="small text-muted mb-1"
                        style={{ fontWeight: 600 }}
                      >
                        Summary
                      </div>
                      <div>{t.summary}</div>
                    </div>

                    <div className="col-12">
                      <div
                        className="small text-muted mb-1"
                        style={{ fontWeight: 600 }}
                      >
                        Category
                      </div>
                      <div>{t.category}</div>
                    </div>

                    <div className="col-6">
                      <div
                        className="small text-muted mb-1"
                        style={{ fontWeight: 600 }}
                      >
                        Requested Priority
                      </div>
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            PRIORITY_BADGE[t.requestedPriority],
                          color: t.requestedPriority === "MEDIUM" ? zenGreen.text : "white",
                        }}
                      >
                        {t.requestedPriority}
                      </span>
                    </div>

                    <div className="col-6">
                      <div
                        className="small text-muted mb-1"
                        style={{ fontWeight: 600 }}
                      >
                        Status
                      </div>
                      <div>{statusLabels[t.currentStatus] ?? t.currentStatus}</div>
                    </div>

                    <div className="col-6">
                      <div
                        className="small text-muted mb-1"
                        style={{ fontWeight: 600 }}
                      >
                        Created Date
                      </div>
                      <div>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="col-6">
                      <div
                        className="small text-muted mb-1"
                        style={{ fontWeight: 600 }}
                      >
                        Last Updated
                      </div>
                      <div>
                        {new Date(t.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center gap-2 mt-3">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page <= 1}
                onClick={() => change({page:page-1},false)}
              >
                Previous
              </button>

              <span className="small text-muted text-center">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page >= totalPages}
                onClick={() => change({page:page+1},false)}
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