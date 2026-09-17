import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 3 Authentication API", () => {
  let requesterId: number;
  let inactiveRequesterId: number;
  let staffId: number;

  const requesterEmail = "lab3.auth.requester@example.com";
  const inactiveEmail = "lab3.auth.inactive@example.com";
  const staffEmail = "lab3.auth.staff@example.com";

  const password = "TestPassword1!";
  const newPassword = "ChangedPassword1!";

  beforeAll(async () => {
    const prisma = getPrisma();

    const passwordHash = await bcrypt.hash(password, 12);

    const requester = await prisma.user.create({
      data: {
        name: "Lab 3 Auth Requester",
        email: requesterEmail,
        passwordHash,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: false,
      },
    });

    const inactiveRequester = await prisma.user.create({
      data: {
        name: "Lab 3 Inactive Requester",
        email: inactiveEmail,
        passwordHash,
        role: "REQUESTER",
        isActive: false,
        mustChangePassword: false,
      },
    });

    const staff = await prisma.user.create({
      data: {
        name: "Lab 3 IT Staff",
        email: staffEmail,
        passwordHash,
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: false,
      },
    });

    requesterId = requester.id;
    inactiveRequesterId = inactiveRequester.id;
    staffId = staff.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();

    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [requesterId, inactiveRequesterId, staffId],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [requesterId, inactiveRequesterId, staffId],
        },
      },
    });
  });

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  it("logs in an active user with the correct email and password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(res.status).toBe(200);

    expect(res.body.user).toMatchObject({
      id: requesterId,
      name: "Lab 3 Auth Requester",
      email: requesterEmail,
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: false,
    });
  });

  it("sets the authentication cookie as HttpOnly", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(res.status).toBe(200);

    const cookies = res.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const cookieText = Array.isArray(cookies)
      ? cookies.join("; ")
      : String(cookies);

    expect(cookieText).toContain("toktickit_session=");
    expect(cookieText.toLowerCase()).toContain("httponly");
    expect(cookieText.toLowerCase()).toContain("samesite=lax");
  });

  it("rejects an incorrect password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password: "WrongPassword1!",
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
  });

  it("rejects an unknown email with the same invalid-credentials response", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "unknown@example.com",
        password,
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
  });

  it("rejects an inactive account with the same invalid-credentials response", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: inactiveEmail,
        password,
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
  });

  it("requires both email and password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EMAIL_AND_PASSWORD_REQUIRED");
  });

  // -------------------------------------------------------------------------
  // GET /api/auth/me
  // -------------------------------------------------------------------------

  it("returns 401 from /me without a Session", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHENTICATED");
  });

  it("returns the authenticated user from /me", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const meRes = await agent.get("/api/auth/me");

    expect(meRes.status).toBe(200);

    expect(meRes.body.user).toMatchObject({
      id: requesterId,
      email: requesterEmail,
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: false,
    });
  });

  // -------------------------------------------------------------------------
  // Server-side role authorization
  // -------------------------------------------------------------------------

  it("allows a Requester to access a Requester-only route", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const res = await agent.get("/api/tickets");

    expect(res.status).toBe(200);
  });

  it("rejects IT Staff from a Requester-only route", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: staffEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const res = await agent.get("/api/tickets");

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  it("logout invalidates the current Session", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const beforeLogout = await agent.get("/api/auth/me");

    expect(beforeLogout.status).toBe(200);

    const logoutRes = await agent
      .post("/api/auth/logout")
      .set("Origin", "http://localhost:5173");

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    const afterLogout = await agent.get("/api/auth/me");

    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body.error).toBe("UNAUTHENTICATED");
  });

  // -------------------------------------------------------------------------
  // Same-origin protection
  // -------------------------------------------------------------------------

  it("rejects authenticated state-changing requests with no Origin header", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const res = await agent.post("/api/auth/logout");

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("INVALID_ORIGIN");

    // The rejected request must not have invalidated the Session.
    const meRes = await agent.get("/api/auth/me");

    expect(meRes.status).toBe(200);
  });

  it("rejects authenticated state-changing requests from another Origin", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const res = await agent
      .post("/api/auth/logout")
      .set("Origin", "https://evil.example");

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("INVALID_ORIGIN");

    // The rejected request must not have invalidated the Session.
    const meRes = await agent.get("/api/auth/me");

    expect(meRes.status).toBe(200);
  });

  it("allows an authenticated state-changing request from the configured client Origin", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const res = await agent
      .post("/api/auth/logout")
      .set("Origin", "http://localhost:5173");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Change password
  // -------------------------------------------------------------------------

  it("rejects change-password when the current password is wrong", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const res = await agent
      .post("/api/auth/change-password")
      .set("Origin", "http://localhost:5173")
      .send({
        currentPassword: "WrongPassword1!",
        newPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CURRENT_PASSWORD_INCORRECT");
  });

  it("rejects a new password that does not meet the password policy", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const res = await agent
      .post("/api/auth/change-password")
      .set("Origin", "http://localhost:5173")
      .send({
        currentPassword: password,
        newPassword: "short",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("PASSWORD_REQUIREMENTS_NOT_MET");
  });

  it("rejects changing to the same password", async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginRes.status).toBe(200);

    const res = await agent
      .post("/api/auth/change-password")
      .set("Origin", "http://localhost:5173")
      .send({
        currentPassword: password,
        newPassword: password,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("NEW_PASSWORD_MUST_BE_DIFFERENT");
  });

  it("changes the password, clears mustChangePassword, keeps the current Session, and invalidates other Sessions", async () => {
    const prisma = getPrisma();

    const agentA = request.agent(app);
    const agentB = request.agent(app);

    const loginA = await agentA
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    const loginB = await agentB
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);

    const changeRes = await agentA
      .post("/api/auth/change-password")
      .set("Origin", "http://localhost:5173")
      .send({
        currentPassword: password,
        newPassword,
      });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.success).toBe(true);

    const updatedUser = await prisma.user.findUnique({
      where: {
        id: requesterId,
      },
    });

    expect(updatedUser).not.toBeNull();
    expect(updatedUser!.mustChangePassword).toBe(false);

    const passwordMatches = await bcrypt.compare(
      newPassword,
      updatedUser!.passwordHash
    );

    expect(passwordMatches).toBe(true);

    // BR-08: the Session performing the password change remains active.
    // Other Sessions for the User are invalidated.
    const sessions = await prisma.session.findMany({
  where: {
    userId: requesterId,
  },
});

const activeSessions = sessions.filter(
  (session) => session.invalidatedAt === null
);

const invalidatedSessions = sessions.filter(
  (session) => session.invalidatedAt !== null
);

// BR-08: only the Session that performed the password change
// remains active. Every other Session for this User is invalidated.
expect(activeSessions).toHaveLength(1);
expect(invalidatedSessions.length).toBeGreaterThanOrEqual(1);

    const currentSession = await agentA.get("/api/auth/me");
    const otherSession = await agentB.get("/api/auth/me");

    expect(currentSession.status).toBe(200);
    expect(currentSession.body.user.mustChangePassword).toBe(false);

    expect(otherSession.status).toBe(401);
    expect(otherSession.body.error).toBe("UNAUTHENTICATED");

    // Old password must no longer work.
    const oldPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password,
      });

    expect(oldPasswordLogin.status).toBe(401);

    // New password must work.
    const newPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: requesterEmail,
        password: newPassword,
      });

    expect(newPasswordLogin.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Forced initial-password change
  // -------------------------------------------------------------------------

  it("blocks normal application access until the initial password is changed", async () => {
    const prisma = getPrisma();

    const initialPassword = "InitialPassword1!";
    const changedPassword = "NewInitialPassword1!";
    const email = "lab3.mustchange@example.com";

    const passwordHash = await bcrypt.hash(initialPassword, 12);

    const user = await prisma.user.create({
      data: {
        name: "Lab 3 Must Change Password",
        email,
        passwordHash,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
      },
    });

    try {
      const agent = request.agent(app);

      // Initial password is valid, so login itself succeeds.
      const loginRes = await agent
        .post("/api/auth/login")
        .send({
          email,
          password: initialPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.mustChangePassword).toBe(true);

      // /me must remain available so the client can determine the
      // authenticated user's role and password-change requirement.
      const meRes = await agent.get("/api/auth/me");

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.mustChangePassword).toBe(true);

      // Normal application routes are blocked until the initial
      // password has been changed.
      const blockedRes = await agent.get("/api/tickets");

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error).toBe(
        "PASSWORD_CHANGE_REQUIRED"
      );

      // The password-change endpoint itself must remain available.
      const changeRes = await agent
  .post("/api/auth/change-password")
  .set("Origin", "http://localhost:5173")
  .send({
    currentPassword: initialPassword,
    newPassword: changedPassword,
  });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // BR-08: the current Session remains authenticated after the
      // successful mandatory password change.
      const currentSessionRes = await agent.get("/api/auth/me");

      expect(currentSessionRes.status).toBe(200);
      expect(
        currentSessionRes.body.user.mustChangePassword
      ).toBe(false);

      const updatedUser = await prisma.user.findUnique({
        where: {
          id: user.id,
        },
      });

      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.mustChangePassword).toBe(false);

      // Normal Requester application access is immediately allowed
      // without requiring another login.
      const allowedRes = await agent.get("/api/tickets");

      expect(allowedRes.status).toBe(200);

      // The old password no longer works.
      const oldPasswordLogin = await request(app)
        .post("/api/auth/login")
        .send({
          email,
          password: initialPassword,
        });

      expect(oldPasswordLogin.status).toBe(401);

      // The new password works for future logins.
      const newPasswordLogin = await request(app)
        .post("/api/auth/login")
        .send({
          email,
          password: changedPassword,
        });

      expect(newPasswordLogin.status).toBe(200);
    } finally {
      await prisma.session.deleteMany({
        where: {
          userId: user.id,
        },
      });

      await prisma.user.delete({
        where: {
          id: user.id,
        },
      });
    }
  });
});