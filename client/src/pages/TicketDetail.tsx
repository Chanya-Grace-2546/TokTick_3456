import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";
import {
  AttachmentMeta,
  AttachmentUploadError,
  PublicComment,
  TicketDetailData,
  TicketNotFoundError,
  createPublicComment,
  downloadAttachment,
  fetchPublicComments,
  fetchTicketDetail,
  markProblemAppearsResolved,
  removeAttachment,
  uploadAttachment,
} from "../api.js";

const MAX_ACTIVE_ATTACHMENTS = 5;
const MAX_COMMENT_LENGTH = 2000;

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function priorityColor(priority: string) {
  switch (priority) {
    case "HIGH":
      return "#b42318";
    case "MEDIUM":
      return "#b8860b";
    case "LOW":
      return "#526d5c";
    default:
      return "#526d5c";
  }
}

function statusColor(status: string) {
  switch (status) {
    case "RESOLVED":
    case "CLOSED":
      return "#526d5c";

    case "CANCELLED":
      return "#6c757d";

    default:
      return "#0b7a46";
  }
}

export default function TicketDetail() {
  const { id } = useParams();

  const ticketId = Number(id);

  const [
    ticket,
    setTicket,
  ] =
    useState<TicketDetailData | null>(
      null
    );

  const [
    comments,
    setComments,
  ] = useState<
    PublicComment[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    commentLoading,
    setCommentLoading,
  ] = useState(true);

  const [
    commentLoadError,
    setCommentLoadError,
  ] = useState("");

  const [
    commentText,
    setCommentText,
  ] = useState("");

  const [
    commentError,
    setCommentError,
  ] = useState("");

  const [
    postingComment,
    setPostingComment,
  ] = useState(false);

  const [
    resolving,
    setResolving,
  ] = useState(false);

  const [
    resolutionError,
    setResolutionError,
  ] = useState("");

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    attachmentError,
    setAttachmentError,
  ] = useState("");

  const loadTicket =
    useCallback(async () => {
      if (
        !Number.isInteger(
          ticketId
        ) ||
        ticketId <= 0
      ) {
        setLoadError(
          "Ticket not found."
        );
        setLoading(false);
        return;
      }

      try {
        setLoadError("");

        const data =
          await fetchTicketDetail(
            ticketId
          );

        setTicket(data);
      } catch (error) {
  if (
    error instanceof
    TicketNotFoundError
  ) {
    setLoadError(
      "This ticket doesn't exist or isn't available."
    );
  } else {
    setLoadError(
      "Could not load this ticket. Please try again."
    );
  }
} finally {
        setLoading(false);
      }
    }, [ticketId]);

  const loadComments =
    useCallback(async () => {
      if (
        !Number.isInteger(
          ticketId
        ) ||
        ticketId <= 0
      ) {
        setCommentLoading(
          false
        );
        return;
      }

      try {
        setCommentLoadError(
          ""
        );

        const result =
          await fetchPublicComments(
            ticketId
          );

        setComments(
          result.items
        );
      } catch {
        setCommentLoadError(
          "Could not load Public Comments."
        );
      } finally {
        setCommentLoading(
          false
        );
      }
    }, [ticketId]);

  useEffect(() => {
    void loadTicket();
    void loadComments();
  }, [
    loadTicket,
    loadComments,
  ]);

  async function handleCommentSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    const trimmed =
      commentText.trim();

    if (!trimmed) {
      setCommentError(
        "Comment is required."
      );
      return;
    }

    if (
      trimmed.length >
      MAX_COMMENT_LENGTH
    ) {
      setCommentError(
        "Comment must be 2000 characters or fewer."
      );
      return;
    }

    setCommentError("");
    setPostingComment(true);

    try {
      const comment =
        await createPublicComment(
          ticketId,
          trimmed
        );

      setComments(
        (current) => [
          ...current,
          comment,
        ]
      );

      setCommentText("");

      setTicket(
        (current) =>
          current
            ? {
                ...current,
                requesterResolvedAt:
                  null,
                requesterResolvedById:
                  null,
              }
            : current
      );
    } catch {
      setCommentError(
        "Could not post comment. Please try again."
      );
    } finally {
      setPostingComment(
        false
      );
    }
  }

  async function handleProblemAppearsResolved() {
    setResolutionError(
      ""
    );
    setResolving(true);

    try {
      const result =
        await markProblemAppearsResolved(
          ticketId
        );

      setTicket(
        (current) =>
          current
            ? {
                ...current,
                requesterResolvedAt:
                  result.requesterResolvedAt,
                requesterResolvedById:
                  current.requesterId,
                currentStatus:
                  result.status,
              }
            : current
      );
    } catch {
      setResolutionError(
        "Could not save the resolution indication. Please try again."
      );
    } finally {
      setResolving(false);
    }
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file || !ticket) {
      return;
    }

    setAttachmentError(
      ""
    );

    const activeCount =
      ticket.attachments.filter(
        (attachment) =>
          !attachment.isRemoved
      ).length;

    if (
      activeCount >=
      MAX_ACTIVE_ATTACHMENTS
    ) {
      setAttachmentError(
        "Maximum of 5 active attachments reached."
      );
      return;
    }

    setUploading(true);

    try {
      const attachment =
        await uploadAttachment(
          ticket.id,
          file
        );

      setTicket(
        (current) =>
          current
            ? {
                ...current,
                attachments: [
                  ...current.attachments,
                  attachment,
                ],
              }
            : current
      );
    } catch (error) {
      if (
        error instanceof
        AttachmentUploadError
      ) {
        switch (error.code) {
          case "INVALID_FILE_TYPE":
            setAttachmentError(
              "Invalid attachment type. Use JPG, JPEG, PNG, WEBP, or PDF."
            );
            break;

          case "FILE_TOO_LARGE":
            setAttachmentError(
              "Attachment is too large."
            );
            break;

          case "MAX_ATTACHMENTS_REACHED":
            setAttachmentError(
              "Maximum of 5 active attachments reached."
            );
            break;

          default:
            setAttachmentError(
              "Could not upload attachment. Please try again."
            );
        }
      } else {
        setAttachmentError(
          "Could not upload attachment. Please try again."
        );
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDownloadAttachment(
    attachment: AttachmentMeta
  ) {
    setAttachmentError("");

    try {
      const blob =
        await downloadAttachment(
          attachment.id
        );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement(
          "a"
        );

      link.href = url;
      link.download =
        attachment.fileName;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      URL.revokeObjectURL(
        url
      );
    } catch {
      setAttachmentError(
        "Could not download attachment. Please try again."
      );
    }
  }

  async function handleRemoveAttachment(
    attachment: AttachmentMeta
  ) {
    const reason =
      window.prompt(
        "Reason for removing this attachment:"
      );

    if (
      reason === null
    ) {
      return;
    }

    if (!reason.trim()) {
      setAttachmentError(
        "Removal reason is required."
      );
      return;
    }

    setAttachmentError(
      ""
    );

    try {
      const result =
        await removeAttachment(
          attachment.id,
          reason.trim()
        );

      setTicket(
        (current) =>
          current
            ? {
                ...current,
                attachments:
                  current.attachments.map(
                    (item) =>
                      item.id ===
                      attachment.id
                        ? {
                            ...item,
                            isRemoved:
                              true,
                            removedAt:
                              result.removedAt,
                            removedReason:
                              result.removedReason,
                          }
                        : item
                  ),
              }
            : current
      );
    } catch {
      setAttachmentError(
        "Could not remove attachment. Please try again."
      );
    }
  }

  if (loading) {
    return (
      <div
        className="container py-5 text-center"
        role="status"
      >
        Loading ticket...
      </div>
    );
  }

  if (
    loadError ||
    !ticket
  ) {
    return (
      <div
        className="container py-5"
        style={{
          maxWidth: 840,
        }}
      >
        <Link
          to="/tickets"
          className="d-inline-block mb-3 small"
        >
          ← Back to My Tickets
        </Link>

        <div
          className="alert alert-danger"
          role="alert"
        >
          {loadError ||
            "Ticket not found."}
        </div>
      </div>
    );
  }

  const activeAttachmentCount =
    ticket.attachments.filter(
      (attachment) =>
        !attachment.isRemoved
    ).length;

  return (
    <div
      className="container py-5"
      style={{
        maxWidth: 840,
      }}
    >
      <Link
        to="/tickets"
        className="d-inline-block mb-3 small"
      >
        ← Back to My Tickets
      </Link>

      <div
        className="p-4 mb-4"
        style={{
          backgroundColor:
            "white",
          border:
            "1px solid #e0e5e2",
          borderRadius: 8,
          boxShadow:
            "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">
              Ticket No.
            </div>

            <div className="fw-bold">
              {
                ticket.ticketNumber
              }
            </div>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">
              Ticket Date
            </div>

            <div>
              {formatDate(
                ticket.createdAt
              )}
            </div>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">
              Category
            </div>

            <div>
              {
                ticket.category
              }
            </div>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">
              Related System
            </div>

            <div>
              {
                ticket.relatedSystem
              }
            </div>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">
              Requested Priority
            </div>

            <span
              className="badge"
              style={{
                backgroundColor:
                  priorityColor(
                    ticket.requestedPriority
                  ),
              }}
            >
              {
                ticket.requestedPriority
              }
            </span>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">
              IT Priority
            </div>

            <div>
              {
                ticket.itPriority
              }
            </div>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <div className="text-muted small">
              Current Status
            </div>

            <span
              className="badge"
              style={{
                backgroundColor:
                  statusColor(
                    ticket.currentStatus
                  ),
              }}
            >
              {formatLabel(
                ticket.currentStatus
              )}
            </span>
          </div>
        </div>

        <div className="mb-3">
          <div className="text-muted small">
            Summary
          </div>

          <div>
            {ticket.summary}
          </div>
        </div>

        <div>
          <div className="text-muted small">
            Description
          </div>

          <div
            style={{
              whiteSpace:
                "pre-wrap",
            }}
          >
            {
              ticket.description
            }
          </div>
        </div>
      </div>

      <div
        className="p-4 mb-4"
        style={{
          backgroundColor:
            "white",
          border:
            "1px solid #e0e5e2",
          borderRadius: 8,
          boxShadow:
            "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
          <div>
            <h2
              className="h5 mb-1"
              style={{
                color:
                  "#1f2e27",
              }}
            >
              Problem Status
            </h2>

            <div className="text-muted small">
              This indication does
              not formally resolve
              or close the ticket.
            </div>
          </div>

          {!ticket.requesterResolvedAt && (
            <button
              type="button"
              className="btn btn-outline-success"
              disabled={
                resolving
              }
              onClick={() =>
                void handleProblemAppearsResolved()
              }
            >
              {resolving
                ? "Saving..."
                : "Problem Appears Resolved"}
            </button>
          )}
        </div>

        {ticket.requesterResolvedAt && (
          <div
            className="alert alert-success mb-0"
            role="status"
          >
            You indicated that this
            problem appears resolved.
            The IT team still controls
            the formal Ticket status.
          </div>
        )}

        {resolutionError && (
          <div
            className="alert alert-danger mt-3 mb-0"
            role="alert"
          >
            {resolutionError}
          </div>
        )}
      </div>

      <div
        className="p-4 mb-4"
        style={{
          backgroundColor:
            "white",
          border:
            "1px solid #e0e5e2",
          borderRadius: 8,
          boxShadow:
            "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <h2
          className="h5 mb-3"
          style={{
            color:
              "#1f2e27",
          }}
        >
          Public Comments
        </h2>

        {commentLoading ? (
          <p className="text-muted">
            Loading comments...
          </p>
        ) : commentLoadError ? (
          <div className="text-danger mb-3">
            {commentLoadError}
          </div>
        ) : comments.length ===
          0 ? (
          <p className="text-muted">
            No Public Comments
            yet.
          </p>
        ) : (
          <div className="mb-4">
            {comments.map(
              (comment) => (
                <div
                  key={
                    comment.id
                  }
                  className="border rounded p-3 mb-2"
                >
                  <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                    <strong>
                      {
                        comment
                          .author
                          .name
                      }
                    </strong>

                    <span className="badge text-bg-light">
                      {formatLabel(
                        comment
                          .author
                          .role
                      )}
                    </span>

                    <span className="text-muted small">
                      {formatDateTime(
                        comment.createdAt
                      )}
                    </span>
                  </div>

                  <div
                    style={{
                      whiteSpace:
                        "pre-wrap",
                    }}
                  >
                    {
                      comment.content
                    }
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <form
          onSubmit={
            handleCommentSubmit
          }
        >
          <div className="mb-2">
            <label
              htmlFor="public-comment"
              className="form-label"
            >
              Public Comment
            </label>

            <textarea
              id="public-comment"
              className="form-control"
              rows={4}
              maxLength={
                MAX_COMMENT_LENGTH +
                1
              }
              value={
                commentText
              }
              disabled={
                postingComment
              }
              onChange={(
                event
              ) => {
                setCommentText(
                  event.target
                    .value
                );

                if (
                  commentError
                ) {
                  setCommentError(
                    ""
                  );
                }
              }}
            />
          </div>

          <div className="d-flex justify-content-between align-items-center gap-3">
            <small className="text-muted">
              {
                commentText.length
              }
              /
              {
                MAX_COMMENT_LENGTH
              }
            </small>

            <button
              type="submit"
              className="btn btn-success"
              disabled={
                postingComment
              }
            >
              {postingComment
                ? "Posting..."
                : "Post Comment"}
            </button>
          </div>

          {commentError && (
            <div
              className="alert alert-danger mt-3 mb-0"
              role="alert"
            >
              {commentError}
            </div>
          )}
        </form>
      </div>

      <div
        className="p-4"
        style={{
          backgroundColor:
            "white",
          border:
            "1px solid #e0e5e2",
          borderRadius: 8,
          boxShadow:
            "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2
            className="h5 mb-0"
            style={{
              color:
                "#1f2e27",
            }}
          >
            Attachments (
            {
              activeAttachmentCount
            }
            /
            {
              MAX_ACTIVE_ATTACHMENTS
            }
            )
          </h2>

          <div>
            <input
              id="attachment-file"
              type="file"
              className="d-none"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              disabled={
                uploading ||
                activeAttachmentCount >=
                  MAX_ACTIVE_ATTACHMENTS
              }
              onChange={(
                event
              ) =>
                void handleFileChange(
                  event
                )
              }
            />

            <label
              htmlFor="attachment-file"
              className="btn btn-sm"
              style={{
                backgroundColor:
                  "#006b3c",
                color: "white",
                opacity:
                  uploading ||
                  activeAttachmentCount >=
                    MAX_ACTIVE_ATTACHMENTS
                    ? 0.65
                    : 1,
                cursor:
                  uploading ||
                  activeAttachmentCount >=
                    MAX_ACTIVE_ATTACHMENTS
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {uploading
                ? "Uploading..."
                : "+ Add Attachment"}
            </label>
          </div>
        </div>

        {attachmentError && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {attachmentError}
          </div>
        )}

        {ticket.attachments
          .length === 0 ? (
          <p className="text-muted">
            No attachments yet.
          </p>
        ) : (
          <div className="d-flex flex-column gap-2">
            {ticket.attachments.map(
              (attachment) => (
                <div
                  key={
                    attachment.id
                  }
                  className="border rounded p-3"
                >
                  <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                    <div>
                      <div className="fw-semibold">
                        {
                          attachment.fileName
                        }
                      </div>

                      <div className="text-muted small">
                        {Math.ceil(
                          attachment.sizeBytes /
                            1024
                        )}{" "}
                        KB
                      </div>

                      {attachment.isRemoved && (
                        <div className="text-danger small mt-1">
                          Removed
                          {attachment.removedReason
                            ? ` — ${attachment.removedReason}`
                            : ""}
                        </div>
                      )}
                    </div>

                    <div className="d-flex gap-2 align-items-start">
                      {!attachment.isRemoved && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() =>
                              void handleDownloadAttachment(
                                attachment
                              )
                            }
                          >
                            Download
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              void handleRemoveAttachment(
                                attachment
                              )
                            }
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}