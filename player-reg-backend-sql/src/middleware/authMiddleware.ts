import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../lib/env";

// Payload signed at sign-in (see authControllers.signIn)
export type AuthUser = { id: number; role: string };

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const readToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
};

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthUser;
    next();
  } catch {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

/**
 * For public endpoints that return more data to signed-in users:
 * sets req.user when a valid token is sent, and never rejects the request.
 */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = readToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET) as AuthUser;
    } catch {
      // Invalid/expired token: treat as a guest
    }
  }
  next();
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. You do not have access to this resource.",
      });
    }
    next();
  };
};

export const isAdmin = (req: Request) => req.user?.role === "admin";

/** True if the signed-in user is `userId` or an admin. */
export const isSelfOrAdmin = (req: Request, userId: number) =>
  isAdmin(req) || req.user?.id === userId;
