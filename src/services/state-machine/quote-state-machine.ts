import type { QuoteStatus } from "../../domain/models/index.js";
import { BusinessLogicError } from "../../domain/errors.js";

export type QuoteStatusInternal = QuoteStatus;

type QuoteTransitionMap = Record<QuoteStatusInternal, readonly QuoteStatusInternal[]>;

export const QUOTE_ALLOWED_TRANSITIONS: QuoteTransitionMap = {
  draft: ["sent", "cancelled"],
  sent: ["viewed", "accepted", "rejected", "expired", "cancelled"],
  viewed: ["accepted", "rejected", "expired", "cancelled"],
  accepted: ["cancelled"],
  rejected: [],
  expired: [],
  cancelled: [],
};

const QUOTE_TRANSITIONS_SETS: Record<QuoteStatusInternal, Set<QuoteStatusInternal>> = (() => {
  const m: Record<string, Set<QuoteStatusInternal>> = {};
  for (const status of Object.keys(QUOTE_ALLOWED_TRANSITIONS)) {
    m[status] = new Set(QUOTE_ALLOWED_TRANSITIONS[status as QuoteStatusInternal]);
  }
  return m as Record<QuoteStatusInternal, Set<QuoteStatusInternal>>;
})();

export const QUOTE_TERMINAL_STATUSES: readonly QuoteStatusInternal[] = [
  "accepted",
  "rejected",
  "expired",
  "cancelled",
];
export const QUOTE_TERMINAL_STATUSES_SET = new Set(QUOTE_TERMINAL_STATUSES);

export const QUOTE_OPEN_STATUSES: readonly QuoteStatusInternal[] = ["draft", "sent", "viewed"];
export const QUOTE_OPEN_STATUSES_SET = new Set(QUOTE_OPEN_STATUSES);

export interface QuoteExpiryCheckInput {
  status: QuoteStatusInternal;
  expiryDate?: Date | null;
  now?: Date;
}

export class QuoteStateMachine {
  canTransition(from: QuoteStatusInternal, to: QuoteStatusInternal): boolean {
    if (from === to) return true;
    return QUOTE_TRANSITIONS_SETS[from]?.has(to) ?? false;
  }

  transition(from: QuoteStatusInternal, to: QuoteStatusInternal): void {
    if (!this.canTransition(from, to)) {
      throw new BusinessLogicError(
        `Invalid quote status transition: ${from} -> ${to}`,
        "INVALID_QUOTE_TRANSITION",
        { from, to }
      );
    }
  }

  isTerminal(status: QuoteStatusInternal): boolean {
    return QUOTE_TERMINAL_STATUSES_SET.has(status);
  }

  isOpen(status: QuoteStatusInternal): boolean {
    return QUOTE_OPEN_STATUSES_SET.has(status);
  }

  /**
   * Returns 'expired' if the quote is open and past its expiry date.
   * This is a derived state — not a manual action.
   */
  determineExpired(input: QuoteExpiryCheckInput): QuoteStatusInternal | null {
    const { status, expiryDate, now = new Date() } = input;
    if (QUOTE_TERMINAL_STATUSES.includes(status)) return null;
    if (status === "expired") return null;
    if (!expiryDate) return null;
    if (now >= expiryDate) {
      return "expired";
    }
    return null;
  }

  /**
   * Determine the deposit status for a quote.
   * Returns 'paid' if deposit fully covered, 'partial' if partially covered,
   * 'outstanding' if no deposit payment recorded.
   */
  depositStatus(
    depositType: "none" | "percentage" | "fixed",
    depositValue: string | number,
    total: string | number,
    amountPaid: string | number
  ): "outstanding" | "partial" | "paid" {
    if (depositType === "none") return "paid";

    let depositDue: number;
    if (depositType === "percentage") {
      depositDue = Number(total) * (Number(depositValue) / 100);
    } else {
      depositDue = Number(depositValue);
    }

    const paid = Number(amountPaid);
    if (paid <= 0) return "outstanding";
    if (paid >= depositDue) return "paid";
    return "partial";
  }
}

export const quoteStateMachine = new QuoteStateMachine();
