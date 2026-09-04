import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Category,
  RelatedSystem,
  Priority,
  fetchCategories,
  fetchRelatedSystems,
  createTicket,
  CreateTicketValidationError,
  FieldErrors,
  Ticket,
} from "../api.js";
import { useRequester } from "../context/RequesterContext.js";
import { zenGreen } from "../theme.js";

type ReferenceDataState = "loading" | "error" | "ready";
type SubmitState = "idle" | "submitting" | "success" | "error";

const cardStyle: React.CSSProperties = {
  backgroundColor: "white",
  border: "1px solid #E0E5E2",
  borderRadius: 8,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

// Lab 2 Issue 4 — Ticket Creation
// Attachments are intentionally NOT part of this screen yet — the
// Attachment model and its upload endpoint belong to Issue 6.
export default function CreateTicket() {
  const { requester } = useRequester();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [refState, setRefState] = useState<ReferenceDataState>("loading");

  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [requestedPriority, setRequestedPriority] = useState<Priority | "">("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitErrorMessage, setSubmitErrorMessage] = useState("");
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchCategories(), fetchRelatedSystems()])
      .then(([cats, systems]) => {
        if (cancelled) return;
        setCategories(cats);
        setRelatedSystems(systems);
        setRefState("ready");
      })
      .catch(() => {
        if (!cancelled) setRefState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requester) return;

    setFieldErrors({});
    setSubmitErrorMessage("");
    setSubmitState("submitting");

    try {
      const ticket = await createTicket({
        requesterId: requester.id,
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary,
        description,
        requestedPriority: requestedPriority as Priority,
      });
      setCreatedTicket(ticket);
      setSubmitState("success");
    } catch (err) {
      // BR-19/BR-20: entered values are NEVER cleared on failure — we simply
      // don't reset categoryId/relatedSystemId/summary/description here.
      if (err instanceof CreateTicketValidationError) {
        setFieldErrors(err.fields);
        setSubmitState("idle");
      } else {
        setSubmitErrorMessage(
          err instanceof Error ? err.message : "Something went wrong. Please try again."
        );
        setSubmitState("error");
      }
    }
  }

  if (submitState === "success" && createdTicket) {
    return (
      <div className="container py-5" style={{ maxWidth: 720 }}>
        <div className="p-4" style={{ ...cardStyle, borderLeft: `4px solid ${zenGreen.secondary}` }}>
          <h2 className="h5" style={{ color: zenGreen.text }}>
            Ticket submitted
          </h2>
          <p className="mb-1">
            Your official Ticket Number is{" "}
            <strong style={{ color: zenGreen.primary }}>{createdTicket.ticketNumber}</strong>.
          </p>
          <p className="mb-1">Ticket Date: {new Date(createdTicket.createdAt).toLocaleString()}</p>
          <p className="mb-3">Requester: {requester?.name}</p>
          <button
            className="btn btn-sm"
            style={{ backgroundColor: zenGreen.primary, color: "white" }}
            onClick={() => navigate("/tickets")}
          >
            Back to My Tickets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <h1 className="h4 mb-3" style={{ color: zenGreen.text }}>
        Create Ticket
      </h1>

      {refState === "loading" && <p role="status">Loading form…</p>}
      {refState === "error" && (
        <p role="alert" className="text-danger">
          Couldn't load Categories or Related Systems. Please try again.
        </p>
      )}

      {refState === "ready" && (
        <div className="p-4" style={cardStyle}>
          <form onSubmit={handleSubmit} noValidate>
            {/* System-generated / read-only fields — handout §4.4 requires
                Ticket Number, Ticket Date, and Requester to be shown, even
                though they're not editable here. */}
            <div
              className="row g-3 mb-4 p-3"
              style={{ backgroundColor: zenGreen.readOnlyBg, borderRadius: 6 }}
            >
              <div className="col-md-4">
                <label className="form-label text-muted small mb-1">Ticket Number</label>
                <div className="form-control-plaintext">Assigned after submission</div>
              </div>
              <div className="col-md-4">
                <label className="form-label text-muted small mb-1">Ticket Date</label>
                <div className="form-control-plaintext">{new Date().toLocaleDateString()}</div>
              </div>
              <div className="col-md-4">
                <label className="form-label text-muted small mb-1">Requester</label>
                <div className="form-control-plaintext">{requester?.name}</div>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label" htmlFor="category">
                  Category <span className="text-danger">*</span>
                </label>
                <select
                  id="category"
                  className={`form-select ${fieldErrors.categoryId ? "is-invalid" : ""}`}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.categoryId && (
                  <div className="invalid-feedback d-block">{fieldErrors.categoryId}</div>
                )}
              </div>

              <div className="col-md-4">
                <label className="form-label" htmlFor="relatedSystem">
                  Related System <span className="text-danger">*</span>
                </label>
                <select
                  id="relatedSystem"
                  className={`form-select ${fieldErrors.relatedSystemId ? "is-invalid" : ""}`}
                  value={relatedSystemId}
                  onChange={(e) => setRelatedSystemId(e.target.value)}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {relatedSystems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.relatedSystemId && (
                  <div className="invalid-feedback d-block">{fieldErrors.relatedSystemId}</div>
                )}
              </div>

              <div className="col-md-4">
                <label className="form-label" htmlFor="requestedPriority">
                  Requested Priority <span className="text-danger">*</span>
                </label>
                <select
                  id="requestedPriority"
                  className={`form-select ${fieldErrors.requestedPriority ? "is-invalid" : ""}`}
                  value={requestedPriority}
                  onChange={(e) => setRequestedPriority(e.target.value as Priority)}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
                {fieldErrors.requestedPriority && (
                  <div className="invalid-feedback d-block">{fieldErrors.requestedPriority}</div>
                )}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="summary">
                Summary <span className="text-danger">*</span>
              </label>
              <input
                id="summary"
                type="text"
                className={`form-control ${fieldErrors.summary ? "is-invalid" : ""}`}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={120}
              />
              {fieldErrors.summary && (
                <div className="invalid-feedback d-block">{fieldErrors.summary}</div>
              )}
            </div>

            <div className="mb-4">
              <label className="form-label" htmlFor="description">
                Description <span className="text-danger">*</span>
              </label>
              <textarea
                id="description"
                className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
              />
              {fieldErrors.description && (
                <div className="invalid-feedback d-block">{fieldErrors.description}</div>
              )}
            </div>

            {submitState === "error" && (
              <p role="alert" className="text-danger">
                {submitErrorMessage}
              </p>
            )}

            <button
              type="submit"
              className="btn"
              style={{ backgroundColor: zenGreen.primary, color: "white" }}
              disabled={submitState === "submitting"}
            >
              {submitState === "submitting" ? "Submitting…" : "Submit Ticket"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
