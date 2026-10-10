import { Decimal } from "decimal.js";
import type { CreditNoteStatus } from "../../domain/models/index.js";
import { BusinessLogicError } from "../../domain/errors.js";

export type CreditNoteStatusInternal = CreditNoteStatus;

type CreditNoteTransitionMap = Record<CreditNoteStatusInternal, readonly CreditNoteStatusInternal[]>;

export const CREDIT_NOTE_ALLOWED_TRANSITIONS: CreditNoteTransitionMap = {
  draft: ["finalized", "cancelled"],
  finalized: ["sent", "partially_applied", "applied", "partially_refunded", "refunded", "cancelled"],
  sent: ["partially_applied", "applied", "partially_refunded", "refunded", "cancelled", "void"],
  partially_applied: ["applied", "partially_refunded", "refunded", "void"],
  applied: ["partially_refunded", "refunded", "void"],
  partially_refunded: ["refunded", "applied", "partially_applied", "void"],
  refunded: [],
  cancelled: [],
  void: [],
};

const CREDIT_NOTE_TRANSITIONS_SETS: Record<CreditNoteStatusInternal, Set<CreditNoteStatusInternal>> = (() => {
  const m: Record<string, Set<CreditNoteStatusInternal>> = {};
  for (const status of Object.keys(CREDIT_NOTE_ALLOWED_TRANSITIONS)) {
    m[status] = new Set(CREDIT_NOTE_ALLOWED_TRANSITIONS[status as CreditNoteStatusInternal]);
  }
  return m as Record<CreditNoteStatusInternal, Set<CreditNoteStatusInternal>>;
})();

export const CREDIT_NOTE_TERMINAL_STATUSES: readonly CreditNoteStatusInternal[] = [
  "applied",
  "refunded",
  "cancelled",
  "void",
];
export const CREDIT_NOTE_TERMINAL_STATUSES_SET = new Set(CREDIT_NOTE_TERMINAL_STATUSES);

export const CREDIT_NOTE_OPEN_STATUSES: readonly CreditNoteStatusInternal[] = [
  "draft",
  "finalized",
  "sent",
  "partially_applied",
  "partially_refunded",
];
export const CREDIT_NOTE_OPEN_STATUSES_SET = new Set(CREDIT_NOTE_OPEN_STATUSES);

export const CREDIT_NOTE_ACTIVE_STATUSES: readonly CreditNoteStatusInternal[] = [
  "draft",
  "finalized",
  "sent",
  "partially_applied",
  "partially_refunded",
  "applied",
  "refunded",
];

export interface CreditNoteStatusInput {
  status: CreditNoteStatusInternal;
  total: Decimal.Value;
  appliedTotal: Decimal.Value;
  refundedTotal?: Decimal.Value;
  amountDue: Decimal.Value;
}

export class CreditNoteStateMachine {
  canTransition(from: CreditNoteStatusInternal, to: CreditNoteStatusInternal): boolean {
    if (from === to) return true;
    return CREDIT_NOTE_TRANSITIONS_SETS[from]?.has(to) ?? false;
  }

  transition(from: CreditNoteStatusInternal, to: CreditNoteStatusInternal): void {
    if (!this.canTransition(from, to)) {
      throw new BusinessLogicError(
        `Invalid credit note status transition: ${from} -> ${to}`,
        "INVALID_CREDIT_NOTE_TRANSITION",
        { from, to }
      );
    }
  }

  isTerminal(status: CreditNoteStatusInternal): boolean {
    return CREDIT_NOTE_TERMINAL_STATUSES_SET.has(status);
  }

  isOpen(status: CreditNoteStatusInternal): boolean {
    return CREDIT_NOTE_OPEN_STATUSES_SET.has(status);
  }

  isCancelled(status: CreditNoteStatusInternal): boolean {
    return status === "cancelled";
  }

  isVoided(status: CreditNoteStatusInternal): boolean {
    return status === "void";
  }

  isFinalized(status: CreditNoteStatusInternal): boolean {
    return !CREDIT_NOTE_OPEN_STATUSES_SET.has(status) && status !== "draft";
  }

  isCancellable(status: CreditNoteStatusInternal): boolean {
    return status === "draft";
  }

  isVoidable(status: CreditNoteStatusInternal): boolean {
    return CREDIT_NOTE_ACTIVE_STATUSES.includes(status);
  }

  /**
   * Compute the status based on financial amounts.
   * - If fully applied (appliedTotal >= total), status is "applied"
   * - If partially applied, status is "partially_applied"
   * - If fully refunded, status is "refunded"
   * - If partially refunded, status is "partially_refunded"
   * - Otherwise, preserve the current status
   */
  computeStatus(input: CreditNoteStatusInput): CreditNoteStatusInternal | null {
    const { total, appliedTotal, refundedTotal = 0, amountDue } = input;
    const t = new Decimal(total.toString());
    const at = new Decimal(appliedTotal.toString());
    const rt = new Decimal(refundedTotal.toString());
    const due = new Decimal(amountDue.toString());

    if (at.gte(t) && at.gt(0)) {
      return "applied";
    }
    if (at.gt(0) && at.lt(t)) {
      return "partially_applied";
    }
    if (rt.gte(t) && rt.gt(0)) {
      return "refunded";
    }
    if (rt.gt(0) && rt.lt(t)) {
      return "partially_refunded";
    }
    if (due.lte(0) && t.gt(0)) {
      return "applied";
    }
    return null;
  }
}

export const creditNoteStateMachine = new CreditNoteStateMachine();
