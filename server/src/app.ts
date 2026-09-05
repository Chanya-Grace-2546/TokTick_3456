import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { getPrisma } from "./prisma.js";
import { validateCreateTicket } from "./validateCreateTicket.js";
import { createTicketWithGeneratedNumber } from "./ticketNumber.js";
import { upload, UPLOADS_DIR } from "./attachmentUpload.js";
const MAX_ACTIVE_ATTACHMENTS = 5;
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.


// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  // TODO(Issue 2): replace this stub with the required 200 response.
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Add:  GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message (no internal details)
// TODO(Issue 4): implement the route here.
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      where: { isActive: true },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch {
    res.status(500).json({ error: "Failed to load categories" });
  }
});
// ---------------------------------------------------------------------------
// Lab 2 Issue 2 — Development Requester Context
// GET /api/requesters -> active Development Requesters only (BR-05).
// This selector is a Lab 2 testing mechanism, not authentication.
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().developmentRequester.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.status(200).json(requesters);
  } catch {
    res.status(500).json({ error: "Failed to load development requesters" });
  }
});
// ---------------------------------------------------------------------------
// Lab 2 Issue 3 — Ticket Database and Reference Data
// GET /api/related-systems -> reference data for the Create Ticket dropdown
// (FR-13). No active/inactive concept for RelatedSystem in Lab 2 — all rows
// returned, matching how /api/categories already behaves.
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      orderBy: { id: "asc" },
      where: { isActive: true },
      select: { id: true, name: true },
    });
    res.status(200).json(relatedSystems);
  } catch {
    res.status(500).json({ error: "Failed to load related systems" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 Issue 5 — My Tickets
// GET /api/tickets -> paginated, searchable, filterable, sortable list
// scoped to requesterId (BR-08/BR-09 ownership). See api-spec.md §5.
// ---------------------------------------------------------------------------
const SORTABLE_FIELDS = ["ticketNumber", "createdAt", "updatedAt"] as const;

app.get("/api/tickets", async (req: Request, res: Response) => {
  const requesterId = Number(req.query.requesterId);
  if (!req.query.requesterId || Number.isNaN(requesterId)) {
    res.status(400).json({ error: "REQUESTER_ID_REQUIRED" });
    return;
  }

  const {
    search,
    category,
    requestedPriority,
    itPriority,
    currentStatus,
  } = req.query as Record<string, string | undefined>;

  // BR-12: default sort createdAt desc. Invalid values fall back silently.
  const sortBy = SORTABLE_FIELDS.includes(req.query.sortBy as typeof SORTABLE_FIELDS[number])
    ? (req.query.sortBy as typeof SORTABLE_FIELDS[number])
    : "createdAt";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

  // BR-13: page default 1, pageSize default 10 capped at 50. Invalid -> defaults.
  const pageParsed = Number(req.query.page);
  const page = Number.isInteger(pageParsed) && pageParsed > 0 ? pageParsed : 1;
  const pageSizeParsed = Number(req.query.pageSize);
  const pageSize =
    Number.isInteger(pageSizeParsed) && pageSizeParsed > 0
      ? Math.min(pageSizeParsed, 50)
      : 10;

  const where: Record<string, unknown> = { requesterId };

  // BR-10: search matches Ticket Number or Summary, case-insensitive.
  if (search) {
    where.OR = [
      { ticketNumber: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ];
  }
  // BR-11: filters combine with AND (each added key is already AND'd by Prisma).
  if (category) where.categoryId = Number(category);
  if (requestedPriority) where.requestedPriority = requestedPriority;
  if (itPriority) where.itPriority = itPriority;
  if (currentStatus) where.status = currentStatus;

  try {
    const prisma = getPrisma();

    const [rows, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: { select: { name: true } } },
      }),
      prisma.ticket.count({ where }),
    ]);

    const items = rows.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      category: t.category.name,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority,
      currentStatus: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    res.status(200).json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      noResults: totalItems === 0,
    });
  } catch (err) {
    console.error("Failed to list tickets:", err);
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
});


