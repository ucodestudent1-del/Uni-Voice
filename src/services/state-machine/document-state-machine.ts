import { logger } from "../../utils/logger.js";

export type DocumentTypeKey =
  | "invoice"
  | "credit-note"
  | "quote"
  | "debit-note"
  | "payment-voucher"
  | "receipt"
  | "purchase-order";

export interface DocumentStateTransition {
  from: string;
  to: string;
  event: string;
}

export interface StateMachineEntry {
  transitions: Record<string, string[]>;
  terminalStatuses: Set<string>;
}

export const DOCUMENT_STATE_MACHINES: Record<DocumentTypeKey, StateMachineEntry> = {
  invoice: {
    transitions: {
      draft: ["sent", "cancelled", "void"],
      sent: ["viewed", "partially_paid", "paid", "overdue", "cancelled", "void"],
      viewed: ["partially_paid", "paid", "overdue", "cancelled", "void"],
      partially_paid: ["paid", "overdue", "cancelled", "void"],
      overdue: ["paid", "partially_paid", "cancelled", "void"],
      paid: [],
      cancelled: [],
      void: [],
    },
    terminalStatuses: new Set(["paid", "cancelled", "void"]),
  },
  quote: {
    transitions: {
      draft: ["sent", "rejected", "expired", "cancelled"],
      sent: ["accepted", "rejected", "expired", "cancelled"],
      accepted: ["converted", "cancelled"],
      viewed: ["accepted", "rejected", "expired", "cancelled"],
      rejected: ["cancelled"],
      expired: ["cancelled"],
      cancelled: [],
      converted: [],
    },
    terminalStatuses: new Set(["accepted", "converted", "cancelled"]),
  },
  "credit-note": {
    transitions: {
      draft: ["finalized", "cancelled", "void", "sent", "refunded", "applied", "partially_applied", "partially_refunded"],
      finalized: ["sent", "cancelled", "void", "refunded", "applied", "partially_applied", "partially_refunded"],
      sent: ["cancelled", "void", "refunded", "applied", "partially_applied", "partially_refunded"],
      cancelled: [],
      void: [],
      sent_sent: [],
      refunded: [],
      applied: [],
      partially_applied: [],
      partially_refunded: [],
    },
    terminalStatuses: new Set(["cancelled", "void", "refunded", "applied"]),
  },
  "debit-note": {
    transitions: {
      draft: ["finalized", "cancelled", "void"],
      finalized: ["sent", "cancelled", "void"],
      sent: ["cancelled", "void"],
      cancelled: [],
      void: [],
    },
    terminalStatuses: new Set(["cancelled", "void"]),
  },
  "payment-voucher": {
    transitions: {
      draft: ["issued", "cancelled", "void"],
      issued: ["cancelled", "void"],
      cancelled: [],
      void: [],
    },
    terminalStatuses: new Set(["cancelled", "void"]),
  },
  receipt: {
    transitions: {
      pending: ["issued", "sent", "failed"],
      issued: ["sent", "failed"],
      sent: ["failed"],
      failed: [],
    },
    terminalStatuses: new Set(["issued", "sent", "failed"]),
  },
  "purchase-order": {
    transitions: {
      draft: ["finalized", "cancelled", "void"],
      finalized: ["sent", "cancelled", "void"],
      sent: ["viewed", "received", "cancelled", "void"],
      viewed: ["received", "cancelled", "void"],
      received: ["cancelled", "void"],
      cancelled: [],
      void: [],
    },
    terminalStatuses: new Set(["cancelled", "void"]),
  },
};

export class DocumentStateMachine {
  canTransition(
    docType: DocumentTypeKey,
    currentStatus: string,
    nextStatus: string,
  ): boolean {
    const machine = DOCUMENT_STATE_MACHINES[docType];
    if (!machine) {
      logger.warn(`No state machine found for document type: ${docType}`);
      return false;
    }
    const allowed = machine.transitions[currentStatus] ?? [];
    return allowed.includes(nextStatus);
  }

  isTerminalStatus(docType: DocumentTypeKey, status: string): boolean {
    const machine = DOCUMENT_STATE_MACHINES[docType];
    if (!machine) return false;
    return machine.terminalStatuses.has(status);
  }

  getTransitions(docType: DocumentTypeKey, status: string): string[] {
    const machine = DOCUMENT_STATE_MACHINES[docType];
    if (!machine) return [];
    return machine.transitions[status] ?? [];
  }

  validateTransition(
    docType: DocumentTypeKey,
    currentStatus: string,
    nextStatus: string,
  ): { valid: boolean; error?: string } {
    const machine = DOCUMENT_STATE_MACHINES[docType];
    if (!machine) {
      return { valid: false, error: `Unknown document type: ${docType}` };
    }

    if (machine.terminalStatuses.has(currentStatus)) {
      return {
        valid: false,
        error: `Document is in terminal status '${currentStatus}' and cannot transition`,
      };
    }

    const allowed = machine.transitions[currentStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      return {
        valid: false,
        error: `Invalid transition from '${currentStatus}' to '${nextStatus}' for document type '${docType}'. Allowed: ${allowed.join(", ") || "none"}`,
      };
    }

    return { valid: true };
  }

  /**
   * Returns the event type string for a state transition.
   * Used for audit logging and event recording.
   */
  getEventForTransition(
    docType: DocumentTypeKey,
    fromStatus: string,
    toStatus: string,
  ): string | null {
    const eventMap: Record<DocumentTypeKey, Record<string, string>> = {
      invoice: {
        sent: "sent",
        viewed: "viewed",
        partially_paid: "partially_paid",
        paid: "paid",
        overdue: "overdue",
        cancelled: "cancelled",
        void: "voided",
      },
      quote: {
        sent: "sent",
        accepted: "accepted",
        rejected: "rejected",
        expired: "expired",
        cancelled: "cancelled",
        converted: "converted",
      },
      "credit-note": {
        finalized: "finalized",
        sent: "sent",
        refunded: "refunded",
        applied: "applied",
        partially_applied: "partially_applied",
        partially_refunded: "partially_refunded",
        cancelled: "cancelled",
        void: "voided",
      },
      "debit-note": {
        finalized: "finalized",
        sent: "sent",
        cancelled: "cancelled",
        void: "voided",
      },
      "payment-voucher": {
        issued: "issued",
        cancelled: "cancelled",
        void: "voided",
      },
      receipt: {
        issued: "issued",
        sent: "sent",
        failed: "failed",
      },
      "purchase-order": {
        finalized: "finalized",
        sent: "sent",
        viewed: "viewed",
        received: "received",
        cancelled: "cancelled",
        void: "voided",
      },
    };

    const docEvents = eventMap[docType];
    if (!docEvents) return null;
    return docEvents[toStatus] ?? toStatus;
  }
}

export const documentStateMachine = new DocumentStateMachine();
