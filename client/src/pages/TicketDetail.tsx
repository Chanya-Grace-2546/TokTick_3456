import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchTicketDetail,
  uploadAttachment,
  attachmentDownloadUrl,
  removeAttachment,
  TicketDetailData,
  TicketNotFoundError,
  AttachmentUploadError,
  AttachmentMeta,
} from "../api.js";
import { useRequester } from "../context/RequesterContext.js";
import { zenGreen } from "../theme.js";

type ScreenState = "loading" | "not-found" | "error" | "ready";

const cardStyle: React.CSSProperties = {
  backgroundColor: "white",
  border: "1px solid #E0E5E2",
  borderRadius: 8,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: "#0B7A46",
  MEDIUM: "#B8860B",
  HIGH: "#B3261E",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Lab 2 Issue 6 — Requester Ticket Detail + Attachments
export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { requester } = useRequester();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ScreenState>("loading");
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  function load() {
    if (!requester || !id) return;
    setState("loading");
    fetchTicketDetail(Number(id), requester.id)
      .then((data) => {
        setTicket(data);
        setState("ready");
      })
      .catch((err) => {
        setState(err instanceof TicketNotFoundError ? "not-found" : "error");
      });
  }

  useEffect(load, [id, requester]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !requester || !ticket) return;

    setUploadError("");
    setUploading(true);
    try {
      await uploadAttachment(ticket.id, requester.id, file);
      load();
    } catch (err) {
      if (err instanceof AttachmentUploadError) {
        const messages: Record<string, string> = {
          INVALID_FILE_TYPE: "Only JPG, PNG, WEBP, or PDF files are allowed.",
          FILE_TOO_LARGE: "File is too large — 5MB maximum.",
          MAX_ATTACHMENTS_REACHED: "This ticket already has 5 active attachments.",
        };
        setUploadError(messages[err.code] ?? "Upload failed. Please try again.");
      } else {
        setUploadError("Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove(attachment: AttachmentMeta) {
    if (!requester) return;
    const reason = window.prompt(`Reason for removing "${attachment.fileName}"?`);
    if (!reason || !reason.trim()) return;

    setRemovingId(attachment.id);
    try {
      await removeAttachment(attachment.id, requester.id, reason.trim());
      load();
    } catch {
      setUploadError("Couldn't remove that attachment. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  if (state === "loading") {
    return (
      <div className="container py-5" style={{ maxWidth: 840 }}>
        <p role="status">Loading ticket…</p>
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div className="container py-5" style={{ maxWidth: 840 }}>
        <p role="alert">This ticket doesn't exist or isn't available to you.</p>
        <Link to="/tickets">Back to My Tickets</Link>
      </div>
    );
  }

  if (state === "error" || !ticket) {
    return (
      <div className="container py-5" style={{ maxWidth: 840 }}>
        <p role="alert" className="text-danger">
          Couldn't load this ticket. Please try again.
        </p>
      </div>
    );
  }

  const activeAttachments = ticket.attachments.filter((a) => !a.isRemoved);

  return (
    <div className="container py-5" style={{ maxWidth: 840 }}>
      <Link to="/tickets" className="d-inline-block mb-3 small">
        ← Back to My Tickets
      </Link>

      <div className="p-4 mb-4" style={cardStyle}>
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">Ticket No.</div>
            <div className="fw-bold">{ticket.ticketNumber}</div>
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">Ticket Date</div>
            <div>{new Date(ticket.createdAt).toLocaleDateString()}</div>
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">Category</div>
            <div>{ticket.category}</div>
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">Related System</div>
            <div>{ticket.relatedSystem}</div>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">Requested Priority</div>
            <span
              className="badge"
              style={{ backgroundColor: PRIORITY_BADGE[ticket.requestedPriority] }}
            >
              {ticket.requestedPriority}
            </span>
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">IT Priority</div>
            <div>{ticket.itPriority ?? "—"}</div>
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">Current Status</div>
            <span className="badge" style={{ backgroundColor: zenGreen.secondary }}>
              {ticket.currentStatus}
            </span>
          </div>
        </div>

        <div className="mb-3">
          <div className="text-muted small">Summary</div>
          <div>{ticket.summary}</div>
        </div>

        <div>
          <div className="text-muted small">Description</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</div>
        </div>
      </div>

      <div className="p-4" style={cardStyle}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0" style={{ color: zenGreen.text }}>
            Attachments ({activeAttachments.length}/5)
          </h2>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              id="attachment-file"
              className="d-none"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFileChange}
              disabled={uploading || activeAttachments.length >= 5}
            />
            <label
              htmlFor="attachment-file"
              className="btn btn-sm"
              style={{
                backgroundColor: zenGreen.primary,
                color: "white",
                opacity: uploading || activeAttachments.length >= 5 ? 0.6 : 1,
                cursor: uploading || activeAttachments.length >= 5 ? "not-allowed" : "pointer",
              }}
            >
              {uploading ? "Uploading…" : "+ Add Attachment"}
            </label>
          </div>
        </div>

        {uploadError && (
          <p role="alert" className="text-danger small">
            {uploadError}
          </p>
        )}

        {ticket.attachments.length === 0 ? (
          <p className="text-muted">No attachments yet.</p>
        ) : (
          <ul className="list-group">
            {ticket.attachments.map((a) => (
              <li
                key={a.id}
                className="list-group-item d-flex justify-content-between align-items-center"
                style={a.isRemoved ? { opacity: 0.6 } : undefined}
              >
                <div>
                  <div style={a.isRemoved ? { textDecoration: "line-through" } : undefined}>
                    {a.fileName}{" "}
                    <span className="text-muted small">({formatBytes(a.sizeBytes)})</span>
                  </div>
                  {a.isRemoved && (
                    <div className="text-muted small">
                      Removed {new Date(a.removedAt!).toLocaleDateString()} — {a.removedReason}
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2">
                  {!a.isRemoved && requester && (
                    <>
                      <a
                        href={attachmentDownloadUrl(a.id, requester.id)}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        disabled={removingId === a.id}
                        onClick={() => handleRemove(a)}
                      >
                        {removingId === a.id ? "Removing…" : "Remove"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
