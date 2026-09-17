import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";

import { getPrisma } from "./prisma.js";
import { validateCreateTicket } from "./validateCreateTicket.js";
import { createTicketWithGeneratedNumber } from "./ticketNumber.js";
import { upload, UPLOADS_DIR } from "./attachmentUpload.js";
import {
  AuthenticatedRequest,
  generateSessionToken,
  hashSessionToken,
  requireAuth,
  requirePasswordChanged,
  requireRole,
  requireSameOrigin,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  sessionCookieOptions,
} from "./auth.js";

const MAX_ACTIVE_ATTACHMENTS = 5;

// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4).

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  // TODO(Issue 2): replace this stub with the required 200 response.
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Add: GET /api/categories
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
      select: {
        id: true,
        name: true,
      },
    });

    res.status(200).json(categories);
  } catch {
    res.status(500).json({
      error: "Failed to load categories",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 Issue 2 — Development Requester Context
// GET /api/requesters -> active Development Requesters only (BR-05).
//
// Lab 3 replaces the temporary Requester selector with authentication.
// This legacy endpoint is kept temporarily for Lab 2 regression coverage.
// The Lab 3 client must not use it to choose the authenticated Requester.
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().user.findMany({
      where: {
        isActive: true,
        role: "REQUESTER",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json(requesters);
  } catch {
    res.status(500).json({
      error: "Failed to load development requesters",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 3 Issue 3 — Authentication
// ---------------------------------------------------------------------------

// POST /api/auth/login
// Verify email/password and create an opaque server-side Session.
// Only the raw session token is placed in the HttpOnly cookie.
// The database stores only the SHA-256 hash of that token.
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email?.trim() || !password) {
    res.status(400).json({
      error: "EMAIL_AND_PASSWORD_REQUIRED",
    });
    return;
  }

  try {
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    // Use the same public response for an unknown email, wrong password,
    // and inactive account so the endpoint does not reveal account status.
    if (!user || !user.isActive) {
      res.status(401).json({
        error: "INVALID_CREDENTIALS",
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      res.status(401).json({
        error: "INVALID_CREDENTIALS",
      });
      return;
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + SESSION_DURATION_MS
    );

    await prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    res.cookie(
      SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions()
    );

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);

    res.status(500).json({
      error: "UNEXPECTED_ERROR",
    });
  }
});

// POST /api/auth/logout
// Invalidate the current server-side Session and clear its cookie.
app.post(
  "/api/auth/logout",
  requireAuth,
  requireSameOrigin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prisma = getPrisma();

      if (req.sessionId) {
  await prisma.session.updateMany({
    where: {
      id: req.sessionId,
      invalidatedAt: null,
    },
    data: {
      invalidatedAt: new Date(),
    },
  });
}
      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });

      res.status(200).json({
        success: true,
      });
    } catch (error) {
      console.error("Logout failed:", error);

      res.status(500).json({
        error: "UNEXPECTED_ERROR",
      });
    }
  }
);

// GET /api/auth/me
// Return the active User represented by the current Session.
app.get(
  "/api/auth/me",
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      user: req.authUser,
    });
  }
);

