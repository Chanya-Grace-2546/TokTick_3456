import "./staffDashboard.css";
import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchStaffDashboard, StaffDashboardData, StaffQueueError } from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { zenGreen } from "../theme.js";
const labels = { unassignedTickets: "Unassigned Tickets", myOwnedTickets: "My Owned Tickets", ticketsWithMyActions: "Tickets with My Actions", urgentOpenTickets: "Urgent Open Tickets" };
const label = (value: string) => value === "WAITING_FOR_REQUESTER" ? "Waiting for Requester" : value.toLowerCase().split("_").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
const time = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" });
export default function StaffDashboard() {
  const [data, setData] = useState<StaffDashboardData>(), [error, setError] = useState(false), [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const { refreshUser } = useAuth(), navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setForbidden(false); setData(undefined);
    void fetchStaffDashboard().then(result => { if (!cancelled) setData(result); }).catch(async failure => {
      if (cancelled) return;
      if (failure instanceof StaffQueueError && (failure.status === 401 || failure.code === "PASSWORD_CHANGE_REQUIRED")) {
        await refreshUser(); if (!cancelled) navigate(failure.status === 401 ? "/login" : "/change-password", { replace: true });
      } else if (failure instanceof StaffQueueError && failure.status === 403) setForbidden(true);
      else setError(true);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);
  const statusTotal = data ? Object.values(data.byStatus).reduce((sum, count) => sum + count, 0) : 0;
  const priorityTotal = data ? data.byPriority.reduce((sum, row) => sum + row.count, 0) : 0;
  const icons = { unassignedTickets: "inbox", myOwnedTickets: "person", ticketsWithMyActions: "check", urgentOpenTickets: "urgent" } as const;
  return <div className="staff-dashboard container py-4" style={{
    "--dashboard-green": zenGreen.primary, "--dashboard-secondary": zenGreen.secondary,
    "--dashboard-pale": zenGreen.pale, "--dashboard-muted": zenGreen.readOnlyBg,
    "--dashboard-warning": zenGreen.warning, "--dashboard-error": zenGreen.error,
    color: zenGreen.text,
  } as CSSProperties}>
    <header className="dashboard-header">
      <div><p className="dashboard-eyebrow">SERVICE DESK OVERVIEW</p><h1>IT Staff Dashboard</h1><p className="dashboard-subtitle">A clear view of your queue, assigned work, and recent activity.</p></div>
      <button className="btn dashboard-refresh" disabled={loading} onClick={() => setRevision(n => n + 1)}><DashboardIcon name="refresh"/>Refresh Dashboard</button>
    </header>
    <div className="dashboard-toolbar">
      <nav aria-label="Dashboard quick actions"><Link to="/staff/tickets">Ticket Queue <span aria-hidden="true">↗</span></Link><Link to="/staff/tickets?owner=me&statusGroup=open">My Assigned Tickets <span aria-hidden="true">↗</span></Link></nav>
      {data && <p className="dashboard-updated" role="status">Last updated: <time dateTime={data.asOf}>{time(data.asOf)}</time> <span>(Asia/Bangkok)</span></p>}
    </div>
    {loading && <p role="status" className="dashboard-feedback">Loading dashboard…</p>}
    {forbidden && <p role="alert" className="dashboard-feedback">You do not have permission to view this dashboard.</p>}
    {error && <div role="alert" className="dashboard-feedback">Could not load the dashboard. <button className="btn btn-outline-success btn-sm" onClick={() => setRevision(n => n + 1)}>Retry Dashboard</button></div>}
    {data && <>
      <div className="dashboard-kpis">{(Object.keys(labels) as (keyof typeof labels)[]).map(key => <Link key={key} to={data.drillDown[key]} aria-label={`${labels[key]}: ${data.metrics[key]}`} className={`dashboard-kpi${key === "urgentOpenTickets" ? " dashboard-kpi-urgent" : ""}`}>
        <div className="dashboard-kpi-top"><span className="dashboard-kpi-icon"><DashboardIcon name={icons[key]}/></span><span className="dashboard-kpi-arrow" aria-hidden="true">↗</span></div>
        <strong>{data.metrics[key]}</strong><span className="dashboard-kpi-label">{labels[key]}</span>
      </Link>)}</div>
      <div className="dashboard-breakdowns">
        <section className="dashboard-panel" aria-labelledby="dashboard-status"><div className="dashboard-panel-heading"><div><h2 id="dashboard-status">Tickets by Status</h2><p>Across the full support queue</p></div><span className="dashboard-panel-icon"><DashboardIcon name="status"/></span></div>
          <ul className="dashboard-bars dashboard-status-bars">{Object.entries(data.byStatus).map(([status, count]) => <li key={status}><Link to={`/staff/tickets?status=${status}`} aria-label={`${label(status)}: ${count} Tickets`}><div className="dashboard-bar-label"><span>{label(status)}</span><strong>{count}</strong></div><TicketBar name={label(status)} count={count} total={statusTotal}/></Link></li>)}</ul>
        </section>
        <section className="dashboard-panel dashboard-priority-panel" aria-labelledby="dashboard-priority"><div className="dashboard-panel-heading"><div><h2 id="dashboard-priority">Tickets by IT Priority</h2><p>Priority distribution across all Tickets</p></div><span className="dashboard-panel-icon"><DashboardIcon name="priority"/></span></div>
          <ul className="dashboard-bars dashboard-priority-bars">{data.byPriority.map(({ priority, count }) => <li key={priority} className={`dashboard-priority-${priority.toLowerCase()}`}><Link to={`/staff/tickets?itPriority=${priority}`} aria-label={`${label(priority)}: ${count} Tickets`}><div className="dashboard-bar-label"><span className="dashboard-priority-label"><span className="dashboard-priority-dot" aria-hidden="true"/>{label(priority)}</span><strong>{count}</strong></div><TicketBar name={`${label(priority)} priority`} count={count} total={priorityTotal}/></Link></li>)}</ul>
          <p className="dashboard-panel-note">IT Priority is set by the support team. Select a priority to explore its Tickets.</p>
        </section>
      </div>
      <section className="dashboard-panel dashboard-recent" aria-labelledby="dashboard-recent"><div className="dashboard-panel-heading"><div><h2 id="dashboard-recent">Recent Tickets</h2><p>Updated in the last 7 days · up to 5 Tickets</p></div><span className="dashboard-panel-icon"><DashboardIcon name="clock"/></span></div>
        {!data.recentTickets.length ? <p className="dashboard-empty">No recent tickets</p> : <ul className="dashboard-recent-list">{data.recentTickets.map(ticket => <li key={ticket.id}><Link to={ticket.href} className="dashboard-ticket" aria-label={`${ticket.ticketNumber} — ${ticket.summary}`}>
          <span className="dashboard-ticket-icon"><DashboardIcon name="ticket"/></span>
          <span className="dashboard-ticket-main"><span className="dashboard-ticket-number">{ticket.ticketNumber}</span><span className="dashboard-ticket-summary" title={ticket.summary}>{ticket.summary}</span></span>
          <span className={`dashboard-ticket-status dashboard-ticket-status-${ticket.status.toLowerCase()}`}>{label(ticket.status)}</span>
          <span className="dashboard-ticket-time"><time dateTime={ticket.updatedAt}>{time(ticket.updatedAt)}</time><span>Asia/Bangkok</span></span><span className="dashboard-ticket-arrow" aria-hidden="true">↗</span>
        </Link></li>)}</ul>}
      </section>
    </>}
  </div>;
}

function TicketBar({ name, count, total }: { name: string; count: number; total: number }) {
  const percent = total > 0 ? count / total * 100 : 0;
  return <span className="dashboard-bar-track" role="progressbar" aria-label={`${name} proportion`} aria-valuemin={0} aria-valuemax={Math.max(total, 1)} aria-valuenow={count} aria-valuetext={`${count} of ${total} Tickets (${Math.round(percent)}%)`}><span className="dashboard-bar-fill" style={{ width: `${percent}%` }}/></span>;
}

function DashboardIcon({ name }: { name: "inbox" | "person" | "check" | "urgent" | "refresh" | "status" | "priority" | "clock" | "ticket" }) {
  const paths = {
    inbox: <><path d="M4 4h16v15H4z"/><path d="M4 13h5l1 3h4l1-3h5"/></>,
    person: <><circle cx="12" cy="8" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/></>,
    check: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 3 3 5-6"/></>,
    urgent: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
    status: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/></>,
    priority: <><path d="M5 20V10m7 10V4m7 16V7"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    ticket: <><path d="M4 4h16v6a2 2 0 0 0 0 4v6H4v-6a2 2 0 0 0 0-4V4Z"/><path d="M9 8h6m-6 4h6m-6 4h3"/></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
