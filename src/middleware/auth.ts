import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../domain/errors.js";
import { env } from "../config/index.js";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    businessId?: string;
    email?: string;
    role?: string;
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.slice(7);
  let decoded: { userId: string; businessId?: string; email?: string };

  try {
    const secret = env.AUTH_JWT_SECRET;
    decoded = jwt.verify(token, secret) as typeof decoded;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  req.user = {
    id: decoded.userId,
    businessId: decoded.businessId,
    email: decoded.email,
  };
  next();
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const secret = env.AUTH_JWT_SECRET;
      const decoded = jwt.verify(token, secret) as { userId: string; businessId?: string; email?: string };
      req.user = { id: decoded.userId, businessId: decoded.businessId, email: decoded.email };
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

export function generateToken(userId: string, businessId?: string, email?: string): string {
  const secret = env.AUTH_JWT_SECRET;
  return jwt.sign({ userId, businessId, email }, secret, { expiresIn: "30d" });
}
