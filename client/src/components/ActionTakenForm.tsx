import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { ActionInput, ActionRequestError, ActionTaken, createAction, FieldErrors, StaffOwner, updateAction } from "../api.js";
import { actionDraft, ActionDraft, actionInput, actionPatch, actionLabels, actionStates, terminalAction, validateActionDraft } from "../actionTakenUi.js";
interface Props {
  ticketId: number; action?: ActionTaken; readOnly?: boolean; owners: StaffOwner[]; performer: string;
  onCancel: () => void; onSuccess: () => void; onFailure: (error: unknown) => void;
  onReload: () => Promise<ActionTaken | undefined>; refreshOwners: () => void;
}
export default function ActionTakenForm(props: Props) {
  const [draft, setDraft] = useState(() => actionDraft(props.action));
  const [base, setBase] = useState(props.action);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [fresh, setFresh] = useState<ActionTaken>();
  const [attempt, setAttempt] = useState<{ key: string; body: ActionInput }>();
  const [ambiguous, setAmbiguous] = useState(false);
  const [expired, setExpired] = useState(false);
  const busy = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const prefix = useId();
  useEffect(() => { heading.current?.focus(); }, []);
  const frozen = ambiguous || expired;
  const invalidState = !!base && !actionStates(base.state).includes(draft.state);
  const ineligible = !!draft.assignedToUserId && !props.owners.some(owner => String(owner.id) === draft.assignedToUserId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || conflict || expired || (props.readOnly && !ambiguous) || (base && terminalAction(base.state))) return;
    const fields = ambiguous ? {} : validateActionDraft(draft);
    if (invalidState) fields.state = "The saved state changed. Explicitly choose an allowed state before saving.";
    if (!ambiguous && ineligible) fields.assignedToUserId = "Choose an active assignee or Unassigned.";
    setErrors(fields);
    if (Object.keys(fields).length) { setMessage("Review the highlighted fields."); return; }
    busy.current = true; setPending(true); setMessage("");
    let submitted = attempt;
    try {
      if (base) await updateAction(props.ticketId, base.id, { ...actionPatch(draft, props.action!), version: base.version });
      else {
        submitted = ambiguous && attempt ? attempt : { key: crypto.randomUUID(), body: actionInput(draft) };
        setAttempt(submitted);
        await createAction(props.ticketId, submitted.body, submitted.key);
      }
      props.onSuccess();
    } catch (error) {
      props.onFailure(error);
      if (error instanceof ActionRequestError && error.status === 422) {
        setErrors(error.fields); setAmbiguous(false); setMessage("Review the highlighted fields.");
        if (error.code === "INACTIVE_ASSIGNEE") props.refreshOwners();
      } else if (error instanceof ActionRequestError && error.status === 409) {
        if (error.code === "TICKET_ACTIONS_READ_ONLY") { setMessage("This Ticket is read-only. Reopen a Resolved or Closed Ticket before changing Actions. Your draft is retained."); }
        else if (base) { setConflict(true); setMessage("This Action changed. Your draft is retained. Reload and review before saving."); }
        else { setExpired(true); setMessage(error.code === "IDEMPOTENCY_KEY_EXPIRED" ? "This request key expired. Check the Action list before starting a new request; the earlier outcome is uncertain." : "This request key conflicts with an earlier request. Check the Action list before starting again."); }
      } else {
        if (!base && submitted && (!(error instanceof ActionRequestError) || error.status >= 500)) setAmbiguous(true);
        setMessage("Could not save the Action. Your draft is retained. Retry when the connection is available.");
      }
    } finally { busy.current = false; setPending(false); }
  }
  async function reload() {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const current = await props.onReload();
      setFresh(current);
      setMessage(current ? "Latest Action loaded below. Review it before explicitly using its version; your draft is unchanged." : "The Action could not be located in the refreshed pages. Your draft and original version are retained. Retry Reload to search again.");
    } catch (error) { props.onFailure(error); setMessage("Could not reload. Your draft is retained."); }
    finally { busy.current = false; setPending(false); }
  }
  function text(field: "description" | "result" | "followUpNote" | "attachmentNotes", label: string, required = false) {
    return <div className="mb-3"><label className="form-label" htmlFor={`${prefix}-${field}`}>{label}{required ? " (required)" : ""}</label>
      <textarea id={`${prefix}-${field}`} className="form-control" value={draft[field]} required={required} maxLength={field === "result" ? 2000 : undefined}
        aria-invalid={!!errors[field]} aria-describedby={[`${prefix}-${field}-help`, errors[field] ? `${prefix}-${field}-error` : ""].filter(Boolean).join(" ")}
        onChange={e => setDraft({ ...draft, [field]: e.target.value })} />
      <div id={`${prefix}-${field}-help`} className="form-text">{field === "result" ? `${draft.result.length} / 2000 characters. Required when completing; otherwise optional.` : field === "description" ? "Required; whitespace alone is not accepted. No minimum word count." : field === "followUpNote" ? "Required when follow-up is enabled; otherwise optional." : "Optional notes about Ticket attachments."}</div>{fieldError(field)}</div>;
  }
  function fieldError(field: keyof ActionDraft) { return errors[field] ? <div id={`${prefix}-${field}-error`} className="text-danger">{errors[field]}</div> : null; }
  return <form className="action-form border rounded p-3 mt-3" onSubmit={submit} noValidate aria-labelledby={`${prefix}-title`}>
    <h3 ref={heading} tabIndex={-1} id={`${prefix}-title`}>{base ? "Edit Action" : "New Action"}</h3>
    <p>Performed By: {base?.performedBy.name ?? props.performer}{base ? ` · Ticket ${base.ticketId} · Version ${base.version} · Created ${new Date(base.createdAt).toLocaleString()}` : " (You)"}</p>
    {message && <div role="alert" className="alert alert-warning">{message}</div>}
    {ambiguous && <p>Retry sends the original submitted values and key. Fields are locked until the outcome is known. Closing does not cancel a request already sent.</p>}
    {fresh && <div className="alert alert-info"><strong>Latest saved Action — version {fresh.version}</strong><p>{fresh.description} · {fresh.result ?? "No result"} · {actionLabels[fresh.state]}</p>
      <p>Action Date/Time: {new Date(fresh.actionAt).toLocaleString()} · Assigned To: {fresh.assignedTo?.name ?? "Unassigned"} · Attachment Notes: {fresh.attachmentNotes ?? "None"}</p>
      <p>Follow-up: {fresh.followUpRequired ? "Required" : "Not required"} · {fresh.followUpNote ?? "No note"}</p>
      {terminalAction(fresh.state) ? <p>This Action is now read-only. Your draft remains visible.</p> : <button type="button" className="btn btn-outline-primary" disabled={pending} onClick={() => { setBase(fresh); setConflict(false); setFresh(undefined); setMessage("Latest version selected. Review all draft fields before saving."); }}>Use reviewed version</button>}</div>}
    <fieldset disabled={pending || frozen || props.readOnly || !!(base && terminalAction(base.state))}>
      <div className="mb-3"><label htmlFor={`${prefix}-date`} className="form-label">Action Date/Time (required, local time)</label>
        <input id={`${prefix}-date`} type="datetime-local" step="0.001" required className="form-control" value={draft.actionAt} aria-invalid={!!errors.actionAt} aria-describedby={errors.actionAt ? `${prefix}-actionAt-error` : undefined} onChange={e => setDraft({ ...draft, actionAt: e.target.value })} />{fieldError("actionAt")}</div>
      {text("description", "Description", true)}{text("result", "Result", draft.state === "COMPLETED")}
      <div className="mb-3"><label htmlFor={`${prefix}-assigned`} className="form-label">Assigned To</label><select id={`${prefix}-assigned`} className="form-select" value={draft.assignedToUserId} aria-invalid={!!errors.assignedToUserId} aria-describedby={errors.assignedToUserId ? `${prefix}-assignedToUserId-error` : undefined} onChange={e => setDraft({ ...draft, assignedToUserId: e.target.value })}>
        <option value="">Unassigned</option>{ineligible && <option value={draft.assignedToUserId} disabled>{base?.assignedTo?.name ?? "Previous assignee"} (no longer eligible)</option>}
        {props.owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name} ({owner.role === "ADMINISTRATOR" ? "Administrator" : "IT Staff"})</option>)}</select>{fieldError("assignedToUserId")}</div>
      <div className="form-check mb-3"><input id={`${prefix}-follow`} type="checkbox" className="form-check-input" checked={draft.followUpRequired} onChange={e => setDraft({ ...draft, followUpRequired: e.target.checked })} /><label htmlFor={`${prefix}-follow`} className="form-check-label">Follow-Up Required</label></div>
      {text("followUpNote", "Follow-Up Note", draft.followUpRequired)}{text("attachmentNotes", "Attachment Notes")}
      <p className="text-muted">Attachment Notes describe existing Ticket attachments; they do not upload files. Turning follow-up off preserves your note.</p>
      <label htmlFor={`${prefix}-state`} className="form-label">State</label><select id={`${prefix}-state`} className="form-select" value={draft.state} aria-invalid={invalidState || !!errors.state} aria-describedby={invalidState || errors.state ? `${prefix}-state-error` : undefined} onChange={e => setDraft({ ...draft, state: e.target.value as ActionDraft["state"] })}>{invalidState && <option value={draft.state} disabled>{actionLabels[draft.state]} (no longer allowed — choose a state)</option>}{actionStates(base?.state).map(state => <option key={state} value={state}>{actionLabels[state]}</option>)}</select>{invalidState ? <div id={`${prefix}-state-error`} className="text-danger" role="alert">The saved state changed. Choose an allowed state; your other draft fields are retained.</div> : fieldError("state")}
    </fieldset>
    {conflict && <button type="button" className="btn btn-outline-primary mt-3 me-2" disabled={pending} onClick={() => void reload()}>Reload latest Action</button>}
    <button type="submit" className="btn btn-success mt-3 me-2" disabled={pending || conflict || expired || invalidState || (props.readOnly && !ambiguous) || !!(base && terminalAction(base.state))}>{pending ? "Saving…" : ambiguous ? "Retry original request" : "Save Action"}</button>
    <button type="button" className="btn btn-outline-secondary mt-3" disabled={pending} onClick={props.onCancel}>Cancel</button>
  </form>;
}