// ---------------------------------------------------------------------------
// Lab 2 Issue 4 — Ticket Creation
// POST /api/tickets -> validate, verify the Requester is active, generate
// the official Ticket Number (BR-01), and create the Ticket.
// requesterId travels in the request body per api-spec.md §4, not a header.
// ---------------------------------------------------------------------------
app.post("/api/tickets", async (req: Request, res: Response) => {
  const errors = validateCreateTicket(req.body);
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: "VALIDATION_FAILED", fields: errors });
    return;
  }

  const { requesterId, categoryId, relatedSystemId, summary, description, requestedPriority } =
    req.body as {
      requesterId: number;
      categoryId: number;
      relatedSystemId: number;
      summary: string;
      description: string;
      requestedPriority: "LOW" | "MEDIUM" | "HIGH";
    };

  const prisma = getPrisma();

  try {
    // BR-05: only an active Development Requester may create tickets.
    const requester = await prisma.developmentRequester.findUnique({
      where: { id: requesterId },
      select: { isActive: true },
    });
    if (!requester || !requester.isActive) {
      res.status(404).json({ error: "REQUESTER_NOT_FOUND" });
      return;
    }

    // Category / Related System must reference real rows (BR-16).
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findUnique({ where: { id: categoryId } }),
      prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } }),
    ]);
    if (!category) {
      res.status(400).json({ error: "VALIDATION_FAILED", fields: { categoryId: "Unknown Category" } });
      return;
    }
    if (!relatedSystem) {
      res.status(400).json({
        error: "VALIDATION_FAILED",
        fields: { relatedSystemId: "Unknown Related System" },
      });
      return;
    }

    // BR-18: reject an identical resubmission (same Requester, Summary,
    // Description) received within 5 seconds of the prior one.
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentDuplicate = await prisma.ticket.findFirst({
      where: {
        requesterId,
        summary: summary.trim(),
        description: description.trim(),
        createdAt: { gte: fiveSecondsAgo },
      },
    });
    if (recentDuplicate) {
      res.status(200).json(recentDuplicate);
      return;
    }

    const ticket = await createTicketWithGeneratedNumber({
      requesterId,
      categoryId,
      relatedSystemId,
      summary: summary.trim(),
      description: description.trim(),
      requestedPriority,
      status: "NEW",
    });

    res.status(201).json(ticket);
  } catch (err) {
    console.error("Failed to create ticket:", err);
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 Issue 6 — Ticket Detail + Attachments
// ---------------------------------------------------------------------------

// GET /api/tickets/:id -> one owned Ticket, plus its attachment metadata.
// api-spec.md §6: requesterId required as query param for ownership check.
// Not owned / doesn't exist -> same 404, never distinguished (BR-09).
app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const requesterId = Number(req.query.requesterId);

  if (Number.isNaN(ticketId) || !req.query.requesterId || Number.isNaN(requesterId)) {
    res.status(400).json({ error: "REQUESTER_ID_REQUIRED" });
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, requesterId },
      include: {
        category: { select: { name: true } },
        relatedSystem: { select: { name: true } },
        attachments: {
  select: {
    id: true,
    fileName: true,
    sizeBytes: true,
    mimeType: true,
    isRemoved: true,
    removedAt: true,
    removedReason: true,
    createdAt: true,
  },
},
      },
    });

    if (!ticket) {
      res.status(404).json({ error: "TICKET_NOT_FOUND" });
      return;
    }

    res.status(200).json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      requesterId: ticket.requesterId,
      category: ticket.category.name,
      relatedSystem: ticket.relatedSystem.name,
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      currentStatus: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      attachments: ticket.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        sizeBytes: a.sizeBytes,
        mimeType: a.mimeType,
        isRemoved: a.isRemoved,
        removedAt: a.removedAt,
        removedReason: a.removedReason,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error("Failed to load ticket:", err);
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
});

// GET /api/tickets/:id/attachments -> attachment metadata only (active + removed).
app.get("/api/tickets/:id/attachments", async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const requesterId = Number(req.query.requesterId);

  if (Number.isNaN(ticketId) || !req.query.requesterId || Number.isNaN(requesterId)) {
    res.status(400).json({ error: "REQUESTER_ID_REQUIRED" });
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId } });
    if (!ticket) {
      res.status(404).json({ error: "TICKET_NOT_FOUND" });
      return;
    }

    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json(
      attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        sizeBytes: a.sizeBytes,
        isRemoved: a.isRemoved,
        removedAt: a.removedAt,
        removedReason: a.removedReason,
        createdAt: a.createdAt,
      }))
    );
  } catch (err) {
    console.error("Failed to load attachments:", err);
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
});

