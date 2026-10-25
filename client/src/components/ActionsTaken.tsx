import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ActionPage, ActionRequestError, ActionTaken, fetchActions, StaffOwner } from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { actionLabels, terminalAction, ticketActionsReadOnly } from "../actionTakenUi.js";
import { zenGreen } from "../theme.js";
import FollowUpResolutionForm from "./FollowUpResolutionForm.js";
import ActionTakenForm from "./ActionTakenForm.js";
import "./actionsTaken.css";
interface Props { ticketStatus?: string; refreshKey?: number; ticketId: number; canWrite?: boolean; owners?: StaffOwner[]; onRefresh?: () => Promise<void>; onRefreshOwners?: () => void }
function timestamp(value: string) { return <time dateTime={value} title={new Date(value).toString()}>{new Date(value).toLocaleString()}</time>; }

function ActionCard({ action, canEdit, editing, onEdit, onSatisfy }: { action: ActionTaken; canEdit: boolean; editing: boolean; onEdit: (button: HTMLButtonElement) => void; onSatisfy: (button: HTMLButtonElement) => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = `action-details-${action.ticketId}-${action.id}`;
  const ticketId = action.ticketId;
  return (
        <article className="action-card" aria-labelledby={`action-${ticketId}-${action.id}`}>
          <header className="action-card-heading"><h3 id={`action-${ticketId}-${action.id}`}>Action #{action.id}</h3><span className="badge action-state">{actionLabels[action.state]}</span></header>
          <p className="action-description">{action.description}</p>
          <dl className="action-meta"><div><dt>Performed By</dt><dd>{action.performedBy.name}</dd></div><div><dt>Assigned To</dt><dd>{action.assignedTo?.name ?? "Unassigned"}</dd></div><div><dt>Action Date/Time</dt><dd>{timestamp(action.actionAt)}</dd></div></dl>
          <div className="action-outcomes"><div className="action-result"><h4>Result</h4><p className="action-content">{action.result || "No result recorded"}</p></div>
            <div className={`action-followup${action.followUpRequired && !action.followUpResolution ? " action-followup-required" : ""}`}><h4>Follow-Up <span className="action-follow-label">{action.followUpResolution ? "Satisfied" : action.followUpRequired ? "Required" : "Not required"}</span></h4>{(action.followUpRequired || action.followUpNote) && <p className="action-content">{action.followUpNote || "No follow-up note"}</p>}{action.followUpResolution && <div><p className="action-content">{action.followUpResolution.outcome}</p><small>Recorded by {action.followUpResolution.actor.name} · {timestamp(action.followUpResolution.occurredAt)}</small></div>}</div></div>
          <div className="action-controls"><button type="button" className="action-details-toggle" aria-expanded={detailsOpen} aria-controls={detailsId} aria-label={`View Details for Action ${action.id}`} onClick={() => setDetailsOpen(!detailsOpen)}>View Details</button>
          {canEdit && action.state === "COMPLETED" && action.followUpRequired && !action.followUpResolution && <button type="button" className="btn btn-outline-success btn-sm" disabled={editing} onClick={e => onSatisfy(e.currentTarget)}>Record Follow-Up Outcome</button>}
          {canEdit && !terminalAction(action.state) && <button type="button" className="btn btn-outline-success btn-sm action-edit" aria-label={`Edit Action ${action.id}`} disabled={editing} onClick={e => onEdit(e.currentTarget)}>Edit</button>}</div>
          <div id={detailsId} className="action-secondary" role="region" aria-label={`Action ${action.id} details`} hidden={!detailsOpen}><dl><dt>Created</dt><dd>{timestamp(action.createdAt)}</dd><dt>Last updated</dt><dd>{timestamp(action.updatedAt)}</dd>{action.attachmentNotes && <><dt>Attachment Notes</dt><dd className="action-content">{action.attachmentNotes}</dd></>}</dl></div>
        </article>
  );
}
export default function ActionsTaken({ ticketId, canWrite = false, owners = [], onRefresh, onRefreshOwners, ticketStatus, refreshKey = 0 }: Props) {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1), [data, setData] = useState<ActionPage>();
  const [state, setState] = useState("loading"), [message, setMessage] = useState("");
  const [followUp, setFollowUp] = useState<ActionTaken>();
  const [serverReadOnly, setServerReadOnly] = useState(false);
  const [form, setForm] = useState<ActionTaken | "create">();
  const trigger = useRef<HTMLButtonElement | null>(null), generation = useRef(0);
  const writable = canWrite && (user?.role === "IT_STAFF" || user?.role === "ADMINISTRATOR");
  const readOnly = serverReadOnly || ticketActionsReadOnly(ticketStatus);
  async function failure(error: unknown) {
    if (error instanceof ActionRequestError && error.code === "TICKET_ACTIONS_READ_ONLY") {
      setServerReadOnly(true); void onRefresh?.().catch(() => {});
    }
    if (error instanceof ActionRequestError && (error.status === 401 || error.status === 403 || error.status === 404)) {
      setData(undefined); setForm(undefined); setFollowUp(undefined);
      setState(error.status === 404 ? "not-found" : "forbidden");
      if (error.status === 401 || error.code === "PASSWORD_CHANGE_REQUIRED") {
        await refreshUser(); navigate(error.status === 401 ? "/login" : "/change-password", { replace: true });
      }
    }
  }
  async function load() {
    const current = ++generation.current;
    try {
      const result = await fetchActions(ticketId, page);
      if (generation.current === current) { setData(result); setState("ready"); }
      return result;
    } catch (error) {
      if (generation.current === current) { setState("error"); await failure(error); }
      throw error;
    }
  }
  useEffect(() => {
    setState("loading"); setData(undefined); setForm(undefined); setFollowUp(undefined); setMessage("");
    void load().catch(() => {});
    return () => { generation.current++; };
  }, [ticketId, page]);
  useEffect(() => { setServerReadOnly(false); }, [ticketId]);
  useEffect(() => { if (refreshKey) void load().catch(() => {}); }, [refreshKey]);
  useEffect(() => { if (!ticketActionsReadOnly(ticketStatus)) setServerReadOnly(false); }, [ticketStatus]);
  useEffect(() => { if (!form && !followUp) trigger.current?.focus(); }, [form, followUp]);
  function close() { setForm(undefined); setFollowUp(undefined); }
  async function saved() {
    close(); setMessage("Action saved.");
    try { await load(); } catch { setMessage("Action saved, but the list could not refresh. Retry loading; do not submit again."); }
    try { await onRefresh?.(); } catch { setMessage("Action saved, but the Ticket summary could not refresh. Reload the Ticket to see its latest values."); }
  }
  async function reloadAction(actionId: number) {
    const first = await load();
    const found = first.items.find(action => action.id === actionId);
    if (found) return found;
    for (let candidate = 1; candidate <= Math.ceil(first.total / first.pageSize); candidate++) {
      if (candidate === page) continue;
      const result = await fetchActions(ticketId, candidate);
      const match = result.items.find(action => action.id === actionId);
      if (match) return match;
    }
    return undefined;
  }
  const addButton = writable && !readOnly && state === "ready" && <button className="btn btn-success btn-sm actions-add" disabled={!!form || !!followUp} onClick={e => { trigger.current = e.currentTarget; setForm("create"); }}>Add Action</button>;
  return <section className="actions-taken card p-3 mt-4" aria-labelledby={`actions-${ticketId}`}
    style={{ "--action-green": zenGreen.primary, "--action-pale": zenGreen.pale, "--action-text": zenGreen.text, "--action-info": zenGreen.readOnlyBg, "--action-neutral": zenGreen.background } as CSSProperties}>
    <div className="actions-heading"><h2 id={`actions-${ticketId}`}>Actions Taken</h2>{addButton}</div>
    {readOnly && <p role="status">Actions on this Ticket are read-only. Reopen a Resolved or Closed Ticket to record further work.</p>}
    {message && <p role="status">{message}</p>}
    {state === "loading" && <p role="status">Loading Actions Taken…</p>}
    {state === "error" && <div role="alert">Could not load Actions Taken. <button className="btn btn-outline-success" onClick={() => { setState("loading"); void load().catch(() => {}); }}>Retry Actions</button></div>}
    {state === "forbidden" && <p role="alert">You do not have permission to view these Actions.</p>}
    {state === "not-found" && <p role="alert">Ticket or Actions not found. Return to your permitted Ticket list.</p>}
    {state === "ready" && data && <>
      {!data.items.length ? <p>No actions recorded yet</p> : <ol className="action-list" aria-label="Actions Taken, oldest first">{data.items.map(action => <li key={action.id}>
        <ActionCard action={action} canEdit={writable && !readOnly} editing={!!form || !!followUp} onEdit={button => { trigger.current = button; setForm(action); }} onSatisfy={button => { trigger.current = button; setFollowUp(action); }} />
      </li>)}</ol>}
      <nav aria-label="Action pages" className="action-pagination"><button className="btn btn-outline-secondary btn-sm" disabled={page <= 1 || !!form || !!followUp} onClick={() => setPage(page - 1)}>Previous Actions</button><span aria-live="polite">Page {page} · {data.total} Actions</span><button className="btn btn-outline-secondary btn-sm" disabled={page * data.pageSize >= data.total || !!form || !!followUp} onClick={() => setPage(page + 1)}>Next Actions</button></nav>
    </>}
    {writable && followUp && <FollowUpResolutionForm key={followUp.id} action={followUp} onReload={() => reloadAction(followUp.id)} readOnly={readOnly} onCancel={close} onSuccess={() => void saved()} onFailure={error => void failure(error)} />}
    {writable && form && <ActionTakenForm key={form === "create" ? "create" : form.id} ticketId={ticketId} readOnly={readOnly} action={form === "create" ? undefined : form} owners={owners} performer={user?.name ?? "You"}
      onCancel={close} onSuccess={() => void saved()} onFailure={error => void failure(error)} refreshOwners={() => onRefreshOwners?.()}
      onReload={() => form === "create" ? Promise.resolve(undefined) : reloadAction(form.id)} />}
  </section>;
}
