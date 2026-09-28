import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 3 Public Comments and Requester Resolution API", () => {
  let requesterAId: number;
  let requesterBId: number;
  let staffId: number;
  let adminId: number;

  let ticketId: number;

  const requesterAEmail =
    "lab3.comments.requester.a@example.com";

  const requesterBEmail =
    "lab3.comments.requester.b@example.com";

  const staffEmail =
    "lab3.comments.staff@example.com";

  const adminEmail =
    "lab3.comments.admin@example.com";

  const password =
    "TestPassword1!";

  const clientOrigin =
    "http://localhost:5173";

  beforeAll(async () => {
    const prisma = getPrisma();

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    const requesterA =
      await prisma.user.create({
        data: {
          name:
            "Lab 3 Comment Requester A",
          email:
            requesterAEmail,
          passwordHash,
          role: "REQUESTER",
          isActive: true,
          mustChangePassword:
            false,
        },
      });

    const requesterB =
      await prisma.user.create({
        data: {
          name:
            "Lab 3 Comment Requester B",
          email:
            requesterBEmail,
          passwordHash,
          role: "REQUESTER",
          isActive: true,
          mustChangePassword:
            false,
        },
      });

    const staff =
      await prisma.user.create({
        data: {
          name:
            "Lab 3 Comment IT Staff",
          email:
            staffEmail,
          passwordHash,
          role: "IT_STAFF",
          isActive: true,
          mustChangePassword:
            false,
        },
      });

    const admin =
      await prisma.user.create({
        data: {
          name:
            "Lab 3 Comment Administrator",
          email:
            adminEmail,
          passwordHash,
          role: "ADMINISTRATOR",
          isActive: true,
          mustChangePassword:
            false,
        },
      });

    requesterAId =
      requesterA.id;

    requesterBId =
      requesterB.id;

    staffId =
      staff.id;

    adminId =
      admin.id;

    const category =
      await prisma.category.findFirst({
        where: {
          isActive: true,
        },
        orderBy: {
          id: "asc",
        },
      });

    const relatedSystem =
      await prisma.relatedSystem.findFirst({
        where: {
          isActive: true,
        },
        orderBy: {
          id: "asc",
        },
      });

    if (
      !category ||
      !relatedSystem
    ) {
      throw new Error(
        "Lab 3 comment tests require at least one active Category and RelatedSystem."
      );
    }

    const ticket =
      await prisma.ticket.create({
        data: {
          ticketNumber:
            `LAB3-COMMENT-${Date.now()}`,
          requesterId:
            requesterAId,
          categoryId:
            category.id,
          relatedSystemId:
            relatedSystem.id,
          summary:
            "Public comment test ticket",
          description:
            "Ticket used to test Lab 3 Public Comments and requester apparent resolution.",
          requestedPriority:
            "MEDIUM",
          itPriority:
            "MEDIUM",
          status:
            "WAITING_FOR_REQUESTER",
        },
      });

    ticketId =
      ticket.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();

    await prisma.publicComment.deleteMany({
      where: {
        ticketId,
      },
    });

    await prisma.internalNote.deleteMany({
      where: {
        ticketId,
      },
    });

    await prisma.attachment.deleteMany({
      where: {
        ticketId,
      },
    });

    await prisma.ticket.deleteMany({
      where: {
        id: ticketId,
      },
    });

    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [
            requesterAId,
            requesterBId,
            staffId,
            adminId,
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            requesterAId,
            requesterBId,
            staffId,
            adminId,
          ],
        },
      },
    });
  });

  async function login(
    email: string
  ) {
    const agent =
      request.agent(app);

    const loginRes =
      await agent
        .post(
          "/api/auth/login"
        )
        .send({
          email,
          password,
        });

    expect(
      loginRes.status
    ).toBe(200);

    return agent;
  }

  // -------------------------------------------------------------------------
  // API-21 / AC-11 — Public Comments
  // -------------------------------------------------------------------------

  it("allows the owning Requester to create a Public Comment", async () => {
    const agent =
      await login(
        requesterAEmail
      );

    const res =
      await agent
        .post(
          `/api/tickets/${ticketId}/comments`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({
          content:
            "  The problem is still happening.  ",
        });

    expect(
      res.status
    ).toBe(201);

    expect(
      res.body.content
    ).toBe(
      "The problem is still happening."
    );

    expect(
      res.body.author
    ).toMatchObject({
      id: requesterAId,
      name:
        "Lab 3 Comment Requester A",
      role: "REQUESTER",
    });

    expect(
      res.body.createdAt
    ).toBeDefined();
  });

  it("returns Public Comments with backend author and createdAt", async () => {
    const agent =
      await login(
        requesterAEmail
      );

    const res =
      await agent.get(
        `/api/tickets/${ticketId}/comments`
      );

    expect(
      res.status
    ).toBe(200);

    expect(
      Array.isArray(
        res.body.items
      )
    ).toBe(true);

    expect(
      res.body.items.length
    ).toBeGreaterThan(0);

    const comment =
      res.body.items.find(
        (item: {
          content: string;
        }) =>
          item.content ===
          "The problem is still happening."
      );

    expect(
      comment
    ).toBeDefined();

    expect(
      comment.author
    ).toMatchObject({
      id: requesterAId,
      name:
        "Lab 3 Comment Requester A",
      role: "REQUESTER",
    });

    expect(
      comment.createdAt
    ).toBeDefined();
  });

  it("allows IT Staff to retrieve Public Comments for an existing Ticket", async () => {
    const agent =
      await login(staffEmail);

    const res =
      await agent.get(
        `/api/tickets/${ticketId}/comments`
      );

    expect(
      res.status
    ).toBe(200);

    expect(
      Array.isArray(
        res.body.items
      )
    ).toBe(true);
  });

  it("allows an Administrator to retrieve Public Comments for an existing Ticket", async () => {
    const agent =
      await login(adminEmail);

    const res =
      await agent.get(
        `/api/tickets/${ticketId}/comments`
      );

    expect(
      res.status
    ).toBe(200);

    expect(
      Array.isArray(
        res.body.items
      )
    ).toBe(true);
  });

  it("returns safe 404 when a Requester accesses another Requester's Public Comments", async () => {
    const agent =
      await login(
        requesterBEmail
      );

    const res =
      await agent.get(
        `/api/tickets/${ticketId}/comments`
      );

    expect(
      res.status
    ).toBe(404);

    expect(
      res.body.error
    ).toBe(
      "NOT_FOUND"
    );
  });

  // -------------------------------------------------------------------------
  // API-23 — Public Comment validation
  // -------------------------------------------------------------------------

  it("rejects a whitespace-only Public Comment", async () => {
    const agent =
      await login(
        requesterAEmail
      );

    const res =
      await agent
        .post(
          `/api/tickets/${ticketId}/comments`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({
          content:
            "      ",
        });

    expect(
      res.status
    ).toBe(400);

    expect(
      res.body.error
    ).toBe(
      "INVALID_COMMENT"
    );
  });

  it("rejects a Public Comment longer than 2000 characters", async () => {
    const agent =
      await login(
        requesterAEmail
      );

    const res =
      await agent
        .post(
          `/api/tickets/${ticketId}/comments`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({
          content:
            "a".repeat(2001),
        });

    expect(
      res.status
    ).toBe(400);

    expect(
      res.body.error
    ).toBe(
      "INVALID_COMMENT"
    );
  });

  // -------------------------------------------------------------------------
  // AC-12 — Requester must never receive Internal Notes
  // -------------------------------------------------------------------------

  it("forbids a Requester from retrieving Internal Notes", async () => {
    const agent =
      await login(
        requesterAEmail
      );

    const res =
      await agent.get(
        `/api/tickets/${ticketId}/internal-notes`
      );

    expect(
      res.status
    ).toBe(403);

    expect(
      res.body.error
    ).toBe("FORBIDDEN");

    expect(
      res.body
    ).not.toHaveProperty(
      "items"
    );
  });

  it("forbids a Requester from creating an Internal Note", async () => {
    const agent =
      await login(
        requesterAEmail
      );

    const res =
      await agent
        .post(
          `/api/tickets/${ticketId}/internal-notes`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({
          content:
            "Requester must not create this note.",
        });

    expect(
      res.status
    ).toBe(403);

    expect(
      res.body.error
    ).toBe("FORBIDDEN");
  });

  // -------------------------------------------------------------------------
  // API-24 / AC-13 — Problem Appears Resolved
  // -------------------------------------------------------------------------

  it("records that the problem appears resolved without changing formal Ticket status", async () => {
    const prisma =
      getPrisma();

    const agent =
      await login(
        requesterAEmail
      );

    const before =
      await prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
      });

    expect(
      before
    ).not.toBeNull();

    const originalStatus =
      before!.status;

    const res =
      await agent
        .post(
          `/api/tickets/${ticketId}/problem-appears-resolved`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({});

    expect(
      res.status
    ).toBe(200);

    expect(
      res.body.requesterResolvedAt
    ).toBeDefined();

    expect(
      res.body.status
    ).toBe(
      originalStatus
    );

    const after =
      await prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
      });

    expect(
      after
    ).not.toBeNull();

    expect(
      after!.status
    ).toBe(
      originalStatus
    );

    expect(
      after!.requesterResolvedAt
    ).not.toBeNull();

    expect(
      after!.requesterResolvedById
    ).toBe(
      requesterAId
    );
  });

  it("is idempotent when the Requester indicates apparent resolution again", async () => {
    const agent =
      await login(
        requesterAEmail
      );

    const first =
      await agent
        .post(
          `/api/tickets/${ticketId}/problem-appears-resolved`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({});

    expect(
      first.status
    ).toBe(200);

    const firstTimestamp =
      first.body.requesterResolvedAt;

    const second =
      await agent
        .post(
          `/api/tickets/${ticketId}/problem-appears-resolved`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({});

    expect(
      second.status
    ).toBe(200);

    expect(
      second.body.requesterResolvedAt
    ).toBe(
      firstTimestamp
    );
  });

  it("returns safe 404 when a Requester marks another Requester's Ticket as apparently resolved", async () => {
    const agent =
      await login(
        requesterBEmail
      );

    const res =
      await agent
        .post(
          `/api/tickets/${ticketId}/problem-appears-resolved`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({});

    expect(
      res.status
    ).toBe(404);

    expect(
      res.body.error
    ).toBe(
      "NOT_FOUND"
    );
  });

  // -------------------------------------------------------------------------
  // API-25 / BR-35 — Requester comment clears apparent resolution
  // -------------------------------------------------------------------------

  it("clears the apparent-resolution indication when the Requester posts a new Public Comment", async () => {
    const prisma =
      getPrisma();

    const requesterAgent =
      await login(
        requesterAEmail
      );

    const resolvedRes =
      await requesterAgent
        .post(
          `/api/tickets/${ticketId}/problem-appears-resolved`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({});

    expect(
      resolvedRes.status
    ).toBe(200);

    let ticket =
      await prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
      });

    expect(
      ticket!.requesterResolvedAt
    ).not.toBeNull();

    expect(
      ticket!.requesterResolvedById
    ).toBe(
      requesterAId
    );

    const commentRes =
      await requesterAgent
        .post(
          `/api/tickets/${ticketId}/comments`
        )
        .set(
          "Origin",
          clientOrigin
        )
        .send({
          content:
            "The issue started happening again.",
        });

    expect(
      commentRes.status
    ).toBe(201);

    ticket =
      await prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
      });

    expect(
      ticket!.requesterResolvedAt
    ).toBeNull();

    expect(
      ticket!.requesterResolvedById
    ).toBeNull();
  });
});