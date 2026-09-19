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

describe("Lab 3 Requester Regression API", () => {
  let requesterAId: number;
  let requesterBId: number;

  let categoryId: number;
  let relatedSystemId: number;

  let requesterATicketId: number;
  let requesterBTicketId: number;

  const requesterAEmail =
    "lab3.regression.requester.a@example.com";

  const requesterBEmail =
    "lab3.regression.requester.b@example.com";

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
            "Lab 3 Regression Requester A",
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
            "Lab 3 Regression Requester B",
          email:
            requesterBEmail,
          passwordHash,
          role: "REQUESTER",
          isActive: true,
          mustChangePassword:
            false,
        },
      });

    requesterAId =
      requesterA.id;

    requesterBId =
      requesterB.id;

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
        "Lab 3 requester regression tests require at least one active Category and RelatedSystem."
      );
    }

    categoryId =
      category.id;

    relatedSystemId =
      relatedSystem.id;

    const ticketA =
      await prisma.ticket.create({
        data: {
          ticketNumber:
            `LAB3-REG-A-${Date.now()}`,
          requesterId:
            requesterAId,
          categoryId,
          relatedSystemId,
          summary:
            "Requester A regression ticket",
          description:
            "Ticket owned by Requester A for Lab 3 regression testing.",
          requestedPriority:
            "MEDIUM",
          itPriority:
            "MEDIUM",
          status: "NEW",
        },
      });

    const ticketB =
      await prisma.ticket.create({
        data: {
          ticketNumber:
            `LAB3-REG-B-${Date.now()}`,
          requesterId:
            requesterBId,
          categoryId,
          relatedSystemId,
          summary:
            "Requester B regression ticket",
          description:
            "Ticket owned by Requester B for Lab 3 regression testing.",
          requestedPriority:
            "LOW",
          itPriority:
            "LOW",
          status: "NEW",
        },
      });

    requesterATicketId =
      ticketA.id;

    requesterBTicketId =
      ticketB.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();

    await prisma.attachment.deleteMany({
      where: {
        ticketId: {
          in: [
            requesterATicketId,
            requesterBTicketId,
          ],
        },
      },
    });

    await prisma.ticket.deleteMany({
      where: {
        id: {
          in: [
            requesterATicketId,
            requesterBTicketId,
          ],
        },
      },
    });

    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [
            requesterAId,
            requesterBId,
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
          ],
        },
      },
    });
  });

  async function loginRequesterA() {
    const agent =
      request.agent(app);

    const loginRes =
      await agent
        .post(
          "/api/auth/login"
        )
        .send({
          email:
            requesterAEmail,
          password,
        });

    expect(
      loginRes.status
    ).toBe(200);

    return agent;
  }

  async function loginRequesterB() {
    const agent =
      request.agent(app);

    const loginRes =
      await agent
        .post(
          "/api/auth/login"
        )
        .send({
          email:
            requesterBEmail,
          password,
        });

    expect(
      loginRes.status
    ).toBe(200);

    return agent;
  }

  // -------------------------------------------------------------------------
  // AC-07 — Requester identity comes from authentication
  // -------------------------------------------------------------------------

  it("creates a Ticket for the authenticated Requester", async () => {
    const prisma =
      getPrisma();

    const agent =
      await loginRequesterA();

    const res =
      await agent
        .post("/api/tickets")
        .set(
          "Origin",
          clientOrigin
        )
        .send({
          categoryId,
          relatedSystemId,
          summary:
            "Authenticated requester ticket",
          description:
            "The authenticated Session must determine the Ticket owner.",
          requestedPriority:
            "HIGH",
        });

    expect(
      res.status
    ).toBe(201);

    const savedTicket =
      await prisma.ticket.findUnique({
        where: {
          id: res.body.id,
        },
      });

    expect(
      savedTicket
    ).not.toBeNull();

    expect(
      savedTicket!.requesterId
    ).toBe(requesterAId);

    await prisma.ticket.delete({
      where: {
        id: res.body.id,
      },
    });
  });

  it("does not allow a client-supplied requesterId to override the authenticated Requester", async () => {
    const prisma =
      getPrisma();

    const agent =
      await loginRequesterA();

    const res =
      await agent
        .post("/api/tickets")
        .set(
          "Origin",
          clientOrigin
        )
        .send({
          requesterId:
            requesterBId,
          categoryId,
          relatedSystemId,
          summary:
            "Ignore supplied requester identity",
          description:
            "This Ticket must still belong to Requester A.",
          requestedPriority:
            "MEDIUM",
        });

    expect(
      res.status
    ).toBe(201);

    const savedTicket =
      await prisma.ticket.findUnique({
        where: {
          id: res.body.id,
        },
      });

    expect(
      savedTicket
    ).not.toBeNull();

    expect(
      savedTicket!.requesterId
    ).toBe(requesterAId);

    expect(
      savedTicket!.requesterId
    ).not.toBe(requesterBId);

    await prisma.ticket.delete({
      where: {
        id: res.body.id,
      },
    });
  });

  // -------------------------------------------------------------------------
  // AC-08 — Requester ownership and safe 404 responses
  // -------------------------------------------------------------------------

  it("allows a Requester to open their own Ticket", async () => {
    const agent =
      await loginRequesterA();

    const res =
      await agent.get(
        `/api/tickets/${requesterATicketId}`
      );

    expect(
      res.status
    ).toBe(200);

    expect(
      res.body.id
    ).toBe(
      requesterATicketId
    );

    expect(
      res.body.requesterId
    ).toBe(requesterAId);
  });

  it("returns the same safe 404 when a Requester opens another Requester's Ticket", async () => {
    const agent =
      await loginRequesterA();

    const res =
      await agent.get(
        `/api/tickets/${requesterBTicketId}`
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

  it("returns the same safe 404 for a missing Ticket", async () => {
    const agent =
      await loginRequesterA();

    const res =
      await agent.get(
        "/api/tickets/999999999"
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
  // AC-10 — My Tickets remains scoped to the authenticated Requester
  // -------------------------------------------------------------------------

  it("lists only Tickets owned by the authenticated Requester", async () => {
    const agent =
      await loginRequesterA();

    const res =
      await agent.get(
        "/api/tickets?pageSize=50"
      );

    expect(
      res.status
    ).toBe(200);

    const ids =
      res.body.items.map(
        (ticket: {
          id: number;
        }) => ticket.id
      );

    expect(ids).toContain(
      requesterATicketId
    );

    expect(ids).not.toContain(
      requesterBTicketId
    );
  });

  it("ignores requesterId supplied in the Ticket-list query", async () => {
    const agent =
      await loginRequesterA();

    const res =
      await agent.get(
        `/api/tickets?requesterId=${requesterBId}&pageSize=50`
      );

    expect(
      res.status
    ).toBe(200);

    const ids =
      res.body.items.map(
        (ticket: {
          id: number;
        }) => ticket.id
      );

    expect(ids).toContain(
      requesterATicketId
    );

    expect(ids).not.toContain(
      requesterBTicketId
    );
  });

  // -------------------------------------------------------------------------
  // API-11 / AC-08 — Attachment ownership
  // -------------------------------------------------------------------------

  it("allows a Requester to list attachments for their own Ticket", async () => {
    const agent =
      await loginRequesterA();

    const res =
      await agent.get(
        `/api/tickets/${requesterATicketId}/attachments`
      );

    expect(
      res.status
    ).toBe(200);

    expect(
      Array.isArray(
        res.body
      )
    ).toBe(true);
  });

  it("returns safe 404 when a Requester requests attachments for another Requester's Ticket", async () => {
    const agent =
      await loginRequesterA();

    const res =
      await agent.get(
        `/api/tickets/${requesterBTicketId}/attachments`
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
  // Authentication requirements
  // -------------------------------------------------------------------------

  it("rejects Ticket list access without authentication", async () => {
    const res =
      await request(app).get(
        "/api/tickets"
      );

    expect(
      res.status
    ).toBe(401);

    expect(
      res.body.error
    ).toBe(
      "UNAUTHENTICATED"
    );
  });

  it("rejects Ticket detail access without authentication", async () => {
    const res =
      await request(app).get(
        `/api/tickets/${requesterATicketId}`
      );

    expect(
      res.status
    ).toBe(401);

    expect(
      res.body.error
    ).toBe(
      "UNAUTHENTICATED"
    );
  });

  it("keeps Requester A and Requester B ownership isolated", async () => {
    const requesterAAgent =
      await loginRequesterA();

    const requesterBAgent =
      await loginRequesterB();

    const requesterAOwn =
      await requesterAAgent.get(
        `/api/tickets/${requesterATicketId}`
      );

    const requesterAOther =
      await requesterAAgent.get(
        `/api/tickets/${requesterBTicketId}`
      );

    const requesterBOwn =
      await requesterBAgent.get(
        `/api/tickets/${requesterBTicketId}`
      );

    const requesterBOther =
      await requesterBAgent.get(
        `/api/tickets/${requesterATicketId}`
      );

    expect(
      requesterAOwn.status
    ).toBe(200);

    expect(
      requesterAOther.status
    ).toBe(404);

    expect(
      requesterBOwn.status
    ).toBe(200);

    expect(
      requesterBOther.status
    ).toBe(404);
  });
});