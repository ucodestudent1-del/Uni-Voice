import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, buttonSizeClasses } from "@/components/ui/Button";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("uses primary variant by default", () => {
    const { container } = render(<Button>Test</Button>);
    expect(container.querySelector("button")).toHaveClass("bg-primary-action");
    expect(container.querySelector("button")).toHaveClass("text-on-primary");
  });

  it("applies secondary variant classes", () => {
    const { container } = render(<Button variant="secondary">Test</Button>);
    expect(container.querySelector("button")).toHaveClass("border");
    expect(container.querySelector("button")).toHaveClass("text-secondary");
  });

  it("applies danger variant classes", () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.querySelector("button")).toHaveClass("border-error-border");
    expect(container.querySelector("button")).toHaveClass("text-error-text");
  });

  it("applies ghost variant classes", () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    expect(container.querySelector("button")).toHaveClass("text-secondary");
  });

  it("applies link variant classes", () => {
    const { container } = render(<Button variant="link">Link</Button>);
    expect(container.querySelector("button")).toHaveClass("text-primary-brand");
  });

  it("applies sm size classes", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByText("Small")).toHaveClass("px-3");
    expect(screen.getByText("Small")).toHaveClass("text-xs");
  });

  it("applies md size classes (default)", () => {
    render(<Button size="md">Medium</Button>);
    expect(screen.getByText("Medium")).toHaveClass("px-4");
    expect(screen.getByText("Medium")).toHaveClass("text-sm");
  });

  it("applies lg size classes", () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByText("Large")).toHaveClass("px-5");
    expect(screen.getByText("Large")).toHaveClass("font-semibold");
  });

  it("renders icon on the left by default", () => {
    const icon = () => <span data-testid="icon">★</span>;
    const { container } = render(<Button icon={icon()}>Icon Left</Button>);
    const spans = container.querySelectorAll('[data-testid="icon"]');
    expect(spans.length).toBeGreaterThanOrEqual(1);
  });

  it("renders icon on the right when iconPosition is right", () => {
    const icon = <span data-testid="icon-right">★</span>;
    render(
      <Button icon={icon} iconPosition="right">
        Icon Right
      </Button>
    );
    expect(screen.getByTestId("icon-right")).toBeInTheDocument();
  });

  it("renders icon-only button when no children", () => {
    const icon = <span data-testid="icon-only">★</span>;
    const { container } = render(<Button icon={icon} />);
    expect(container.querySelector("button")).toHaveClass("px-2");
  });

  it("merges custom className", () => {
    render(<Button className="my-custom-class">Test</Button>);
    expect(screen.getByText("Test")).toHaveClass("my-custom-class");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("passes type=button by default", () => {
    const { container } = render(<Button>Test</Button>);
    expect(container.querySelector("button")).toHaveAttribute("type", "button");
  });

  it("forwards ref to the button element", () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Test</Button>);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });

  it("is disabled when disabled prop is true", () => {
    const { container } = render(<Button disabled>Test</Button>);
    expect(container.querySelector("button")).toBeDisabled();
  });

  it("passes through arbitrary HTML button attributes", () => {
    const { container } = render(<Button aria-label="custom-label">Test</Button>);
    expect(container.querySelector("button")).toHaveAttribute("aria-label", "custom-label");
  });
});

describe("buttonSizeClasses export", () => {
  it("exports size class mappings", () => {
    expect(buttonSizeClasses).toBeDefined();
    expect(typeof buttonSizeClasses).toBe("object");
    expect(buttonSizeClasses.sm).toBeDefined();
    expect(buttonSizeClasses.md).toBeDefined();
    expect(buttonSizeClasses.lg).toBeDefined();
  });
});
