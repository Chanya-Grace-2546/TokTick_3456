import request from "supertest";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

type LoginResult = {
  cookie: string;
  user: {
    id: number;
    role: string;
  };
};

async function login(
  email: string,
  password = "ChangeMe1!"
): Promise<LoginResult> {
  const response = await request(app)
    .post("/api/auth/login")
    .set("Origin", "http://localhost:5173")
    .send({
      email,
      password,
    });

  expect(response.status).toBe(200);

  const setCookie = response.headers["set-cookie"];
  expect(setCookie).toBeDefined();

  return {
    cookie: setCookie[0].split(";")[0],
    user: response.body.user,
  };
}

describe("Lab 3 Issue 6 — Staff Ticket Detail & Operations", () => {
  let staff: LoginResult;
  let administrator: LoginResult;
  let requester: LoginResult;

  let staffId: number;
  let administratorId: number;
  let requesterId: number;
  let fixtureTicketId: number;

  const password = "Issue6Test1!";
  const staffEmail = "lab3.issue6.staff@example.com";
  const administratorEmail = "lab3.issue6.admin@example.com";
  const requesterEmail = "lab3.issue6.requester@example.com";

  beforeAll(async () => {
    const prisma = getPrisma();
    const passwordHash = await bcrypt.hash(password, 12);

    // Keep this suite independent from seed credentials. This follows the
    // existing Lab 3 API-test pattern: create dedicated active users with a
    // known password and no forced password change.
    const staffUser = await prisma.user.create({
      data: {
        name: "Lab 3 Issue 6 Staff",
        email: staffEmail,
        passwordHash,
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: false,
      },
    });

    const administratorUser = await prisma.user.create({
      data: {
        name: "Lab 3 Issue 6 Administrator",
        email: administratorEmail,
        passwordHash,
        role: "ADMINISTRATOR",
        isActive: true,
        mustChangePassword: false,
      },
    });

    const requesterUser = await prisma.user.create({
      data: {
        name: "Lab 3 Issue 6 Requester",
        email: requesterEmail,
        passwordHash,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });

    staffId = staffUser.id;
    administratorId = administratorUser.id;
    requesterId = requesterUser.id;

    const category = await prisma.category.findUniqueOrThrow({ where: { name: "Hardware" } });
    const system = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Corporate Laptop" } });
    const ticket = await prisma.ticket.create({ data: {
      ticketNumber: "ISSUE6-ISOLATED-TICKET", requesterId,
      categoryId: category.id, relatedSystemId: system.id,
      summary: "Isolated operations fixture", description: "Owned only by this test suite.",
      requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "NEW",
    } });
    fixtureTicketId = ticket.id;

    staff = await login(staffEmail, password);
    administrator = await login(administratorEmail, password);
    requester = await login(requesterEmail, password);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    const testUserIds = [
      staffId,
      administratorId,
      requesterId,
    ].filter((id): id is number => Number.isInteger(id));

    if (testUserIds.length === 0) {
      return;
    }

    // Tests can assign one of these users as a Ticket owner. Clear those
    // references before deleting the dedicated users.
    await prisma.ticket.updateMany({
      where: {
        ownerId: {
          in: testUserIds,
        },
      },
      data: {
        ownerId: null,
      },
    });

    await prisma.publicComment.deleteMany({
      where: {
        authorId: {
          in: testUserIds,
        },
      },
    });

    await prisma.internalNote.deleteMany({
      where: {
        authorId: {
          in: testUserIds,
        },
      },
    });

    await prisma.session.deleteMany({
      where: {
        userId: {
          in: testUserIds,
        },
      },
    });

    if (fixtureTicketId) await prisma.ticket.delete({ where: { id: fixtureTicketId } });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: testUserIds,
        },
      },
    });
  });

  it("API-15/16: claims an unassigned Ticket and rejects a second claim", async () => {
    const queue = await request(app)
      .get("/api/staff/tickets?owner=unassigned&pageSize=10")
      .set("Cookie", staff.cookie);

    expect(queue.status).toBe(200);
    expect(queue.body.items.length).toBeGreaterThan(0);

    const ticket = queue.body.items[0];

    const claim = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/claim`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie);

    expect(claim.status).toBe(200);
    expect(claim.body.owner.id).toBe(staff.user.id);

    const secondClaim = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/claim`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", administrator.cookie);

    expect(secondClaim.status).toBe(409);
    expect(secondClaim.body.error).toBe("TICKET_ALREADY_ASSIGNED");
  });

  it("API-17: assigns, reassigns, clears, and rejects an invalid owner", async () => {
    const queue = await request(app)
      .get("/api/staff/tickets?pageSize=10")
      .set("Cookie", staff.cookie);

    expect(queue.status).toBe(200);
    expect(queue.body.items.length).toBeGreaterThan(0);

    const ticketId = queue.body.items[0].id;

    const owners = await request(app)
      .get("/api/staff/owners")
      .set("Cookie", staff.cookie);

    expect(owners.status).toBe(200);

    const eligibleOwners = owners.body.items ?? owners.body;
    expect(eligibleOwners.length).toBeGreaterThanOrEqual(2);

    const firstOwner = eligibleOwners[0];
    const secondOwner = eligibleOwners[1];

    const assign = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie)
      .send({
        ownerId: firstOwner.id,
      });

    expect(assign.status).toBe(200);
    expect(assign.body.owner.id).toBe(firstOwner.id);

    const reassign = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie)
      .send({
        ownerId: secondOwner.id,
      });

    expect(reassign.status).toBe(200);
    expect(reassign.body.owner.id).toBe(secondOwner.id);

    const invalid = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie)
      .send({
        ownerId: requester.user.id,
      });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe("INVALID_OWNER");

    const clear = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie)
      .send({
        ownerId: null,
      });

    expect(clear.status).toBe(200);
    expect(clear.body.owner).toBeNull();
  });

  it("API-18: updates IT Priority without changing Requested Priority", async () => {
    const queue = await request(app)
      .get("/api/staff/tickets?pageSize=10")
      .set("Cookie", staff.cookie);

    const ticket = queue.body.items[0];

    const before = await request(app)
      .get(`/api/staff/tickets/${ticket.id}`)
      .set("Cookie", staff.cookie);

    expect(before.status).toBe(200);

    const nextPriority =
      before.body.itPriority === "HIGH" ? "LOW" : "HIGH";

    const update = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/it-priority`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie)
      .send({
        itPriority: nextPriority,
      });

    expect(update.status).toBe(200);
    expect(update.body.itPriority).toBe(nextPriority);
    expect(update.body.requestedPriority).toBe(
      before.body.requestedPriority
    );
  });

  it("API-19: accepts every permitted Staff status transition", async () => {
    const prisma = getPrisma();

    const transitions = {
      NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
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
      RESOLVED: ["CLOSED", "REOPENED"],
      CLOSED: ["REOPENED"],
      REOPENED: [
        "IN_PROGRESS",
        "WAITING_FOR_REQUESTER",
        "RESOLVED",
        "CANCELLED",
      ],
      CANCELLED: [],
    } as const;

    const queue = await request(app)
      .get("/api/staff/tickets?pageSize=10")
      .set("Cookie", staff.cookie);

    expect(queue.status).toBe(200);
    expect(queue.body.items.length).toBeGreaterThan(0);

    const ticketId = queue.body.items[0].id;

    for (const [fromStatus, toStatuses] of Object.entries(transitions)) {
      for (const toStatus of toStatuses) {
        await prisma.ticket.update({
          where: {
            id: ticketId,
          },
          data: {
            status: fromStatus as
              | "NEW"
              | "OPEN"
              | "IN_PROGRESS"
              | "WAITING_FOR_REQUESTER"
              | "RESOLVED"
              | "CLOSED"
              | "REOPENED"
              | "CANCELLED",
          },
        });

        const response = await request(app)
          .patch(`/api/staff/tickets/${ticketId}/status`)
          .set("Origin", "http://localhost:5173")
          .set("Cookie", staff.cookie)
          .send({
            status: toStatus,
          });

        expect(
          response.status,
          `${fromStatus} -> ${toStatus}`
        ).toBe(200);
        expect(response.body.status).toBe(toStatus);
      }
    }
  });

  it("API-20: rejects invalid and same-status transitions and Requester direct status changes", async () => {
    const queue = await request(app)
      .get("/api/staff/tickets?pageSize=10")
      .set("Cookie", staff.cookie);

    const ticket = queue.body.items[0];

    const detail = await request(app)
      .get(`/api/staff/tickets/${ticket.id}`)
      .set("Cookie", staff.cookie);

    expect(detail.status).toBe(200);

    const sameStatus = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie)
      .send({
        status: detail.body.status,
      });

    expect(sameStatus.status).toBe(409);
    expect(sameStatus.body.error).toBe("INVALID_STATUS_TRANSITION");

    const invalidEnum = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie)
      .send({
        status: "NOT_A_STATUS",
      });

    expect(invalidEnum.status).toBe(400);
    expect(invalidEnum.body.error).toBe("VALIDATION_FAILED");

    const requesterAttempt = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", requester.cookie)
      .send({
        status: "RESOLVED",
      });

    expect(requesterAttempt.status).toBe(403);
  });

  it("API-21/22: Staff can append Public Comments and Internal Notes with backend author/time", async () => {
    const queue = await request(app)
      .get("/api/staff/tickets?pageSize=10")
      .set("Cookie", staff.cookie);

    const ticketId = queue.body.items[0].id;

    const publicComment = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie)
      .send({
        content: "  Public Issue 6 test comment  ",
      });

    expect(publicComment.status).toBe(201);
    expect(publicComment.body.content).toBe(
      "Public Issue 6 test comment"
    );
    expect(publicComment.body.author.id).toBe(staff.user.id);
    expect(publicComment.body.createdAt).toBeTruthy();

    const internalNote = await request(app)
      .post(`/api/tickets/${ticketId}/internal-notes`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", staff.cookie)
      .send({
        content: "  Private Issue 6 test note  ",
      });

    expect(internalNote.status).toBe(201);
    expect(internalNote.body.content).toBe(
      "Private Issue 6 test note"
    );
    expect(internalNote.body.author.id).toBe(staff.user.id);
    expect(internalNote.body.createdAt).toBeTruthy();

    const notes = await request(app)
      .get(`/api/tickets/${ticketId}/internal-notes`)
      .set("Cookie", administrator.cookie);

    expect(notes.status).toBe(200);
    expect(
      notes.body.items.some(
        (note: { id: number }) => note.id === internalNote.body.id
      )
    ).toBe(true);

    const requesterNotes = await request(app)
      .get(`/api/tickets/${ticketId}/internal-notes`)
      .set("Cookie", requester.cookie);

    expect(requesterNotes.status).toBe(403);
  });

  it("API-23: rejects whitespace and over-limit Public Comments and Internal Notes without creating them", async () => {
    const queue = await request(app)
      .get("/api/staff/tickets?pageSize=10")
      .set("Cookie", staff.cookie);

    const ticketId = queue.body.items[0].id;

    const commentsBefore = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set("Cookie", staff.cookie);

    const notesBefore = await request(app)
      .get(`/api/tickets/${ticketId}/internal-notes`)
      .set("Cookie", staff.cookie);

    expect(commentsBefore.status).toBe(200);
    expect(notesBefore.status).toBe(200);

    for (const content of ["     ", "x".repeat(2001)]) {
      const comment = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set("Origin", "http://localhost:5173")
        .set("Cookie", staff.cookie)
        .send({
          content,
        });

      expect(comment.status).toBe(400);
      expect(comment.body.error).toBe("INVALID_COMMENT");

      const note = await request(app)
        .post(`/api/tickets/${ticketId}/internal-notes`)
        .set("Origin", "http://localhost:5173")
        .set("Cookie", staff.cookie)
        .send({
          content,
        });

      expect(note.status).toBe(400);
      expect(note.body.error).toBe("INVALID_INTERNAL_NOTE");
    }

    const commentsAfter = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set("Cookie", staff.cookie);

    const notesAfter = await request(app)
      .get(`/api/tickets/${ticketId}/internal-notes`)
      .set("Cookie", staff.cookie);

    expect(commentsAfter.status).toBe(200);
    expect(notesAfter.status).toBe(200);
    expect(commentsAfter.body.items).toHaveLength(
      commentsBefore.body.items.length
    );
    expect(notesAfter.body.items).toHaveLength(
      notesBefore.body.items.length
    );
  });
});
