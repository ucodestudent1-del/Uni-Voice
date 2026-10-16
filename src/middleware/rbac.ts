import { Response, NextFunction } from "express";
import { ForbiddenError } from "../domain/errors.js";
import { query } from "../db/pool.js";
import type { AuthRequest } from "./auth.js";

export type BusinessRole = "owner" | "admin" | "member" | "viewer";

const ROLE_HIERARCHY: Record<BusinessRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export function requireRole(minimumRole: BusinessRole) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.businessId) {
      return next(new ForbiddenError("Business context required"));
    }

    const userId = req.user.id;
    const businessId = req.user.businessId;

    const result = await query(
      `SELECT role FROM business_users
       WHERE business_id = $1 AND user_id = $2 AND status = 'active'
       UNION ALL
       SELECT 'owner' as role FROM businesses WHERE id = $1 AND owner_id = $2
       LIMIT 1`,
      [businessId, userId],
    );

    if (!result.rows.length) {
      return next(new ForbiddenError("No active role in this business"));
    }

    const userRole = result.rows[0].role as BusinessRole;
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole];

    if (userLevel < requiredLevel) {
      return next(
        new ForbiddenError(
          `Insufficient permissions. Requires ${minimumRole} role or higher.`,
        ),
      );
    }

    (req as any).userRole = userRole;
    next();
  };
}

export function requireRoleExact(role: BusinessRole) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.businessId) {
      return next(new ForbiddenError("Business context required"));
    }

    const userId = req.user.id;
    const businessId = req.user.businessId;

    const result = await query(
      `SELECT role FROM business_users
       WHERE business_id = $1 AND user_id = $2 AND status = 'active'
       UNION ALL
       SELECT 'owner' as role FROM businesses WHERE id = $1 AND owner_id = $2
       LIMIT 1`,
      [businessId, userId],
    );

    if (!result.rows.length) {
      return next(new ForbiddenError("No active role in this business"));
    }

    const userRole = result.rows[0].role as BusinessRole;

    if (userRole !== role) {
      return next(
        new ForbiddenError(`Requires ${role} role. Current role: ${userRole}`),
      );
    }

    (req as any).userRole = userRole;
    next();
  };
}
