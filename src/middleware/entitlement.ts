import { Response, NextFunction } from "express";
import { subscriptionService } from "../services/subscription.service.js";
import type { AuthRequest } from "./auth.js";
import { ForbiddenError, BusinessLogicError } from "../domain/errors.js";

export interface EntitlementRequest extends AuthRequest {
  entitlement?: {
    businessId: string;
    planCode: string;
  };
}

export function requireEntitlement(featureCode: string) {
  return async (req: EntitlementRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.businessId) {
      throw new ForbiddenError("Business context required");
    }

    const businessId = req.user.businessId;
    const check = await subscriptionService.checkFeature(businessId, featureCode);

    if (!check.allowed) {
      throw new ForbiddenError(check.reason ?? "Feature not available on current plan");
    }

    req.entitlement = {
      businessId,
      planCode: (await subscriptionService.getSubscriptionContext(businessId)).plan.code,
    };
    next();
  };
}

export function requireUsageLimit(featureCode: string, increment = false) {
  return async (req: EntitlementRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.businessId) {
      throw new ForbiddenError("Business context required");
    }

    const businessId = req.user.businessId;
    const limitCheck = await subscriptionService.checkUsageLimit(businessId, featureCode);

    if (!limitCheck.allowed) {
      throw new BusinessLogicError(
        limitCheck.reason ?? "Usage limit exceeded",
        "USAGE_LIMIT_EXCEEDED",
        { limitCount: limitCheck.limitCount, usedCount: limitCheck.usedCount }
      );
    }

    if (increment) {
      subscriptionService.incrementUsage(businessId, featureCode);
    }

    next();
  };
}

export function withBusinessId(req: EntitlementRequest, res: Response, next: NextFunction): void {
  if (!req.user?.businessId) {
    throw new ForbiddenError("Business context required");
  }
  next();
}
