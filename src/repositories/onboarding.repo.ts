import { query } from "../db/pool.js";
import type { OnboardingStepRecord, OnboardingStepStatus } from "../domain/onboarding.js";
import { rowToDate } from "./helpers.js";

export interface OnboardingStepInput {
  businessId: string;
  step: string;
  title: string;
  description?: string | null;
  status?: OnboardingStepStatus;
  completedAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export class OnboardingRepository {
  async seedSteps(businessId: string): Promise<void> {
    const { ONBOARDING_STEPS } = await import("../domain/onboarding.js");
    for (const s of ONBOARDING_STEPS) {
      await query(
        `INSERT INTO onboarding_steps (business_id, step, title, description, sort_order, status, metadata)
         VALUES ($1, $2, $3, $4, $5, 'pending', '{}')
         ON CONFLICT (business_id, step) DO NOTHING`,
        [businessId, s.step, s.title, s.description, s.sortOrder]
      );
    }
  }

  async findByBusinessId(businessId: string): Promise<OnboardingStepRecord[]> {
    const res = await query(
      `SELECT * FROM onboarding_steps WHERE business_id = $1 ORDER BY sort_order ASC NULLS LAST, step ASC`,
      [businessId]
    );
    return res.rows.map((r) => this.rowToRecord(r));
  }

  async findStep(businessId: string, step: string): Promise<OnboardingStepRecord | null> {
    const res = await query(
      `SELECT * FROM onboarding_steps WHERE business_id = $1 AND step = $2`,
      [businessId, step]
    );
    if (!res.rows.length) return null;
    return this.rowToRecord(res.rows[0]);
  }

  async updateStepStatus(
    businessId: string,
    step: string,
    status: OnboardingStepStatus,
    metadata?: Record<string, unknown>
  ): Promise<OnboardingStepRecord> {
    const completedAt: Date | null =
      status === "completed" ? new Date() :
      status === "in_progress" || status === "skipped" ? null : null;

    const res = await query(
      `UPDATE onboarding_steps
         SET status = $3::onboarding_step_status,
             completed_at = $4,
             metadata = metadata || $5::jsonb,
             updated_at = NOW()
       WHERE business_id = $1 AND step = $2
       RETURNING *`,
      [businessId, step, status, completedAt, JSON.stringify(metadata ?? {})]
    );
    if (!res.rows.length) throw new Error(`Onboarding step "${step}" not found for business ${businessId}`);
    return this.rowToRecord(res.rows[0]);
  }

  async completeStep(businessId: string, step: string): Promise<OnboardingStepRecord> {
    const res = await query(
      `UPDATE onboarding_steps
         SET status = 'completed',
             completed_at = COALESCE(completed_at, NOW()),
             updated_at = NOW()
       WHERE business_id = $1 AND step = $2
       RETURNING *`,
      [businessId, step]
    );
    if (!res.rows.length) throw new Error(`Onboarding step "${step}" not found for business ${businessId}`);
    return this.rowToRecord(res.rows[0]);
  }

  async isComplete(businessId: string): Promise<boolean> {
    const res = await query(
      `SELECT status FROM onboarding_steps WHERE business_id = $1 AND step = 'complete'`,
      [businessId]
    );
    return res.rows.length > 0 && res.rows[0].status === "completed";
  }

  async markComplete(businessId: string): Promise<void> {
    await query(
      `UPDATE onboarding_steps SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
       WHERE business_id = $1 AND step = 'complete'`,
      [businessId]
    );
  }

  async getCurrentStep(businessId: string): Promise<string> {
    const res = await query(
      `SELECT step FROM onboarding_steps
         WHERE business_id = $1
         ORDER BY
           CASE status
             WHEN 'completed' THEN 1
             WHEN 'skipped' THEN 2
             ELSE 0
           END,
           sort_order ASC NULLS LAST,
           step ASC
         LIMIT 1`,
      [businessId]
    );
    return res.rows.length ? res.rows[0].step : "welcome";
  }

  private rowToRecord(r: Record<string, unknown>): OnboardingStepRecord {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      step: r.step as string,
      title: r.title as string,
      description: r.description as string | null,
      status: r.status as OnboardingStepStatus,
      completedAt: rowToDate(r.completed_at),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }
}

export const onboardingRepository = new OnboardingRepository();
