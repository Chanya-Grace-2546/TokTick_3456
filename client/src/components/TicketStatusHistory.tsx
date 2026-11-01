import { useEffect, useId, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ActionRequestError, fetchTicketStatusHistory, type TicketStatusEvent } from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { zenGreen } from "../theme.js";
import "./ticketStatusHistory.css";
const label = (status: string) => status === "WAITING_FOR_REQUESTER" ? "Waiting for Requester" : status === "IT_STAFF" ? "IT Staff" : status.toLowerCase().split("_").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
export default function TicketStatusHistory({ ticketId, refreshKey = 0 }: { ticketId: number; refreshKey?: number }) {
  const [items, setItems] = useState<TicketStatusEvent[]>([]), [state, setState] = useState("loading"), [retry, setRetry] = useState(0);
  const { refreshUser } = useAuth(); const navigate = useNavigate(); const heading = useId();
  useEffect(() => {
    let cancelled = false; setItems([]); setState("loading");
    void fetchTicketStatusHistory(ticketId).then(result => { if (!cancelled) { setItems(result.items); setState("ready"); } }).catch(async error => {
      if (cancelled) return;
      setItems([]); setState("error");
      if (error instanceof ActionRequestError) {
        if (error.status === 401 || error.code === "PASSWORD_CHANGE_REQUIRED") {
          await refreshUser(); if (!cancelled) navigate(error.status === 401 ? "/login" : "/change-password", { replace: true });
        } else if (error.status === 403 || error.status === 404) setState("unavailable");
      }
    });
    return () => { cancelled = true; };
  }, [ticketId, refreshKey, retry]);
  return <section className="ticket-status-history card p-3 mt-4" aria-labelledby={heading} style={{ "--history-green": zenGreen.primary, color: zenGreen.text } as CSSProperties}>
    <h2 id={heading}>Ticket Status History</h2>
    {state === "loading" && <p role="status">Loading Ticket status history…</p>}
    {state === "error" && <div role="alert">Could not load Ticket status history. <button type="button" className="btn btn-outline-success btn-sm" onClick={() => setRetry(value => value + 1)}>Retry history</button></div>}
    {state === "unavailable" && <p role="alert">Ticket status history is not available for this Ticket.</p>}
    {state === "ready" && (!items.length ? <p>No recorded status transitions.</p> : <ol aria-label="Ticket status transitions, newest first">{items.map(event => <li key={event.id}>
      <p className="history-transition">{label(event.oldStatus)} <span aria-label="to">→</span> {label(event.newStatus)}</p>
      <p>{event.actor.name} <span className="text-muted">({label(event.actor.role)})</span></p>
      <time dateTime={event.occurredAt} title={event.occurredAt}>{new Date(event.occurredAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} (Asia/Bangkok)</time>
    </li>)}</ol>)}
  </section>;
}
