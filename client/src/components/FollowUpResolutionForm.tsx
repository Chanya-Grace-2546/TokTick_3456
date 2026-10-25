import { useEffect, useId, useRef, useState } from "react";
import { ActionRequestError, ActionTaken, recordFollowUpResolution } from "../api.js";
export default function FollowUpResolutionForm({ action, readOnly, onSuccess, onFailure, onCancel, onReload }: {
  onReload?: () => Promise<ActionTaken | undefined>;
  action: ActionTaken; readOnly: boolean; onSuccess: () => void; onFailure: (error: unknown) => void; onCancel: () => void;
}) {
  const [outcome, setOutcome] = useState("");
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState<{ version: number; outcome: string }>();
  const [reviewed, setReviewed] = useState<ActionTaken>();
  const [conflict, setConflict] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);
  const busy = useRef(false), heading = useRef<HTMLHeadingElement>(null), id = useId();
  useEffect(() => { heading.current?.focus(); }, []);
  return <form className="action-form border rounded p-3 mt-3" aria-labelledby={`${id}-title`} onSubmit={async event => {
    event.preventDefault(); if (busy.current || readOnly || conflict || reviewed?.followUpResolution) return;
    if (!outcome.trim()) { setMessage("Record a nonblank follow-up outcome."); return; }
    busy.current = true; setPending(true); setMessage("");
    const body = ambiguous && attempt ? attempt : { version: action.version, outcome };
    setAttempt(body);
    try { await recordFollowUpResolution(action.ticketId, action.id, body); onSuccess(); }
    catch (error) {
      onFailure(error);
      if (error instanceof ActionRequestError && error.status === 409 && error.code !== "TICKET_ACTIONS_READ_ONLY") setConflict(true);
      if (!(error instanceof ActionRequestError) || error.status >= 500) setAmbiguous(true);
      setMessage(error instanceof ActionRequestError && error.code === "FOLLOW_UP_ALREADY_SATISFIED"
        ? "Follow-up was already satisfied. Your outcome is retained; reload and review the recorded outcome."
        : error instanceof ActionRequestError && error.code === "TICKET_ACTIONS_READ_ONLY" ? "This Ticket is read-only. Your outcome is retained."
        : "Could not record the outcome. Your values are retained; retry or reload and review the Action.");
    } finally { busy.current = false; setPending(false); }
  }}>
    <h3 ref={heading} tabIndex={-1} id={`${id}-title`}>Record Follow-Up Outcome for Action #{action.id}</h3>
    <p>The completed Action stays unchanged. This adds an audited follow-up satisfaction event.</p>
    {message && <p role="alert">{message}</p>}
    {onReload && <button type="button" className="btn btn-outline-success btn-sm mb-2" disabled={pending} onClick={async () => {
      if (busy.current) return;
      busy.current = true; setPending(true);
      try {
        const latest = await onReload(); setReviewed(latest);
        if (latest?.followUpResolution) {
          setAmbiguous(false); setConflict(true);
          setMessage("Authoritative outcome loaded. Your draft is retained; no request was resubmitted.");
        } else {
          setMessage("No recorded outcome was found. Your draft and original request identity are retained.");
        }
      } catch (error) { onFailure(error); setMessage("Could not reload the outcome. Your draft and request identity are retained."); }
      finally { busy.current = false; setPending(false); }
    }}>Reload and Review Follow-Up</button>}
    {reviewed?.followUpResolution && <div className="alert alert-info" role="region" aria-label="Recorded follow-up outcome">
      <strong>Recorded follow-up outcome</strong><p className="action-content">{reviewed.followUpResolution.outcome}</p>
      <p>Recorded by {reviewed.followUpResolution.actor.name} · <time dateTime={reviewed.followUpResolution.occurredAt}>{new Date(reviewed.followUpResolution.occurredAt).toLocaleString()}</time></p>
      <p>The completed Action and your draft remain unchanged.</p>
    </div>}
    <label htmlFor={`${id}-outcome`} className="form-label">Follow-Up Outcome (required)</label>
    <textarea id={`${id}-outcome`} className="form-control" value={outcome} disabled={pending || readOnly || ambiguous} required onChange={e => setOutcome(e.target.value)} />
    {ambiguous && <p>Retry uses the original outcome and version.</p>}
    <button className="btn btn-success btn-sm mt-3 me-2" disabled={pending || readOnly || conflict || !!reviewed?.followUpResolution}>{pending ? "Recording…" : "Record Outcome"}</button>
    <button type="button" className="btn btn-outline-secondary btn-sm mt-3" disabled={pending} onClick={onCancel}>Cancel</button>
  </form>;
}
