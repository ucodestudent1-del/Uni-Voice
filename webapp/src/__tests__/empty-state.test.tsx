import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmptyState from "@/components/ui/EmptyState";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

describe("EmptyState", () => {
  it("renders with default props", () => {
    render(<EmptyState />);
    expect(screen.getByText("No items yet")).toBeInTheDocument();
  });

  it("renders custom title", () => {
    render(<EmptyState title="No customers found" />);
    expect(screen.getByText("No customers found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState description="You haven't created any customers yet." />);
    expect(screen.getByText("You haven't created any customers yet.")).toBeInTheDocument();
  });

  it("renders action button when onAction is provided", () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Add customer" onAction={onAction} />);
    expect(screen.getByText("Add customer")).toBeInTheDocument();
  });

  it("calls onAction when button is clicked", () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Add customer" onAction={onAction} />);
    fireEvent.click(screen.getByText("Add customer"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not render action button when onAction is not provided", () => {
    const { container } = render(<EmptyState />);
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(0);
  });

  it("renders icon when provided", () => {
    const icon = <span data-testid="custom-icon">★</span>;
    render(<EmptyState icon={icon} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders compact variant", () => {
    const { container } = render(<EmptyState variant="compact" />);
    expect(container.firstChild).toHaveClass("text-center");
    expect(container.firstChild).toHaveClass("py-6");
  });

  it("renders sidebar variant", () => {
    const { container } = render(<EmptyState variant="sidebar" title="Empty sidebar" />);
    expect(container.firstChild).toHaveClass("py-8");
    expect(screen.getByText("Empty sidebar")).toBeInTheDocument();
  });

  it("renders loading variant", () => {
    const { container } = render(<EmptyState variant="loading" title="Loading…" />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders error variant", () => {
    render(<EmptyState variant="error" title="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("error variant renders retry button with icon", () => {
    const onAction = vi.fn();
    render(<EmptyState variant="error" title="Error" actionLabel="Retry" onAction={onAction} />);
    const retryButton = screen.getByText("Retry");
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("merges className prop", () => {
    const { container } = render(<EmptyState className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("loading variant shows default 'Loading...' text when no title", () => {
    render(<EmptyState variant="loading" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("sidebar variant uses link-style button", () => {
    const onAction = vi.fn();
    render(<EmptyState variant="sidebar" title="No results" actionLabel="Clear filters" onAction={onAction} />);
    const button = screen.getByText("Clear filters");
    expect(button).toBeInTheDocument();
  });
});

describe("ConfirmationDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Are you sure?",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when open is false", () => {
    const { container } = render(<ConfirmationDialog {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders title when open", () => {
    render(<ConfirmationDialog {...defaultProps} />);
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("renders message when provided", () => {
    render(<ConfirmationDialog {...defaultProps} message="This action cannot be undone." />);
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("renders cancel and confirm buttons", () => {
    render(<ConfirmationDialog {...defaultProps} />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("renders custom confirm and cancel labels", () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        confirmLabel="Delete"
        cancelLabel="Keep it"
      />
    );
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Keep it")).toBeInTheDocument();
  });

  it("calls onClose when cancel button clicked", () => {
    const onClose = vi.fn();
    render(<ConfirmationDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({});
  });

  it("applies destructive styling when destructive is true", () => {
    render(<ConfirmationDialog {...defaultProps} destructive />);
    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).toHaveClass("border-error-border");
  });

  it("shows confirmation input when showInput is true", () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        showInput
        inputLabel="Type DELETE to confirm"
      />
    );
    expect(screen.getByText("Type DELETE to confirm")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("disables confirm when inputRequiredMatch does not match", () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        showInput
        inputLabel="Confirm"
        inputRequiredMatch="DELETE"
      />
    );
    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).toBeDisabled();
  });

  it("enables confirm when inputRequiredMatch matches (controlled inputValue)", () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        showInput
        inputLabel="Confirm"
        inputRequiredMatch="DELETE"
        inputValue="DELETE"
      />
    );
    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).not.toBeDisabled();
  });

  it("calls onConfirm with input data when showInput and confirmed", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        {...defaultProps}
        showInput
        inputLabel="confirmation"
        inputRequiredMatch="DELETE"
        inputValue="DELETE"
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith({ confirmation: "DELETE" });
  });

  it("enables confirm after typing matching text (uncontrolled)", () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        showInput
        inputLabel="Confirm"
        inputRequiredMatch="DELETE"
      />
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "DELETE" } });
    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).not.toBeDisabled();
  });

  it("shows 'Processing…' text when isLoading is true", () => {
    render(<ConfirmationDialog {...defaultProps} isLoading />);
    expect(screen.getByText("Processing…")).toBeInTheDocument();
  });

  it("disables both action buttons when isLoading is true", () => {
    render(<ConfirmationDialog {...defaultProps} isLoading />);
    const confirmButton = screen.getByRole("button", { name: "Processing…" });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it("has a close button (X)", () => {
    render(<ConfirmationDialog {...defaultProps} />);
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
  });

  it("calls onClose when close (X) button clicked", () => {
    const onClose = vi.fn();
    render(<ConfirmationDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
