import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  claimStaffTicket,
  createInternalNote,
  createPublicComment,
  downloadAttachment,
  fetchStaffOwners,
  fetchStaffTicketDetail,
  Priority,
  StaffOwner,
  StaffTicketDetail as StaffTicketDetailData,
  StaffTicketOperationError,
  StaffTicketStatus,
  updateStaffTicketOwner,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
} from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { zenGreen } from "../theme.js";

type ScreenState =
  | "loading"
  | "not-found"
  | "forbidden"
  | "error"
  | "ready";

type Operation =
  | "claim"
  | "owner"
  | "priority"
  | "status"
  | "public-comment"
  | "internal-note"
  | "download"
  | null;

const panelStyle: React.CSSProperties = {
  backgroundColor: "white",
  border: "1px solid #E0E5E2",
  borderRadius: 8,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const internalPanelStyle: React.CSSProperties = {
  ...panelStyle,
  backgroundColor: "#FFF9E8",
  borderColor: "#E7D9A8",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "#0B7A46",
  MEDIUM: "#B8860B",
  HIGH: "#B3261E",
};

const STATUS_TRANSITIONS: Record<
  StaffTicketStatus,
  StaffTicketStatus[]
> = {
  NEW: [
    "OPEN",
    "IN_PROGRESS",
    "CANCELLED",
  ],
  OPEN: [
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CANCELLED",
  ],
  IN_PROGRESS: [
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CANCELLED",
  ],
  WAITING_FOR_REQUESTER: [
    "IN_PROGRESS",
    "RESOLVED",
    "CANCELLED",
  ],
  RESOLVED: [
    "CLOSED",
    "REOPENED",
  ],
  CLOSED: ["REOPENED"],
  REOPENED: [
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CANCELLED",
  ],
  CANCELLED: [],
};

const CONFIRM_STATUSES = new Set<StaffTicketStatus>([
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
]);

function label(value: string) {
  if (value === "WAITING_FOR_REQUESTER") {
    return "Waiting for Requester";
  }

  return value
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word[0].toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function PriorityBadge({
  priority,
}: {
  priority: Priority;
}) {
  return (
    <span
      className="badge"
      style={{
        backgroundColor:
          PRIORITY_COLORS[priority],
      }}
    >
      {label(priority)}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: StaffTicketStatus;
}) {
  return (
    <span
      className="badge text-wrap text-start"
      style={{
        backgroundColor: zenGreen.pale,
        color: zenGreen.primary,
      }}
    >
      {label(status)}
    </span>
  );
}

function ReadOnlyField({
  label: fieldLabel,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="col-12 col-md-6">
      <div className="small text-muted">
        {fieldLabel}
      </div>
      <div>{children}</div>
    </div>
  );
}

// Lab 3 Issue 6 — IT Staff operational Ticket Detail.
// Requester-entered data is read-only. Staff/Admin may manage ownership,
// IT Priority, permitted status transitions, Public Comments, and private
// Internal Notes.
export default function StaffTicketDetail() {
  const { id } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [state, setState] =
    useState<ScreenState>("loading");
  const [ticket, setTicket] =
    useState<StaffTicketDetailData | null>(
      null
    );
  const [owners, setOwners] = useState<
    StaffOwner[]
  >([]);
  const [selectedOwnerId, setSelectedOwnerId] =
    useState("");
  const [selectedPriority, setSelectedPriority] =
    useState<Priority>("MEDIUM");
  const [selectedStatus, setSelectedStatus] =
    useState<StaffTicketStatus | "">("");
  const [publicContent, setPublicContent] =
    useState("");
  const [internalContent, setInternalContent] =
    useState("");
  const [operation, setOperation] =
    useState<Operation>(null);
  const [message, setMessage] = useState("");
  const [operationError, setOperationError] =
    useState("");

  async function handleAuthFailure(
    failure: unknown
  ) {
    if (
      failure instanceof
        StaffTicketOperationError &&
      (failure.status === 401 ||
        failure.code ===
          "PASSWORD_CHANGE_REQUIRED")
    ) {
      await refreshUser();

      navigate(
        failure.status === 401
          ? "/login"
          : "/change-password",
        {
          replace: true,
        }
      );

      return true;
    }

    return false;
  }

  async function load() {
    if (!id) {
      setState("not-found");
      return;
    }

    const ticketId = Number(id);

    if (
      !Number.isInteger(ticketId) ||
      ticketId <= 0
    ) {
      setState("not-found");
      return;
    }

    setState("loading");
    setMessage("");
    setOperationError("");

    try {
      const [detail, ownerRows] =
        await Promise.all([
          fetchStaffTicketDetail(ticketId),
          fetchStaffOwners(),
        ]);

      setTicket(detail);
      setOwners(ownerRows);
      setSelectedOwnerId(
        detail.owner
          ? String(detail.owner.id)
          : ""
      );
      setSelectedPriority(
        detail.itPriority
      );
      setSelectedStatus("");
      setState("ready");
    } catch (failure) {
      if (
        await handleAuthFailure(failure)
      ) {
        return;
      }

      if (
        failure instanceof
        StaffTicketOperationError
      ) {
        if (failure.status === 404) {
          setState("not-found");
          return;
        }

        if (failure.status === 403) {
          setState("forbidden");
          return;
        }
      }

      setState("error");
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function runOperation(
    name: Exclude<Operation, null>,
    action: () => Promise<unknown>,
    successMessage: string
  ) {
    setOperation(name);
    setOperationError("");
    setMessage("");

    try {
      await action();
      setMessage(successMessage);
      await load();
      setMessage(successMessage);
    } catch (failure) {
      if (
        await handleAuthFailure(failure)
      ) {
        return;
      }

      if (
        failure instanceof
        StaffTicketOperationError
      ) {
        const messages: Record<
          string,
          string
        > = {
          TICKET_ALREADY_ASSIGNED:
            "This ticket was already assigned. Reloaded data may have changed.",
          INVALID_OWNER:
            "Choose an active IT Staff or Administrator.",
          INVALID_STATUS_TRANSITION:
            "That status transition is no longer permitted.",
          VALIDATION_FAILED:
            "Check the entered value and try again.",
          FORBIDDEN:
            "You do not have permission to perform this operation.",
        };

        setOperationError(
          messages[failure.code] ??
            "The operation could not be completed."
        );
      } else {
        setOperationError(
          "The operation could not be completed. Please try again."
        );
      }
    } finally {
      setOperation(null);
    }
  }

  async function handleClaim() {
    if (!ticket) {
      return;
    }

    await runOperation(
      "claim",
      () => claimStaffTicket(ticket.id),
      "Ticket claimed successfully."
    );
  }

  async function handleOwnerSave() {
    if (!ticket) {
      return;
    }

    const ownerId =
      selectedOwnerId === ""
        ? null
        : Number(selectedOwnerId);

    await runOperation(
      "owner",
      () =>
        updateStaffTicketOwner(
          ticket.id,
          ownerId
        ),
      ownerId === null
        ? "Ticket owner cleared."
        : "Ticket owner updated."
    );
  }

  async function handlePrioritySave() {
    if (!ticket) {
      return;
    }

    await runOperation(
      "priority",
      () =>
        updateStaffTicketPriority(
          ticket.id,
          selectedPriority
        ),
      "IT Priority updated."
    );
  }

  async function handleStatusSave() {
    if (!ticket || !selectedStatus) {
      return;
    }

    if (
      CONFIRM_STATUSES.has(
        selectedStatus
      ) &&
      !window.confirm(
        `Change this ticket to ${label(
          selectedStatus
        )}?`
      )
    ) {
      return;
    }

    await runOperation(
      "status",
      () =>
        updateStaffTicketStatus(
          ticket.id,
          selectedStatus
        ),
      `Status changed to ${label(
        selectedStatus
      )}.`
    );
  }

  async function handlePublicComment(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!ticket) {
      return;
    }

    const content = publicContent.trim();

    if (
      content.length < 1 ||
      content.length > 2000
    ) {
      setOperationError(
        "Public Comment must be between 1 and 2000 characters."
      );
      return;
    }

    setOperation("public-comment");
    setOperationError("");
    setMessage("");

    try {
      await createPublicComment(
        ticket.id,
        content
      );
      setPublicContent("");
      await load();
      setMessage(
        "Public Comment posted."
      );
    } catch (failure) {
      if (
        await handleAuthFailure(failure)
      ) {
        return;
      }

      setOperationError(
        "Could not post the Public Comment. Please try again."
      );
    } finally {
      setOperation(null);
    }
  }

  async function handleInternalNote(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!ticket) {
      return;
    }

    const content =
      internalContent.trim();

    if (
      content.length < 1 ||
      content.length > 2000
    ) {
      setOperationError(
        "Internal Note must be between 1 and 2000 characters."
      );
      return;
    }

    await runOperation(
      "internal-note",
      () =>
        createInternalNote(
          ticket.id,
          content
        ),
      "Internal Note added."
    );

    setInternalContent("");
  }

  async function handleDownload(
    attachment: StaffTicketDetailData["attachments"][number]
  ) {
    setOperation("download");
    setOperationError("");
    setMessage("");

    try {
      const blob =
        await downloadAttachment(
          attachment.id
        );
      const url =
        URL.createObjectURL(blob);
      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        attachment.fileName;

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setOperationError(
        "Could not download the attachment."
      );
    } finally {
      setOperation(null);
    }
  }

  if (state === "loading") {
    return (
      <div
        className="container py-5"
        style={{ maxWidth: 1000 }}
      >
        <div
          role="status"
          className="text-muted"
        >
          Loading ticket…
        </div>
      </div>
    );
  }

  if (state !== "ready" || !ticket) {
    const text =
      state === "not-found"
        ? "Ticket not found."
        : state === "forbidden"
          ? "You do not have permission to view this ticket."
          : "Could not load the ticket. Please try again.";

    return (
      <div
        className="container py-5"
        style={{ maxWidth: 1000 }}
      >
        <Link
          to="/staff/tickets"
          className="d-inline-block mb-3 small"
        >
          ← Back to Ticket Queue
        </Link>

        <div
          className="alert alert-danger"
          role="alert"
        >
          {text}
        </div>

        {state === "error" && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => void load()}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const transitions =
    STATUS_TRANSITIONS[ticket.status];

  return (
    <div
      className="container py-4"
      style={{
        maxWidth: 1000,
        color: zenGreen.text,
        overflowWrap: "anywhere",
      }}
    >
      <Link
        to="/staff/tickets"
        className="d-inline-block mb-3 small"
      >
        ← Back to Ticket Queue
      </Link>

      <header className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1">
            {ticket.ticketNumber}
          </h1>
          <div className="text-muted">
            Staff Ticket Detail
          </div>
        </div>

        <StatusBadge
          status={ticket.status}
        />
      </header>

      {message && (
        <div
          className="alert alert-success"
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}

      {operationError && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {operationError}
        </div>
      )}

      {ticket.requesterResolvedAt && (
        <div
          className="alert"
          role="status"
          style={{
            backgroundColor:
              zenGreen.pale,
            color: zenGreen.text,
            border: `1px solid ${zenGreen.primary}`,
          }}
        >
          <strong>
            Requester reports the problem
            appears resolved.
          </strong>
          <div className="small mt-1">
            Reported{" "}
            {formatDate(
              ticket.requesterResolvedAt
            )}. This does not change the
            formal Ticket status.
          </div>
        </div>
      )}

      <section
        className="p-3 p-md-4 mb-3"
        style={panelStyle}
        aria-labelledby="request-details-heading"
      >
        <h2
          id="request-details-heading"
          className="h5"
        >
          Request Details
        </h2>

        <p className="small text-muted">
          Requester-entered information is
          read-only.
        </p>

        <div className="row g-3">
          <ReadOnlyField label="Requester">
            {ticket.requester.name}
          </ReadOnlyField>

          <ReadOnlyField label="Requester Email">
            {ticket.requester.email}
          </ReadOnlyField>

          <ReadOnlyField label="Category">
            {ticket.category.name}
          </ReadOnlyField>

          <ReadOnlyField label="Related System">
            {ticket.relatedSystem.name}
          </ReadOnlyField>

          <ReadOnlyField label="Requested Priority">
            <PriorityBadge
              priority={
                ticket.requestedPriority
              }
            />
            <span className="small text-muted ms-2">
              Read-only
            </span>
          </ReadOnlyField>

          <div className="col-12">
            <div className="small text-muted">
              Summary
            </div>
            <div>{ticket.summary}</div>
          </div>

          <div className="col-12">
            <div className="small text-muted">
              Description
            </div>
            <div
              style={{
                whiteSpace: "pre-wrap",
              }}
            >
              {ticket.description}
            </div>
          </div>

          <ReadOnlyField label="Created">
            <time
              dateTime={ticket.createdAt}
            >
              {formatDate(
                ticket.createdAt
              )}
            </time>
          </ReadOnlyField>

          <ReadOnlyField label="Last Updated">
            <time
              dateTime={ticket.updatedAt}
            >
              {formatDate(
                ticket.updatedAt
              )}
            </time>
          </ReadOnlyField>
        </div>
      </section>

      <section
        className="p-3 p-md-4 mb-3"
        style={panelStyle}
        aria-labelledby="operations-heading"
      >
        <h2
          id="operations-heading"
          className="h5"
        >
          IT Operations
        </h2>

        <div className="row g-4">
          <div className="col-12">
            <div className="d-flex flex-wrap align-items-end gap-2">
              <div
                style={{
                  flex: "1 1 260px",
                }}
              >
                <label
                  htmlFor="staff-owner"
                  className="form-label"
                >
                  Ticket Owner
                </label>

                <select
                  id="staff-owner"
                  className="form-select"
                  value={selectedOwnerId}
                  disabled={
                    operation !== null
                  }
                  onChange={(event) =>
                    setSelectedOwnerId(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Unassigned
                  </option>

                  {owners.map((owner) => (
                    <option
                      key={owner.id}
                      value={owner.id}
                    >
                      {owner.name} —{" "}
                      {label(owner.role)}
                    </option>
                  ))}
                </select>
              </div>

              {!ticket.owner && (
                <button
                  type="button"
                  className="btn"
                  style={{
                    backgroundColor:
                      zenGreen.primary,
                    color: "white",
                  }}
                  disabled={
                    operation !== null
                  }
                  onClick={() =>
                    void handleClaim()
                  }
                >
                  {operation === "claim"
                    ? "Claiming…"
                    : "Claim Ticket"}
                </button>
              )}

              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={
                  operation !== null ||
                  selectedOwnerId ===
                    (ticket.owner
                      ? String(
                          ticket.owner.id
                        )
                      : "")
                }
                onClick={() =>
                  void handleOwnerSave()
                }
              >
                {operation === "owner"
                  ? "Saving…"
                  : ticket.owner
                    ? "Save / Reassign"
                    : "Assign"}
              </button>
            </div>

            <div className="small text-muted mt-1">
              Current owner:{" "}
              {ticket.owner
                ? `${ticket.owner.name} (${label(
                    ticket.owner.role
                  )})`
                : "Unassigned"}
            </div>
          </div>

          <div className="col-12 col-md-6">
            <label
              htmlFor="staff-it-priority"
              className="form-label"
            >
              IT Priority
            </label>

            <select
              id="staff-it-priority"
              className="form-select"
              value={selectedPriority}
              disabled={operation !== null}
              onChange={(event) =>
                setSelectedPriority(
                  event.target
                    .value as Priority
                )
              }
            >
              <option value="LOW">
                Low
              </option>
              <option value="MEDIUM">
                Medium
              </option>
              <option value="HIGH">
                High
              </option>
            </select>

            <button
              type="button"
              className="btn btn-outline-secondary mt-2"
              disabled={
                operation !== null ||
                selectedPriority ===
                  ticket.itPriority
              }
              onClick={() =>
                void handlePrioritySave()
              }
            >
              {operation === "priority"
                ? "Saving…"
                : "Save IT Priority"}
            </button>
          </div>

          <div className="col-12 col-md-6">
            <label
              htmlFor="staff-status"
              className="form-label"
            >
              Status
            </label>

            <select
              id="staff-status"
              className="form-select"
              value={selectedStatus}
              disabled={
                operation !== null ||
                transitions.length === 0
              }
              onChange={(event) =>
                setSelectedStatus(
                  event.target
                    .value as
                    | StaffTicketStatus
                    | ""
                )
              }
            >
              <option value="">
                {transitions.length
                  ? "Choose next status"
                  : "No transitions available"}
              </option>

              {transitions.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {label(status)}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              className="btn btn-outline-secondary mt-2"
              disabled={
                operation !== null ||
                !selectedStatus
              }
              onClick={() =>
                void handleStatusSave()
              }
            >
              {operation === "status"
                ? "Saving…"
                : "Change Status"}
            </button>

            <div className="small text-muted mt-1">
              Current status:{" "}
              {label(ticket.status)}
            </div>
          </div>
        </div>
      </section>

      <section
        className="p-3 p-md-4 mb-3"
        style={panelStyle}
        aria-labelledby="attachments-heading"
      >
        <h2
          id="attachments-heading"
          className="h5"
        >
          Attachments
        </h2>

        {ticket.attachments.length ===
        0 ? (
          <p className="text-muted mb-0">
            No attachments.
          </p>
        ) : (
          <ul className="list-group list-group-flush">
            {ticket.attachments.map(
              (attachment) => (
                <li
                  key={attachment.id}
                  className="list-group-item px-0 d-flex flex-wrap align-items-center justify-content-between gap-2"
                >
                  <div>
                    <div>
                      {attachment.fileName}
                    </div>
                    <div className="small text-muted">
                      {formatBytes(
                        attachment.sizeBytes
                      )}
                      {" · "}
                      {attachment.isRemoved
                        ? "Removed"
                        : "Active"}
                    </div>

                    {attachment.isRemoved &&
                      attachment.removedReason && (
                        <div className="small text-muted">
                          Removal reason:{" "}
                          {
                            attachment.removedReason
                          }
                        </div>
                      )}
                  </div>

                  {!attachment.isRemoved && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={
                        operation !== null
                      }
                      onClick={() =>
                        void handleDownload(
                          attachment
                        )
                      }
                    >
                      Download
                    </button>
                  )}
                </li>
              )
            )}
          </ul>
        )}
      </section>

      <section
        className="p-3 p-md-4 mb-3"
        style={panelStyle}
        aria-labelledby="public-comments-heading"
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <h2
            id="public-comments-heading"
            className="h5 mb-0"
          >
            Public Comments
          </h2>

          <span
            className="badge"
            style={{
              backgroundColor:
                zenGreen.pale,
              color: zenGreen.primary,
            }}
          >
            Visible to Requester
          </span>
        </div>

        <p className="small text-muted mt-2">
          Messages posted here are visible
          to the Requester.
        </p>

        {ticket.publicComments.length ===
        0 ? (
          <p className="text-muted">
            No Public Comments yet.
          </p>
        ) : (
          <ul className="list-unstyled">
            {ticket.publicComments.map(
              (comment) => (
                <li
                  key={comment.id}
                  className="border-top py-3"
                >
                  <div className="d-flex flex-wrap justify-content-between gap-2">
                    <strong>
                      {comment.author.name}
                    </strong>
                    <time
                      className="small text-muted"
                      dateTime={
                        comment.createdAt
                      }
                    >
                      {formatDate(
                        comment.createdAt
                      )}
                    </time>
                  </div>

                  <div className="small text-muted mb-1">
                    {label(
                      comment.author.role
                    )}
                  </div>

                  <div
                    style={{
                      whiteSpace:
                        "pre-wrap",
                    }}
                  >
                    {comment.content}
                  </div>
                </li>
              )
            )}
          </ul>
        )}

        <form
          onSubmit={
            handlePublicComment
          }
        >
          <label
            htmlFor="staff-public-comment"
            className="form-label"
          >
            Add Public Comment
          </label>

          <textarea
            id="staff-public-comment"
            className="form-control"
            rows={4}
            maxLength={2000}
            value={publicContent}
            disabled={operation !== null}
            onChange={(event) =>
              setPublicContent(
                event.target.value
              )
            }
          />

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2">
            <span className="small text-muted">
              Visible to Requester ·{" "}
              {publicContent.length}/2000
            </span>

            <button
              type="submit"
              className="btn"
              style={{
                backgroundColor:
                  zenGreen.primary,
                color: "white",
              }}
              disabled={
                operation !== null ||
                publicContent.trim()
                  .length === 0
              }
            >
              {operation ===
              "public-comment"
                ? "Posting…"
                : "Post Public Comment"}
            </button>
          </div>
        </form>
      </section>

      <section
        className="p-3 p-md-4 mb-3"
        style={internalPanelStyle}
        aria-labelledby="internal-notes-heading"
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <h2
            id="internal-notes-heading"
            className="h5 mb-0"
          >
            Internal Notes
          </h2>

          <span className="badge text-bg-warning">
            Internal — not visible to
            Requester
          </span>
        </div>

        <p className="small mt-2">
          Staff-only notes. These are never
          shown in the Requester Ticket
          Detail.
        </p>

        {ticket.internalNotes.length ===
        0 ? (
          <p className="text-muted">
            No Internal Notes yet.
          </p>
        ) : (
          <ul className="list-unstyled">
            {ticket.internalNotes.map(
              (note) => (
                <li
                  key={note.id}
                  className="border-top py-3"
                >
                  <div className="d-flex flex-wrap justify-content-between gap-2">
                    <strong>
                      {note.author.name}
                    </strong>
                    <time
                      className="small text-muted"
                      dateTime={
                        note.createdAt
                      }
                    >
                      {formatDate(
                        note.createdAt
                      )}
                    </time>
                  </div>

                  <div className="small text-muted mb-1">
                    {label(
                      note.author.role
                    )}
                  </div>

                  <div
                    style={{
                      whiteSpace:
                        "pre-wrap",
                    }}
                  >
                    {note.content}
                  </div>
                </li>
              )
            )}
          </ul>
        )}

        <form
          onSubmit={
            handleInternalNote
          }
        >
          <label
            htmlFor="staff-internal-note"
            className="form-label"
          >
            Add Internal Note
          </label>

          <textarea
            id="staff-internal-note"
            className="form-control"
            rows={4}
            maxLength={2000}
            value={internalContent}
            disabled={operation !== null}
            onChange={(event) =>
              setInternalContent(
                event.target.value
              )
            }
          />

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2">
            <span className="small">
              Internal — not visible to
              Requester ·{" "}
              {internalContent.length}
              /2000
            </span>

            <button
              type="submit"
              className="btn btn-warning"
              disabled={
                operation !== null ||
                internalContent.trim()
                  .length === 0
              }
            >
              {operation ===
              "internal-note"
                ? "Adding…"
                : "Add Internal Note"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
