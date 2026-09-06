import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Category,
  RelatedSystem,
  Priority,
  fetchCategories,
  fetchRelatedSystems,
  createTicket,
  uploadAttachment,
  AttachmentUploadError,
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

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB, BR-22
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

function isAllowedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Lab 2 Issue 4 + Issue 6 — Ticket Creation with Attachments
// Flow: create the Ticket first, then upload any selected files to it.
// If a file upload fails, the Ticket is still saved (BR-21) — failures are
// reported so the Requester can retry from Ticket Detail instead.
export default function CreateTicket() {
  const { requester } = useRequester();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [refState, setRefState] = useState<ReferenceDataState>("loading");

  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [requestedPriority, setRequestedPriority] = useState<Priority | "">("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitErrorMessage, setSubmitErrorMessage] = useState("");
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [attachmentFailures, setAttachmentFailures] = useState<string[]>([]);

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

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    setFileError("");

    if (selectedFiles.length + incoming.length > MAX_FILES) {
      setFileError(`You can attach at most ${MAX_FILES} files.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const invalid = incoming.find((f) => !isAllowedFile(f));
    if (invalid) {
      setFileError(`"${invalid.name}" isn't an allowed type (JPG, PNG, WEBP, or PDF only).`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const tooLarge = incoming.find((f) => f.size > MAX_FILE_SIZE);
    if (tooLarge) {
      setFileError(`"${tooLarge.name}" is too large — 5MB maximum.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...incoming]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

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

      // BR-21: Ticket is already saved at this point. Attachment upload
      // failures below are reported but never roll back the Ticket.
      const failures: string[] = [];
      for (const file of selectedFiles) {
        try {
          await uploadAttachment(ticket.id, requester.id, file);
        } catch (err) {
          failures.push(
            file.name + (err instanceof AttachmentUploadError ? ` (${err.code})` : "")
          );
        }
      }

      setAttachmentFailures(failures);
      setCreatedTicket(ticket);
      setSubmitState("success");
    } catch (err) {
      // BR-19/BR-20: entered values are NEVER cleared on failure.
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

          {attachmentFailures.length > 0 && (
            <div className="alert alert-warning small">
              Ticket was saved, but {attachmentFailures.length} attachment(s) failed to upload:{" "}
              {attachmentFailures.join(", ")}. You can retry adding them from the ticket's detail
              page.
            </div>
          )}

          <div className="d-flex gap-2">
            <button
              className="btn btn-sm"
              style={{ backgroundColor: zenGreen.primary, color: "white" }}
              onClick={() => navigate(`/tickets/${createdTicket.id}`)}
            >
              View Ticket
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => navigate("/tickets")}
            >
              Back to My Tickets
            </button>
          </div>
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
            <div
              className="row g-3 mb-4 p-3"
              style={{ backgroundColor: zenGreen.readOnlyBg, borderRadius: 6 }}
            >
              <div className="col-12 col-md-6 col-lg-4">
                <label className="form-label text-muted small mb-1">Ticket Number</label>
                <div className="form-control-plaintext">Assigned after submission</div>
              </div>
              <div className="col-12 col-md-6 col-lg-4">
                <label className="form-label text-muted small mb-1">Ticket Date</label>
                <div className="form-control-plaintext">{new Date().toLocaleDateString()}</div>
              </div>
              <div className="col-12 col-md-6 col-lg-4">
                <label className="form-label text-muted small mb-1">Requester</label>
                <div className="form-control-plaintext">{requester?.name}</div>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-12 col-md-6 col-lg-4">
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

              <div className="col-12 col-md-6 col-lg-4">
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

              <div className="col-12 col-md-6 col-lg-4">
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

            <div className="mb-4">
              <label className="form-label" htmlFor="attachments">
                Attachments (optional, up to {MAX_FILES}, JPG/PNG/WEBP/PDF, 5MB each)
              </label>
              <input
                ref={fileInputRef}
                id="attachments"
                type="file"
                className="form-control"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                multiple
                onChange={handleFilesSelected}
                disabled={selectedFiles.length >= MAX_FILES}
              />
              {fileError && <div className="text-danger small mt-1">{fileError}</div>}

              {selectedFiles.length > 0 && (
                <ul className="list-group mt-2">
                  {selectedFiles.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="list-group-item d-flex justify-content-between align-items-center py-1"
                    >
                      <span className="small">
                        {f.name} <span className="text-muted">({(f.size / 1024).toFixed(0)} KB)</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger py-0"
                        onClick={() => removeSelectedFile(i)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
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
