import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { getPrisma } from "./prisma.js";

export const SESSION_COOKIE_NAME = "toktickit_session";
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export type AuthRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
  sessionId?: number;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_MS,
    path: "/",
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return;
  }

  try {
    const prisma = getPrisma();
    const tokenHash = hashSessionToken(token);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
          },
        },
      },
    });

    if (
      !session ||
      session.invalidatedAt ||
      session.expiresAt <= new Date()
    ) {
      if (
        session &&
        !session.invalidatedAt
      ) {
        await prisma.session
          .update({
            where: {
              id: session.id,
            },
            data: {
              invalidatedAt: new Date(),
            },
          })
          .catch(() => {});
      }

      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }

    if (!session.user.isActive) {
      await prisma.session.updateMany({
        where: {
          userId: session.user.id,
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: new Date(),
        },
      });

      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }

    req.authUser = session.user;
    req.sessionId = session.id;

    next();
  } catch (error) {
    console.error("Authentication check failed:", error);
    res.status(500).json({ error: "UNEXPECTED_ERROR" });
  }
}

// Lab 3 BR-12:
// Authenticated state-changing requests that use the Session cookie must
// originate from the configured TokTickIT client origin.
//
// GET, HEAD, and OPTIONS do not change application state and are allowed.
// State-changing authenticated requests must include an Origin header that
// exactly matches the configured client origin.
export function requireSameOrigin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    next();
    return;
  }

  const origin = req.get("origin");

  const allowedOrigin =
    process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

  if (!origin || origin !== allowedOrigin) {
    res.status(403).json({
      error: "INVALID_ORIGIN",
    });
    return;
  }

  next();
}

export function requirePasswordChanged(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.authUser) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return;
  }

  if (req.authUser.mustChangePassword) {
    res.status(403).json({ error: "PASSWORD_CHANGE_REQUIRED" });
    return;
  }

  next();
}

export function requireRole(...roles: AuthRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.authUser) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }

    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }

    next();
  };
}