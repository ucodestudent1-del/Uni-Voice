import { describe, it, expect } from "vitest";
import { InvoiceStateMachine, ALLOWED_TRANSITIONS } from "../src/services/state-machine/invoice-state-machine.js";
import { BusinessLogicError } from "../src/domain/errors.js";

const sm = new InvoiceStateMachine();

describe("InvoiceStateMachine", () => {
  describe("canTransition", () => {
    it("allows draft -> sent", () => {
      expect(sm.canTransition("draft", "sent")).toBe(true);
    });
    it("allows draft -> cancelled", () => {
      expect(sm.canTransition("draft", "cancelled")).toBe(true);
    });
    it("disallows draft -> paid", () => {
      expect(sm.canTransition("draft", "paid")).toBe(false);
    });
    it("allows sent -> viewed -> partially_paid -> paid", () => {
      expect(sm.canTransition("sent", "viewed")).toBe(true);
      expect(sm.canTransition("viewed", "partially_paid")).toBe(true);
      expect(sm.canTransition("partially_paid", "paid")).toBe(true);
    });
    it("disallows sent -> draft (no go-back)", () => {
      expect(sm.canTransition("sent", "draft")).toBe(false);
    });
    it("allows any open status -> void", () => {
      expect(sm.canTransition("draft", "void")).toBe(true);
      expect(sm.canTransition("sent", "void")).toBe(true);
      expect(sm.canTransition("viewed", "void")).toBe(true);
      expect(sm.canTransition("partially_paid", "void")).toBe(true);
      expect(sm.canTransition("overdue", "void")).toBe(true);
    });
    it("disallows paid -> void", () => {
      expect(sm.canTransition("paid", "void")).toBe(false);
    });
    it("disallows transitions from terminal states", () => {
      for (const terminal of ["paid", "cancelled", "void"] as const) {
        for (const to of ["sent", "viewed", "paid", "void", "cancelled"] as const) {
          expect(sm.canTransition(terminal, to)).toBe(terminal === to);
        }
      }
    });
    it("transition to same state is allowed (idempotent)", () => {
      expect(sm.canTransition("sent", "sent")).toBe(true);
    });
  });

  describe("transition (validation)", () => {
    it("throws BusinessLogicError on invalid transition", () => {
      expect(() => sm.transition("draft", "paid")).toThrow(BusinessLogicError);
      expect(() => sm.transition("paid", "void")).toThrow(BusinessLogicError);
    });
    it("does not throw on valid transition", () => {
      expect(() => sm.transition("sent", "viewed")).not.toThrow();
    });
  });

  describe("determineOverdue", () => {
    it("marks overdue when past due and unpaid", () => {
      const now = new Date("2026-10-01");
      expect(
        sm.determineOverdue({ status: "sent", dueDate: new Date("2026-09-01"), amountDue: 100, now })
      ).toBe("overdue");
    });
    it("does not mark overdue when fully paid", () => {
      const now = new Date("2026-10-01");
      expect(
        sm.determineOverdue({ status: "sent", dueDate: new Date("2026-09-01"), amountDue: 0, now })
      ).toBeNull();
    });
    it("does not mark overdue before due date", () => {
      const now = new Date("2026-09-01");
      expect(
        sm.determineOverdue({ status: "sent", dueDate: new Date("2026-09-15"), amountDue: 100, now })
      ).toBeNull();
    });
    it("does not mark overdue when terminal", () => {
      const now = new Date("2026-10-01");
      expect(
        sm.determineOverdue({ status: "paid", dueDate: new Date("2026-09-01"), amountDue: 0, now })
      ).toBeNull();
    });
    it("does not mark overdue without a due date", () => {
      const now = new Date("2026-10-01");
      expect(
        sm.determineOverdue({ status: "sent", dueDate: null, amountDue: 100, now })
      ).toBeNull();
    });
  });

  describe("statusAfterPayment", () => {
    it("marks paid when fully paid", () => {
      expect(sm.statusAfterPayment("sent", 100, 100)).toBe("paid");
    });
    it("marks partially_paid from sent when partial", () => {
      expect(sm.statusAfterPayment("sent", 100, 40)).toBe("partially_paid");
    });
    it("stays partially_paid when already partial and still balance", () => {
      expect(sm.statusAfterPayment("partially_paid", 100, 40)).toBe("partially_paid");
    });
    it("moves to paid from overdue when balance cleared", () => {
      expect(sm.statusAfterPayment("overdue", 100, 100)).toBe("paid");
    });
  });

  describe("completeness", () => {
    it("every status has an entry in the transition map", () => {
      const all = Object.keys(ALLOWED_TRANSITIONS);
      const expected = [
        "draft", "sent", "viewed", "partially_paid", "overdue", "paid", "cancelled", "void",
      ];
      expect(all.sort()).toEqual([...expected].sort());
    });
  });
});