// POST /api/auth/change-password
// Verify the current password, enforce the Lab 3 password policy,
// replace the password hash, clear mustChangePassword, and invalidate
// every other Session while keeping the current Session authenticated.
app.post(
  "/api/auth/change-password",
  requireAuth,
  requireSameOrigin,
  async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        error: "CURRENT_AND_NEW_PASSWORD_REQUIRED",
      });
      return;
    }

    const passwordValid =
      newPassword.length >= 10 &&
      newPassword.length <= 72 &&
      /[a-z]/.test(newPassword) &&
      /[A-Z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[^A-Za-z0-9]/.test(newPassword);

    if (!passwordValid) {
      res.status(400).json({
        error: "PASSWORD_REQUIREMENTS_NOT_MET",
      });
      return;
    }

    try {
      const prisma = getPrisma();

      const user = await prisma.user.findUnique({
        where: {
          id: req.authUser!.id,
        },
      });

      if (!user) {
        res.status(401).json({
          error: "UNAUTHENTICATED",
        });
        return;
      }

      const currentMatches = await bcrypt.compare(
        currentPassword,
        user.passwordHash
      );

      if (!currentMatches) {
        res.status(400).json({
          error: "CURRENT_PASSWORD_INCORRECT",
        });
        return;
      }

      const samePassword = await bcrypt.compare(
        newPassword,
        user.passwordHash
      );

      if (samePassword) {
        res.status(400).json({
          error: "NEW_PASSWORD_MUST_BE_DIFFERENT",
        });
        return;
      }

      const passwordHash = await bcrypt.hash(
        newPassword,
        12
      );

      await prisma.$transaction([
        prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            passwordHash,
            mustChangePassword: false,
          },
        }),

        // BR-08: keep the current Session authenticated after the password
// change, while invalidating every other Session for this User.
prisma.session.updateMany({
  where: {
    userId: user.id,
    id: {
      not: req.sessionId!,
    },
    invalidatedAt: null,
  },
  data: {
    invalidatedAt: new Date(),
  },
}),
      ]);

      res.status(200).json({
        success: true,
      });
    } catch (error) {
      console.error(
        "Password change failed:",
        error
      );

      res.status(500).json({
        error: "UNEXPECTED_ERROR",
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 Issue 3 — Ticket Database and Reference Data
// GET /api/related-systems -> reference data for the Create Ticket dropdown
// (FR-13). No active/inactive concept for RelatedSystem in Lab 2 — all rows
// returned, matching how /api/categories already behaves.
// ---------------------------------------------------------------------------
app.get(
  "/api/related-systems",
  async (_req: Request, res: Response) => {
    try {
      const relatedSystems =
        await getPrisma().relatedSystem.findMany({
          orderBy: {
            id: "asc",
          },
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
          },
        });

      res.status(200).json(relatedSystems);
    } catch {
      res.status(500).json({
        error: "Failed to load related systems",
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 Issue 5 — My Tickets
// GET /api/tickets -> paginated, searchable, filterable, sortable list.
//
// Lab 3 authentication change:
// The Requester identity no longer comes from requesterId in the query.
// It comes from the authenticated Session (req.authUser.id).
// BR-08/BR-09 ownership still applies.
// ---------------------------------------------------------------------------
const SORTABLE_FIELDS = [
  "ticketNumber",
  "createdAt",
  "updatedAt",
] as const;

app.get(
  "/api/tickets",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const requesterId =
      req.authUser!.id;

    const {
      search,
      category,
      requestedPriority,
      itPriority,
      currentStatus,
    } = req.query as Record<
      string,
      string | undefined
    >;

    // BR-12: default sort createdAt desc. Invalid values fall back silently.
    const sortBy =
      SORTABLE_FIELDS.includes(
        req.query.sortBy as
          (typeof SORTABLE_FIELDS)[number]
      )
        ? (req.query.sortBy as
            (typeof SORTABLE_FIELDS)[number])
        : "createdAt";

    const sortDir =
      req.query.sortDir === "asc"
        ? "asc"
        : "desc";

    // BR-13: page default 1, pageSize default 10 capped at 50.
    // Invalid values fall back to defaults.
    const pageParsed = Number(
      req.query.page
    );

    const page =
      Number.isInteger(pageParsed) &&
      pageParsed > 0
        ? pageParsed
        : 1;

    const pageSizeParsed = Number(
      req.query.pageSize
    );

    const pageSize =
      Number.isInteger(
        pageSizeParsed
      ) && pageSizeParsed > 0
        ? Math.min(
            pageSizeParsed,
            50
          )
        : 10;

    const where: Record<
      string,
      unknown
    > = {
      requesterId,
    };

    // BR-10: search matches Ticket Number or Summary, case-insensitive.
    if (search) {
      where.OR = [
        {
          ticketNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          summary: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    // BR-11: filters combine with AND
    // (each added key is already AND'd by Prisma).
    if (category) {
      where.categoryId =
        Number(category);
    }

    if (requestedPriority) {
      where.requestedPriority =
        requestedPriority;
    }

    if (itPriority) {
      where.itPriority =
        itPriority;
    }

    if (currentStatus) {
      where.status =
        currentStatus;
    }

    try {
      const prisma = getPrisma();

      const [rows, totalItems] =
        await Promise.all([
          prisma.ticket.findMany({
            where,
            orderBy: {
              [sortBy]: sortDir,
            },
            skip:
              (page - 1) *
              pageSize,
            take: pageSize,
            include: {
              category: {
                select: {
                  name: true,
                },
              },
            },
          }),

          prisma.ticket.count({
            where,
          }),
        ]);

      const items = rows.map(
        (ticket) => ({
          id: ticket.id,
          ticketNumber:
            ticket.ticketNumber,
          summary: ticket.summary,
          category:
            ticket.category.name,
          requestedPriority:
            ticket.requestedPriority,
          itPriority:
            ticket.itPriority,
          currentStatus:
            ticket.status,
          createdAt:
            ticket.createdAt,
          updatedAt:
            ticket.updatedAt,
        })
      );

      res.status(200).json({
        items,
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(
          1,
          Math.ceil(
            totalItems / pageSize
          )
        ),
        noResults:
          totalItems === 0,
      });
    } catch (err) {
      console.error(
        "Failed to list tickets:",
        err
      );

      res.status(500).json({
        error: "UNEXPECTED_ERROR",
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 Issue 4 — Ticket Creation
// POST /api/tickets -> validate reference/form data, generate the official
// Ticket Number (BR-01), and create the Ticket.
//
// Lab 3 authentication change:
// Requester identity comes from the authenticated Session.
// The client must not choose or submit requesterId.
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets",
  requireAuth,
  requireSameOrigin,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const errors =
      validateCreateTicket(
        req.body
      );

    if (
      Object.keys(errors).length >
      0
    ) {
      res.status(400).json({
        error:
          "VALIDATION_FAILED",
        fields: errors,
      });
      return;
    }

    const {
      categoryId,
      relatedSystemId,
      summary,
      description,
      requestedPriority,
    } = req.body as {
      categoryId: number;
      relatedSystemId: number;
      summary: string;
      description: string;
      requestedPriority:
        | "LOW"
        | "MEDIUM"
        | "HIGH";
    };

    // Lab 3: identity is trusted only from the authenticated Session.
    const requesterId =
      req.authUser!.id;

    const prisma = getPrisma();

    try {
      // Category / Related System must reference real active rows (BR-16).
      const [
        category,
        relatedSystem,
      ] = await Promise.all([
        prisma.category.findFirst({
          where: {
            id: categoryId,
            isActive: true,
          },
        }),

        prisma.relatedSystem.findFirst({
          where: {
            id: relatedSystemId,
            isActive: true,
          },
        }),
      ]);

      if (!category) {
        res.status(400).json({
          error:
            "VALIDATION_FAILED",
          fields: {
            categoryId:
              "Unknown Category",
          },
        });
        return;
      }

      if (!relatedSystem) {
        res.status(400).json({
          error:
            "VALIDATION_FAILED",
          fields: {
            relatedSystemId:
              "Unknown Related System",
          },
        });
        return;
      }

      // BR-18: reject an identical resubmission
      // (same Requester, Summary, Description) received within
      // 5 seconds of the prior one.
      const fiveSecondsAgo =
        new Date(
          Date.now() - 5000
        );

      const recentDuplicate =
        await prisma.ticket.findFirst(
          {
            where: {
              requesterId,
              summary:
                summary.trim(),
              description:
                description.trim(),
              createdAt: {
                gte: fiveSecondsAgo,
              },
            },
          }
        );

      if (recentDuplicate) {
        res
          .status(200)
          .json(recentDuplicate);
        return;
      }

      const ticket =
        await createTicketWithGeneratedNumber(
          {
            requesterId,
            categoryId,
            relatedSystemId,
            summary:
              summary.trim(),
            description:
              description.trim(),
            requestedPriority,
            status: "NEW",
          }
        );

      // Lab 3 requirement:
      // initial IT Priority copies the Requester's Requested Priority.
      //
      // createTicketWithGeneratedNumber is still the Lab 2 helper, so update
      // the newly-created row here without changing that helper in Issue 3.
      const ticketWithPriority =
        await prisma.ticket.update({
          where: {
            id: ticket.id,
          },
          data: {
            itPriority:
              requestedPriority,
          },
        });

      res
        .status(201)
        .json(ticketWithPriority);
    } catch (err) {
      console.error(
        "Failed to create ticket:",
        err
      );

      res.status(500).json({
        error: "UNEXPECTED_ERROR",
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 Issue 6 — Ticket Detail + Attachments
// ---------------------------------------------------------------------------

// GET /api/tickets/:id -> one owned Ticket, plus its attachment metadata.
//
// Lab 3 authentication change:
// requesterId is taken from the authenticated Session.
// Not owned / doesn't exist -> same 404, never distinguished (BR-09).
app.get(
  "/api/tickets/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const ticketId = Number(
      req.params.id
    );

    const requesterId =
      req.authUser!.id;

    if (
      Number.isNaN(ticketId)
    ) {
      res.status(400).json({
        error:
          "INVALID_TICKET_ID",
      });
      return;
    }

    try {
      const prisma = getPrisma();

      const ticket =
        await prisma.ticket.findFirst(
          {
            where: {
              id: ticketId,
              requesterId,
            },
            include: {
              category: {
                select: {
                  name: true,
                },
              },
              relatedSystem: {
                select: {
                  name: true,
                },
              },
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
          }
        );

      if (!ticket) {
        res.status(404).json({
          error:
            "TICKET_NOT_FOUND",
        });
        return;
      }

      res.status(200).json({
        id: ticket.id,
        ticketNumber:
          ticket.ticketNumber,
        requesterId:
          ticket.requesterId,
        category:
          ticket.category.name,
        relatedSystem:
          ticket.relatedSystem.name,
        summary:
          ticket.summary,
        description:
          ticket.description,
        requestedPriority:
          ticket.requestedPriority,
        itPriority:
          ticket.itPriority,
        currentStatus:
          ticket.status,
        createdAt:
          ticket.createdAt,
        updatedAt:
          ticket.updatedAt,
        attachments:
          ticket.attachments.map(
            (attachment) => ({
              id:
                attachment.id,
              fileName:
                attachment.fileName,
              sizeBytes:
                attachment.sizeBytes,
              mimeType:
                attachment.mimeType,
              isRemoved:
                attachment.isRemoved,
              removedAt:
                attachment.removedAt,
              removedReason:
                attachment.removedReason,
              createdAt:
                attachment.createdAt,
            })
          ),
      });
    } catch (err) {
      console.error(
        "Failed to load ticket:",
        err
      );

      res.status(500).json({
        error: "UNEXPECTED_ERROR",
      });
    }
  }
);

// GET /api/tickets/:id/attachments -> attachment metadata only
// (active + removed).
//
// Lab 3: ownership is checked using the authenticated Requester.
app.get(
  "/api/tickets/:id/attachments",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const ticketId = Number(
      req.params.id
    );

    const requesterId =
      req.authUser!.id;

    if (
      Number.isNaN(ticketId)
    ) {
      res.status(400).json({
        error:
          "INVALID_TICKET_ID",
      });
      return;
    }

    try {
      const prisma = getPrisma();

      const ticket =
        await prisma.ticket.findFirst(
          {
            where: {
              id: ticketId,
              requesterId,
            },
          }
        );

      if (!ticket) {
        res.status(404).json({
          error:
            "TICKET_NOT_FOUND",
        });
        return;
      }

      const attachments =
        await prisma.attachment.findMany(
          {
            where: {
              ticketId,
            },
            orderBy: {
              createdAt: "asc",
            },
          }
        );

      res.status(200).json(
        attachments.map(
          (attachment) => ({
            id:
              attachment.id,
            fileName:
              attachment.fileName,
            sizeBytes:
              attachment.sizeBytes,
            mimeType:
              attachment.mimeType,
            isRemoved:
              attachment.isRemoved,
            removedAt:
              attachment.removedAt,
            removedReason:
              attachment.removedReason,
            createdAt:
              attachment.createdAt,
          })
        )
      );
    } catch (err) {
      console.error(
        "Failed to load attachments:",
        err
      );

      res.status(500).json({
        error: "UNEXPECTED_ERROR",
      });
    }
  }
);

// POST /api/tickets/:id/attachments -> upload an Attachment
// (multipart/form-data).
//
// Form field: file (binary).
// Lab 3: requesterId is not accepted from the form.
// Requester identity comes from the authenticated Session.
app.post(
  "/api/tickets/:id/attachments",
  requireAuth,
  requireSameOrigin,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  upload.single("file"),
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const ticketId = Number(
      req.params.id
    );

    const requesterId =
      req.authUser!.id;

    // Clean up the file multer already wrote to disk if validation fails
    // past this point, so rejected uploads don't leave orphan files.
    async function cleanupAndRespond(
      status: number,
      body: unknown
    ) {
      if (req.file) {
        await fs.promises
          .unlink(req.file.path)
          .catch(() => {});
      }

      res.status(status).json(
        body
      );
    }

    if (
      Number.isNaN(ticketId)
    ) {
      await cleanupAndRespond(
        400,
        {
          error:
            "INVALID_TICKET_ID",
        }
      );
      return;
    }

    if (!req.file) {
      await cleanupAndRespond(
        400,
        {
          error:
            "INVALID_FILE_TYPE",
        }
      );
      return;
    }

    try {
      const prisma = getPrisma();

      const ticket =
        await prisma.ticket.findFirst(
          {
            where: {
              id: ticketId,
              requesterId,
            },
          }
        );

      if (!ticket) {
        await cleanupAndRespond(
          404,
          {
            error:
              "TICKET_NOT_FOUND",
          }
        );
        return;
      }

      // BR-22: max 5 ACTIVE attachments per Ticket
      // (removed ones don't count).
      const activeCount =
        await prisma.attachment.count(
          {
            where: {
              ticketId,
              isRemoved: false,
            },
          }
        );

      if (
        activeCount >=
        MAX_ACTIVE_ATTACHMENTS
      ) {
        await cleanupAndRespond(
          400,
          {
            error:
              "MAX_ATTACHMENTS_REACHED",
          }
        );
        return;
      }

      const attachment =
        await prisma.attachment.create(
          {
            data: {
              ticketId,
              fileName:
                req.file
                  .originalname,
              storedFileName:
                req.file.filename,
              mimeType:
                req.file.mimetype,
              sizeBytes:
                req.file.size,
            },
          }
        );

      res.status(201).json({
        id: attachment.id,
        fileName:
          attachment.fileName,
        sizeBytes:
          attachment.sizeBytes,
        mimeType:
          attachment.mimeType,
        isRemoved: false,
        createdAt:
          attachment.createdAt,
      });
    } catch (err) {
      console.error(
        "Failed to save attachment:",
        err
      );

      await cleanupAndRespond(
        500,
        {
          error:
            "UNEXPECTED_ERROR",
        }
      );
    }
  }
);

// Multer errors (wrong type / too large) land here,
// not in the route handler.
app.use(
  (
    err: Error,
    req: Request,
    res: Response,
    next: (err?: Error) => void
  ) => {
    if (
      err.message ===
      "INVALID_FILE_TYPE"
    ) {
      res.status(400).json({
        error:
          "INVALID_FILE_TYPE",
      });
      return;
    }

    if (
      err.name ===
        "MulterError" &&
      (
        err as {
          code?: string;
        }
      ).code ===
        "LIMIT_FILE_SIZE"
    ) {
      res.status(400).json({
        error:
          "FILE_TOO_LARGE",
      });
      return;
    }

    next(err);
  }
);

// GET /api/attachments/:id/download -> stream an active Attachment's bytes.
//
// Lab 3: requester ownership is established from the authenticated Session,
// not from requesterId supplied in the URL.
app.get(
  "/api/attachments/:id/download",
  requireAuth,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const attachmentId =
      Number(req.params.id);

    const requesterId =
      req.authUser!.id;

    if (
      Number.isNaN(
        attachmentId
      )
    ) {
      res.status(400).json({
        error:
          "INVALID_ATTACHMENT_ID",
      });
      return;
    }

    try {
      const prisma = getPrisma();

      const attachment =
        await prisma.attachment.findUnique(
          {
            where: {
              id: attachmentId,
            },
            include: {
              ticket: {
                select: {
                  requesterId:
                    true,
                },
              },
            },
          }
        );

      // BR-09-style ownership check:
      // not owned or doesn't exist -> same 404.
      if (
        !attachment ||
        attachment.ticket
          .requesterId !==
          requesterId
      ) {
        res.status(404).json({
          error:
            "ATTACHMENT_NOT_FOUND",
        });
        return;
      }

      // BR-27: a removed attachment cannot be downloaded,
      // even though its metadata is still visible elsewhere.
      if (
        attachment.isRemoved
      ) {
        res.status(410).json({
          error:
            "ATTACHMENT_REMOVED",
        });
        return;
      }

      const filePath = path.join(
        UPLOADS_DIR,
        attachment.storedFileName
      );

      res.setHeader(
        "Content-Type",
        attachment.mimeType
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(
          attachment.fileName
        )}"`
      );

      fs.createReadStream(
        filePath
      ).pipe(res);
    } catch (err) {
      console.error(
        "Failed to download attachment:",
        err
      );

      res.status(500).json({
        error: "UNEXPECTED_ERROR",
      });
    }
  }
);

// PATCH /api/attachments/:id/remove -> soft-remove an Attachment (BR-26).
//
// Lab 3: requesterId is no longer accepted in the request body.
// Ownership comes from the authenticated Session.
app.patch(
  "/api/attachments/:id/remove",
  requireAuth,
  requireSameOrigin,
  requirePasswordChanged,
  requireRole("REQUESTER"),
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    const attachmentId =
      Number(req.params.id);

    const requesterId =
      req.authUser!.id;

    const { reason } =
      req.body as {
        reason?: string;
      };

    if (
      Number.isNaN(
        attachmentId
      )
    ) {
      res.status(400).json({
        error:
          "INVALID_ATTACHMENT_ID",
      });
      return;
    }

    if (
      !reason ||
      !reason.trim()
    ) {
      res.status(400).json({
        error:
          "REASON_REQUIRED",
      });
      return;
    }

    try {
      const prisma = getPrisma();

      const attachment =
        await prisma.attachment.findUnique(
          {
            where: {
              id: attachmentId,
            },
            include: {
              ticket: {
                select: {
                  requesterId:
                    true,
                },
              },
            },
          }
        );

      if (
        !attachment ||
        attachment.ticket
          .requesterId !==
          requesterId
      ) {
        res.status(404).json({
          error:
            "ATTACHMENT_NOT_FOUND",
        });
        return;
      }

      if (
        attachment.removedAt
      ) {
        res.status(409).json({
          error:
            "ALREADY_REMOVED",
        });
        return;
      }

      const updated =
        await prisma.attachment.update(
          {
            where: {
              id: attachmentId,
            },
            data: {
              isRemoved: true,
              removedAt:
                new Date(),
              removedReason:
                reason.trim(),
            },
          }
        );

      res.status(200).json({
        id: updated.id,
        isRemoved: true,
        removedAt:
          updated.removedAt,
        removedReason:
          updated.removedReason,
      });
    } catch (err) {
      console.error(
        "Failed to remove attachment:",
        err
      );

      res.status(500).json({
        error: "UNEXPECTED_ERROR",
      });
    }
  }
);

export default app;