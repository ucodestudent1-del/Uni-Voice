import type { Status } from "../../domain/models/index.js";
import { BusinessLogicError } from "../../domain/errors.js";

export type InvoiceStatus = Status;

export interface TransitionEvent {
  from: InvoiceStatus;
  to: InvoiceStatus;
  eventType: string;
  requiresPayment?: boolean;
  createdAt?: Date;
}

type TransitionMap = Record<InvoiceStatus, InvoiceStatus[]>;

export const ALLOWED_TRANSITIONS: TransitionMap = {
  draft: ["sent", "cancelled", "void"],
  sent: ["viewed", "partially_paid", "paid", "overdue", "cancelled", "void"],
  viewed: ["partially_paid", "paid", "overdue", "cancelled", "void"],
  partially_paid: ["paid", "overdue", "void"],
  overdue: ["paid", "void"],
  paid: [],
  cancelled: [],
  void: [],
};

export const TERMINAL_STATUSES: InvoiceStatus[] = ["paid", "cancelled", "void"];

export const CANCELLABLE_STATUSES: InvoiceStatus[] = ["draft", "sent", "viewed"];
export const VOIDABLE_STATUSES: InvoiceStatus[] = ["draft", "sent", "viewed", "partially_paid", "overdue"];

export interface OverdueCheckInput {
  status: InvoiceStatus;
  dueDate?: Date | null;
  amountDue: number | string;
  now?: Date;
}

/**
 * Centralized invoice state machine.
 *
 * All transitions are validated server-side. Callers must still persist the
 * new status in a transaction together with the triggering action.
 */
export class InvoiceStateMachine {
  canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
    if (from === to) return true;
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    return allowed.includes(to);
  }

  transition(from: InvoiceStatus, to: InvoiceStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BusinessLogicError(
        `Invalid status transition: ${from} -> ${to}`,
        "INVALID_TRANSITION",
        { from, to }
      );
    }
  }

  isTerminal(status: InvoiceStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
  }

  isCancellable(status: InvoiceStatus): boolean {
    return CANCELLABLE_STATUSES.includes(status);
  }

  isVoidable(status: InvoiceStatus): boolean {
    return VOIDABLE_STATUSES.includes(status);
  }

  /**
   * Returns the OVERDUE status if the invoice is open, past due, and still
   * has an outstanding balance. This is a *derived* state, not a manual
   * action.
   */
  determineOverdue(input: OverdueCheckInput): InvoiceStatus | null {
    const { status, dueDate, amountDue, now = new Date() } = input;
    if (TERMINAL_STATUSES.includes(status)) return null;
    if (status === "overdue") return null;
    if (Number(amountDue) <= 0) return null;
    if (!dueDate) return null;
    if (now >= dueDate) {
      return "overdue";
    }
    return null;
  }

  /**
   * Determine the status resulting from a payment against a current status.
   * Pure helper; does not validate transitions (use `transition` for that).
   */
  statusAfterPayment(current: InvoiceStatus, amountDue: number | string, amountPaid: number | string): InvoiceStatus {
    if (Number(amountDue) <= Number(amountPaid)) {
      return "paid";
    }
    if (Number(amountDue) > 0) {
      if (current === "draft" || current === "sent" || current === "viewed") {
        return "partially_paid";
      }
      return current;
    }
    return current;
  }
}

export const invoiceStateMachine = new InvoiceStateMachine();