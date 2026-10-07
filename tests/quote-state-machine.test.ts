import { describe, it, expect } from "vitest";
import {
  QuoteStateMachine,
  QUOTE_ALLOWED_TRANSITIONS,
  QUOTE_TERMINAL_STATUSES,
  QUOTE_OPEN_STATUSES,
  quoteStateMachine,
} from "../src/services/state-machine/quote-state-machine.js";
import { BusinessLogicError } from "../src/domain/errors.js";

const sm = new QuoteStateMachine();

describe("QuoteStateMachine", () => {
  describe("canTransition", () => {
    it("allows draft -> sent", () => {
      expect(sm.canTransition("draft", "sent")).toBe(true);
    });

    it("allows draft -> cancelled", () => {
      expect(sm.canTransition("draft", "cancelled")).toBe(true);
    });

    it("disallows draft -> accepted (must be sent first)", () => {
      expect(sm.canTransition("draft", "accepted")).toBe(false);
    });

    it("allows sent -> viewed", () => {
      expect(sm.canTransition("sent", "viewed")).toBe(true);
    });

    it("allows sent -> accepted", () => {
      expect(sm.canTransition("sent", "accepted")).toBe(true);
    });

    it("allows sent -> rejected", () => {
      expect(sm.canTransition("sent", "rejected")).toBe(true);
    });

    it("allows sent -> expired", () => {
      expect(sm.canTransition("sent", "expired")).toBe(true);
    });

    it("allows viewed -> accepted", () => {
      expect(sm.canTransition("viewed", "accepted")).toBe(true);
    });

    it("allows viewed -> rejected", () => {
      expect(sm.canTransition("viewed", "rejected")).toBe(true);
    });

    it("disallows sent -> draft", () => {
      expect(sm.canTransition("sent", "draft")).toBe(false);
    });

    it("disallows accepted -> sent", () => {
      expect(sm.canTransition("accepted", "sent")).toBe(false);
    });

    it("disallows accepted -> viewed", () => {
      expect(sm.canTransition("accepted", "viewed")).toBe(false);
    });

    it("disallows rejected -> accepted", () => {
      expect(sm.canTransition("rejected", "accepted")).toBe(false);
    });

    it("transition to same state is allowed (idempotent)", () => {
      expect(sm.canTransition("sent", "sent")).toBe(true);
    });
  });

  describe("transition (validation)", () => {
    it("throws BusinessLogicError on invalid transition", () => {
      expect(() => sm.transition("draft", "accepted")).toThrow(BusinessLogicError);
      expect(() => sm.transition("accepted", "sent")).toThrow(BusinessLogicError);
      expect(() => sm.transition("rejected", "accepted")).toThrow(BusinessLogicError);
    });

    it("throws with INVALID_QUOTE_TRANSITION code", () => {
      try {
        sm.transition("draft", "accepted");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessLogicError);
        expect((e as BusinessLogicError).code).toBe("INVALID_QUOTE_TRANSITION");
      }
    });

    it("does not throw on valid transition", () => {
      expect(() => sm.transition("sent", "viewed")).not.toThrow();
      expect(() => sm.transition("sent", "accepted")).not.toThrow();
      expect(() => sm.transition("draft", "cancelled")).not.toThrow();
    });
  });

  describe("isTerminal", () => {
    it("returns true for accepted", () => {
      expect(sm.isTerminal("accepted")).toBe(true);
    });

    it("returns true for rejected", () => {
      expect(sm.isTerminal("rejected")).toBe(true);
    });

    it("returns true for expired", () => {
      expect(sm.isTerminal("expired")).toBe(true);
    });

    it("returns true for cancelled", () => {
      expect(sm.isTerminal("cancelled")).toBe(true);
    });

    it("returns false for draft", () => {
      expect(sm.isTerminal("draft")).toBe(false);
    });

    it("returns false for sent", () => {
      expect(sm.isTerminal("sent")).toBe(false);
    });

    it("returns false for viewed", () => {
      expect(sm.isTerminal("viewed")).toBe(false);
    });
  });

  describe("isOpen", () => {
    it("returns true for draft, sent, viewed", () => {
      expect(sm.isOpen("draft")).toBe(true);
      expect(sm.isOpen("sent")).toBe(true);
      expect(sm.isOpen("viewed")).toBe(true);
    });

    it("returns false for terminal statuses", () => {
      expect(sm.isOpen("accepted")).toBe(false);
      expect(sm.isOpen("rejected")).toBe(false);
      expect(sm.isOpen("expired")).toBe(false);
      expect(sm.isOpen("cancelled")).toBe(false);
    });
  });

  describe("determineExpired", () => {
    it("returns expired when quote is open and past expiry date", () => {
      const now = new Date("2026-10-01");
      expect(
        sm.determineExpired({ status: "sent", expiryDate: new Date("2026-09-01"), now })
      ).toBe("expired");
    });

    it("returns expired for viewed quotes past expiry", () => {
      const now = new Date("2026-10-01");
      expect(
        sm.determineExpired({ status: "viewed", expiryDate: new Date("2026-09-01"), now })
      ).toBe("expired");
    });

    it("returns null when before expiry date", () => {
      const now = new Date("2026-09-01");
      expect(
        sm.determineExpired({ status: "sent", expiryDate: new Date("2026-10-01"), now })
      ).toBeNull();
    });

    it("returns null when no expiry date", () => {
      const now = new Date("2026-10-01");
      expect(sm.determineExpired({ status: "sent", expiryDate: null, now })).toBeNull();
    });

    it("returns null for terminal statuses", () => {
      const now = new Date("2026-10-01");
      expect(
        sm.determineExpired({ status: "accepted", expiryDate: new Date("2026-09-01"), now })
      ).toBeNull();
      expect(
        sm.determineExpired({ status: "cancelled", expiryDate: new Date("2026-09-01"), now })
      ).toBeNull();
    });
  });

  describe("depositStatus", () => {
    it("returns 'paid' when depositType is none", () => {
      expect(
        sm.depositStatus("none", 0, 1000, 0)
      ).toBe("paid");
    });

    it("returns 'outstanding' when no payment recorded", () => {
      expect(
        sm.depositStatus("fixed", 100, 1000, 0)
      ).toBe("outstanding");
    });

    it("returns 'paid' when fixed deposit fully covered", () => {
      expect(
        sm.depositStatus("fixed", 100, 1000, 100)
      ).toBe("paid");
    });

    it("returns 'partial' when fixed deposit partially covered", () => {
      expect(
        sm.depositStatus("fixed", 100, 1000, 50)
      ).toBe("partial");
    });

    it("returns 'paid' when percentage deposit fully covered", () => {
      expect(
        sm.depositStatus("percentage", 20, 1000, 200)
      ).toBe("paid");
    });

    it("returns 'partial' when percentage deposit partially covered", () => {
      expect(
        sm.depositStatus("percentage", 20, 1000, 100)
      ).toBe("partial");
    });

    it("returns 'paid' when overpaid", () => {
      expect(
        sm.depositStatus("fixed", 100, 1000, 150)
      ).toBe("paid");
    });
  });

  describe("completeness", () => {
    it("every status has an entry in the transition map", () => {
      const all = Object.keys(QUOTE_ALLOWED_TRANSITIONS);
      const expected = ["draft", "sent", "viewed", "accepted", "rejected", "expired", "cancelled"];
      expect(all.sort()).toEqual([...expected].sort());
    });

    it("terminal statuses have no outgoing transitions except accepted->cancelled", () => {
      for (const status of QUOTE_TERMINAL_STATUSES) {
        if (status === "accepted") {
          expect(QUOTE_ALLOWED_TRANSITIONS[status]).toEqual(["cancelled"]);
        } else {
          expect(QUOTE_ALLOWED_TRANSITIONS[status]).toEqual([]);
        }
      }
    });

    it("open statuses have at least one outgoing transition", () => {
      for (const status of QUOTE_OPEN_STATUSES) {
        expect(QUOTE_ALLOWED_TRANSITIONS[status].length).toBeGreaterThan(0);
      }
    });
  });

  describe("singleton", () => {
    it("exports a shared instance", () => {
      expect(quoteStateMachine).toBeInstanceOf(QuoteStateMachine);
    });
  });
});
