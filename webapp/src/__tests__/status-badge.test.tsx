import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, invoiceStatusConfig, paymentStatusConfig, customerStatusConfig, projectStatusConfig, isOverdueStatus, getStatusBadgeClassName } from "@/components/ui/StatusBadge";
import { CheckCircle } from "lucide-react";

describe("StatusBadge", () => {
  describe("InvoiceStatusConfig", () => {
    it("returns 'Draft' config for draft status", () => {
      const config = invoiceStatusConfig.getConfig("draft");
      expect(config.label).toBe("Draft");
      expect(config.className).toContain("status-warning");
    });

    it("returns 'Paid' config for paid status", () => {
      const config = invoiceStatusConfig.getConfig("paid");
      expect(config.label).toBe("Paid");
      expect(config.className).toContain("status-success");
    });

    it("returns 'Overdue' config for overdue status", () => {
      const config = invoiceStatusConfig.getConfig("overdue");
      expect(config.label).toBe("Overdue");
      expect(config.className).toContain("status-error");
    });

    it("returns default config for unknown status", () => {
      const config = invoiceStatusConfig.getConfig("unknown_status");
      expect(config.label).toBe("Draft");
    });
  });

  describe("PaymentStatusConfig", () => {
    it("returns 'Paid' config for paid status", () => {
      const config = paymentStatusConfig.getConfig("paid");
      expect(config.label).toBe("Paid");
    });

    it("returns 'Pending' config for unknown status (default)", () => {
      const config = paymentStatusConfig.getConfig("unknown");
      expect(config.label).toBe("Pending");
    });
  });

  describe("CustomerStatusConfig", () => {
    it("returns 'Active' config for active status", () => {
      const config = customerStatusConfig.getConfig("active");
      expect(config.label).toBe("Active");
    });

    it("returns 'Inactive' config for inactive status", () => {
      const config = customerStatusConfig.getConfig("inactive");
      expect(config.label).toBe("Inactive");
    });
  });

  describe("ProjectStatusConfig", () => {
    it("returns 'Planning' config for planning status", () => {
      const config = projectStatusConfig.getConfig("planning");
      expect(config.label).toBe("Planning");
    });

    it("returns 'Completed' config for completed status", () => {
      const config = projectStatusConfig.getConfig("completed");
      expect(config.label).toBe("Completed");
    });
  });

  describe("isOverdueStatus", () => {
    it("returns true for 'overdue' status", () => {
      expect(isOverdueStatus("overdue")).toBe(true);
    });

    it("returns false for 'paid' status", () => {
      expect(isOverdueStatus("paid")).toBe(false);
    });

    it("returns false for 'void' status", () => {
      expect(isOverdueStatus("void")).toBe(false);
    });

    it("returns false for 'cancelled' status", () => {
      expect(isOverdueStatus("cancelled")).toBe(false);
    });

    it("returns true for 'sent' status with past due date", () => {
      expect(isOverdueStatus("sent", "2020-01-01")).toBe(true);
    });

    it("returns false for 'sent' status with future due date", () => {
      expect(isOverdueStatus("sent", "2099-01-01")).toBe(false);
    });

    it("returns false when no due date provided", () => {
      expect(isOverdueStatus("sent")).toBe(false);
    });
  });

  describe("getStatusBadgeClassName", () => {
    it("returns md size classes by default", () => {
      const cls = getStatusBadgeClassName({ label: "Test", className: "test-class" });
      expect(cls).toContain("px-2.5");
      expect(cls).toContain("py-1");
      expect(cls).toContain("test-class");
    });

    it("returns sm size classes when size is sm", () => {
      const cls = getStatusBadgeClassName({ label: "Test", className: "test-class" }, "sm");
      expect(cls).toContain("px-2");
      expect(cls).toContain("py-0.5");
    });

    it("applies base badge classes", () => {
      const cls = getStatusBadgeClassName({ label: "Test", className: "" });
      expect(cls).toContain("inline-flex");
      expect(cls).toContain("items-center");
      expect(cls).toContain("rounded-full");
      expect(cls).toContain("font-medium");
    });
  });

  describe("StatusBadge component rendering", () => {
    it("renders status label", () => {
      render(
        <StatusBadge status="paid" config={invoiceStatusConfig} />
      );
      expect(screen.getByText("Paid")).toBeInTheDocument();
    });

    it("renders with custom className", () => {
      render(
        <StatusBadge status="paid" config={invoiceStatusConfig} className="custom-class" />
      );
      const badge = screen.getByText("Paid");
      expect(badge).toHaveClass("custom-class");
    });

    it("renders without label when showLabel is false", () => {
      render(
        <StatusBadge status="paid" config={invoiceStatusConfig} showLabel={false} />
      );
      expect(screen.queryByText("Paid")).not.toBeInTheDocument();
    });

    it("shows icon when showIcon is true and config has icon", () => {
      const iconConfig: Record<string, { label: string; className: string; icon: () => JSX.Element }> = {
        paid: { label: "Paid", className: "status-success-bg status-success-text", icon: () => <CheckCircle data-testid="paid-icon" /> },
      };
      render(
        <StatusBadge
          status="paid"
          config={{
            configs: iconConfig,
            getConfig: (s: string) => iconConfig[s] ?? iconConfig.paid,
          }}
          showIcon
        />
      );
      expect(screen.getByTestId("paid-icon")).toBeInTheDocument();
    });

    it("does not show icon when showIcon is false", () => {
      render(
        <StatusBadge status="paid" config={invoiceStatusConfig} showIcon={false} />
      );
      const badge = screen.getByText("Paid").closest("span");
      expect(badge?.querySelector("svg")).not.toBeInTheDocument();
    });

    it("applies overdue conversion when isOverdue is true", () => {
      render(
        <StatusBadge
          status="sent"
          config={invoiceStatusConfig}
          isOverdue
        />
      );
      expect(screen.getByText("Overdue")).toBeInTheDocument();
    });

    it("does not apply overdue conversion for paid invoices", () => {
      render(
        <StatusBadge
          status="paid"
          config={invoiceStatusConfig}
          isOverdue
        />
      );
      expect(screen.getByText("Paid")).toBeInTheDocument();
    });

    it("renders sm size correctly", () => {
      const { container } = render(
        <StatusBadge status="paid" config={invoiceStatusConfig} size="sm" />
      );
      const badge = container.querySelector("span");
      expect(badge).toHaveClass("px-2");
      expect(badge).toHaveClass("py-1");
    });

    it("renders md size by default", () => {
      const { container } = render(
        <StatusBadge status="paid" config={invoiceStatusConfig} />
      );
      const badge = container.querySelector("span");
      expect(badge).toHaveClass("px-2.5");
    });

    it("has accessible aria-label", () => {
      render(
        <StatusBadge status="paid" config={invoiceStatusConfig} />
      );
      const badge = screen.getByText("Paid");
      expect(badge).toHaveAttribute("aria-label");
      expect(badge.getAttribute("aria-label")).toContain("paid");
    });
  });
});
