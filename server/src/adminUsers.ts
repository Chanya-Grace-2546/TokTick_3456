import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { AuthenticatedRequest, requireAuth, requirePasswordChanged, requireRole, requireSameOrigin } from "./auth.js";
import { AdminUserFields, AdminValidationError, validateAdminQuery, validateAdminUser, validateInitialPassword } from "./validateAdminUser.js";

const safeUser = {
  id: true, name: true, email: true, role: true,
  isActive: true, mustChangePassword: true,
} satisfies Prisma.UserSelect;

class AdminError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

function failure(res: Response, error: unknown) {
  if (error instanceof AdminValidationError) {
    res.status(400).json({ error: error.code, fields: error.fields });
  } else if (error instanceof AdminError) {
    res.status(error.status).json({ error: error.code });
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    res.status(409).json({ error: "EMAIL_ALREADY_EXISTS" });
  } else {
    // Database exceptions may contain sensitive mutation arguments. Never log
    // or serialize the raw exception from account/password operations.
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
}

function userId(req: AuthenticatedRequest): number {
  const raw = req.params.id;
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    throw new AdminValidationError({ id: "Provide a valid User ID." });
  }
  return id;
}

async function mutation<T>(req: AuthenticatedRequest, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  // Serializable transactions prevent concurrent count/check/update operations
  // from both removing the remaining admins. Retry the whole operation against
  // fresh state after a serialization conflict, including actor authorization.
  for (let attempt = 0; ; attempt++) {
    try {
      return await getPrisma().$transaction(async tx => {
        const session = await tx.session.findUnique({
          where: { id: req.sessionId! }, include: { user: { select: safeUser } },
        });
        if (!session || session.invalidatedAt || session.expiresAt <= new Date() || !session.user.isActive) {
          throw new AdminError(401, "UNAUTHENTICATED");
        }
        if (session.user.mustChangePassword) throw new AdminError(403, "PASSWORD_CHANGE_REQUIRED");
        if (session.user.role !== "ADMINISTRATOR") throw new AdminError(403, "FORBIDDEN");
        return work(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 4) continue;
      throw error;
    }
  }
}

async function checkEmail(tx: Prisma.TransactionClient, email: string | undefined, exceptId?: number) {
  if (email && await tx.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  })) throw new AdminError(409, "EMAIL_ALREADY_EXISTS");
}

async function invalidateSessions(tx: Prisma.TransactionClient, id: number) {
  await tx.session.updateMany({ where: { userId: id, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
}

export const adminUsers = Router();
adminUsers.use(requireAuth, requirePasswordChanged, requireRole("ADMINISTRATOR"), requireSameOrigin);

adminUsers.get("/", async (req, res) => {
  try {
    const query = validateAdminQuery(req.query);
    const items = await getPrisma().user.findMany({
      where: {
        role: query.role,
        ...(query.search ? { OR: [
          { name: { contains: query.search, mode: "insensitive" as const } },
          { email: { contains: query.search, mode: "insensitive" as const } },
        ] } : {}),
      },
      select: safeUser, orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    res.status(200).json({ items });
  } catch (error) { failure(res, error); }
});

adminUsers.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const data = validateAdminUser(req.body, true) as AdminUserFields;
    const initialPassword = validateInitialPassword(req.body, false);
    const passwordHash = await bcrypt.hash(initialPassword, 12);
    const user = await mutation(req, async tx => {
      await checkEmail(tx, data.email);
      return tx.user.create({ data: { ...data, passwordHash, mustChangePassword: true }, select: safeUser });
    });
    res.status(201).json(user);
  } catch (error) { failure(res, error); }
});

adminUsers.patch("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const id = userId(req);
    const data = validateAdminUser(req.body, false);
    const user = await mutation(req, async tx => {
      const target = await tx.user.findUnique({ where: { id }, select: safeUser });
      if (!target) throw new AdminError(404, "NOT_FOUND");
      if (id === req.authUser!.id && data.isActive === false) throw new AdminError(409, "SELF_DEACTIVATION_FORBIDDEN");
      if (target.role === "ADMINISTRATOR" && target.isActive &&
          (data.isActive === false || (data.role !== undefined && data.role !== "ADMINISTRATOR"))) {
        if (await tx.user.count({ where: { role: "ADMINISTRATOR", isActive: true } }) <= 1) {
          throw new AdminError(409, "LAST_ACTIVE_ADMIN_REQUIRED");
        }
      }
      if (target.role === "REQUESTER" && data.role !== undefined && data.role !== "REQUESTER" &&
          await tx.ticket.count({ where: { requesterId: id } }) > 0) {
        throw new AdminError(409, "USER_HAS_REQUESTER_TICKETS");
      }
      await checkEmail(tx, data.email, id);
      const updated = await tx.user.update({ where: { id }, data, select: safeUser });
      if (data.isActive === false) await invalidateSessions(tx, id);
      return updated;
    });
    res.status(200).json(user);
  } catch (error) { failure(res, error); }
});

adminUsers.post("/:id/initial-password", async (req: AuthenticatedRequest, res) => {
  try {
    const id = userId(req);
    const initialPassword = validateInitialPassword(req.body, true);
    const passwordHash = await bcrypt.hash(initialPassword, 12);
    await mutation(req, async tx => {
      if (!await tx.user.findUnique({ where: { id }, select: { id: true } })) throw new AdminError(404, "NOT_FOUND");
      await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true }, select: { id: true } });
      await invalidateSessions(tx, id);
    });
    res.status(204).end();
  } catch (error) { failure(res, error); }
});
