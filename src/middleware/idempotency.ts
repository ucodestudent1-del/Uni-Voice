import { Request, Response, NextFunction } from "express";

export function idempotencyKey(req: Request, res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== "object") {
    next();
    return;
  }
  const headerKey = req.headers["idempotency-key"];
  if (headerKey && typeof headerKey === "string" && !req.body.idempotencyKey) {
    req.body.idempotencyKey = headerKey;
  }
  next();
}