// POST /api/tickets/:id/attachments -> upload an Attachment (multipart/form-data).
// Form fields: file (binary), requesterId.
app.post(
  "/api/tickets/:id/attachments",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const ticketId = Number(req.params.id);
    const requesterId = Number(req.body.requesterId);

    // Clean up the file multer already wrote to disk if validation fails
    // past this point, so rejected uploads don't leave orphan files.
    async function cleanupAndRespond(status: number, body: unknown) {
      if (req.file) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      res.status(status).json(body);
    }

    if (Number.isNaN(ticketId) || !req.body.requesterId || Number.isNaN(requesterId)) {
      await cleanupAndRespond(400, { error: "REQUESTER_ID_REQUIRED" });
      return;
    }
    if (!req.file) {
      await cleanupAndRespond(400, { error: "INVALID_FILE_TYPE" });
      return;
    }

    try {
      const prisma = getPrisma();
      const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId } });
      if (!ticket) {
        await cleanupAndRespond(404, { error: "TICKET_NOT_FOUND" });
        return;
      }

      // BR-22: max 5 ACTIVE attachments per Ticket (removed ones don't count).
      const activeCount = await prisma.attachment.count({
        where: { ticketId, isRemoved: false },
      });
      if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
        await cleanupAndRespond(400, { error: "MAX_ATTACHMENTS_REACHED" });
        return;
      }

      const attachment = await prisma.attachment.create({
        data: {
          ticketId,
          fileName: req.file.originalname,
          storedFileName: req.file.filename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
        },
      });

      res.status(201).json({
        id: attachment.id,
        fileName: attachment.fileName,
        sizeBytes: attachment.sizeBytes,
        mimeType: attachment.mimeType,
        isRemoved: false,
        createdAt: attachment.createdAt,
      });
    } catch (err) {
      console.error("Failed to save attachment:", err);
      await cleanupAndRespond(500, { error: "UNEXPECTED_ERROR" });
    }
  }
);

// Multer errors (wrong type / too large) land here, not in the route handler.
app.use((err: Error, req: Request, res: Response, next: (err?: Error) => void) => {
  if (err.message === "INVALID_FILE_TYPE") {
    res.status(400).json({ error: "INVALID_FILE_TYPE" });
    return;
  }
  if (err.name === "MulterError" && (err as { code?: string }).code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "FILE_TOO_LARGE" });
    return;
  }
  next(err);
});

// GET /api/attachments/:id/download -> stream an active Attachment's bytes.
app.get("/api/attachments/:id/download", async (req: Request, res: Response) => {
  const attachmentId = Number(req.params.id);
  const requesterId = Number(req.query.requesterId);

  if (Number.isNaN(attachmentId) || !req.query.requesterId || Number.isNaN(requesterId)) {
    res.status(400).json({ error: "REQUESTER_ID_REQUIRED" });
    return;
  }

  try {
    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true } } },
    });

    // BR-09-style ownership check: not owned or doesn't exist -> same 404.
    if (!attachment || attachment.ticket.requesterId !== requesterId) {
      res.status(404).json({ error: "ATTACHMENT_NOT_FOUND" });
      return;
    }
    // BR-27: a removed attachment cannot be downloaded, even though its
    // metadata is still visible elsewhere.
    if (attachment.isRemoved) {
      res.status(410).json({ error: "ATTACHMENT_REMOVED" });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, attachment.storedFileName);
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(attachment.fileName)}"`
    );
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error("Failed to download attachment:", err);
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
});

// PATCH /api/attachments/:id/remove -> soft-remove an Attachment (BR-26).
app.patch("/api/attachments/:id/remove", async (req: Request, res: Response) => {
  const attachmentId = Number(req.params.id);
  const { requesterId, reason } = req.body as { requesterId?: number; reason?: string };

  if (!requesterId || Number.isNaN(Number(requesterId))) {
    res.status(400).json({ error: "REQUESTER_ID_REQUIRED" });
    return;
  }
  if (!reason || !reason.trim()) {
    res.status(400).json({ error: "REASON_REQUIRED" });
    return;
  }

  try {
    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true } } },
    });

    if (!attachment || attachment.ticket.requesterId !== Number(requesterId)) {
      res.status(404).json({ error: "ATTACHMENT_NOT_FOUND" });
      return;
    }
    if (attachment.removedAt) {
      res.status(409).json({ error: "ALREADY_REMOVED" });
      return;
    }

    const updated = await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
  isRemoved: true,
  removedAt: new Date(),
  removedReason: reason.trim(),
},
    });

    res.status(200).json({
      id: updated.id,
      isRemoved: true,
      removedAt: updated.removedAt,
      removedReason: updated.removedReason,
    });
  } catch (err) {
    console.error("Failed to remove attachment:", err);
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
});


export default app;
