import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMetaTags } from "../hooks/useMetaTags";

describe("useMetaTags", () => {
  const originalTitle = document.title;

  beforeEach(() => {
    document.title = "";
    document.querySelectorAll("meta[name='robots']").forEach((el) => el.remove());
    document.querySelectorAll("meta[data-test-meta]").forEach((el) => el.remove());
  });

  afterEach(() => {
    document.title = originalTitle;
    document.querySelectorAll("meta").forEach((el) => {
      if (el.hasAttribute("data-test-meta") || el.getAttribute("name") === "robots") el.remove();
    });
  });

  it("sets document title", () => {
    renderHook(() => useMetaTags({ title: "My Page" }));
    expect(document.title).toBe("My Page");
  });

  it("resets title on cleanup", () => {
    document.title = "Original Title";
    const { unmount } = renderHook(() => useMetaTags({ title: "New Title" }));
    expect(document.title).toBe("New Title");
    unmount();
    expect(document.title).toBe("Original Title");
  });

  it("sets default title when no title provided", () => {
    renderHook(() => useMetaTags({}));
    expect(document.title).toBe("InvoiceFlow — Professional Invoice Generator");
  });

  it("sets description meta tag", () => {
    renderHook(() =>
      useMetaTags({ title: "Page", description: "A great page" })
    );

    const descMeta = document.querySelector('meta[name="description"]');
    expect(descMeta).not.toBeNull();
    expect(descMeta?.getAttribute("content")).toBe("A great page");
  });

  it("sets og:description and twitter:description", () => {
    renderHook(() =>
      useMetaTags({ title: "Page", description: "Social description" })
    );

    expect(document.querySelector('meta[property="og:description"]')?.getAttribute("content")).toBe("Social description");
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute("content")).toBe("Social description");
  });

  it("sets og:title and twitter:title", () => {
    renderHook(() => useMetaTags({ title: "My Title" }));

    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe("My Title");
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute("content")).toBe("My Title");
  });

  it("sets og:image and twitter:image tags", () => {
    renderHook(() =>
      useMetaTags({ title: "Page", image: "https://example.com/og.png" })
    );

    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe("https://example.com/og.png");
    expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute("content")).toBe("https://example.com/og.png");
  });

  it("sets og:image:alt", () => {
    renderHook(() =>
      useMetaTags({ title: "Page Title", image: "https://example.com/og.png" })
    );

    const altMeta = document.querySelector('meta[property="og:image:alt"]');
    expect(altMeta?.getAttribute("content")).toBe("Page Title");
  });

  it("sets og:url when url provided", () => {
    renderHook(() =>
      useMetaTags({ title: "Page", url: "https://example.com/page" })
    );

    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("https://example.com/page");
  });

  it("sets og:type as website when no url", () => {
    renderHook(() => useMetaTags({ title: "No URL Page" }));
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("website");
  });

  it("sets robots meta tag when noIndex is true", () => {
    renderHook(() => useMetaTags({ title: "Private", noIndex: true }));

    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta).not.toBeNull();
    expect(robotsMeta?.getAttribute("content")).toBe("noindex, nofollow");
  });

  it("does not set robots meta when noIndex is false or undefined", () => {
    renderHook(() => useMetaTags({ title: "Public" }));
    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta).toBeNull();
  });

  it("updates existing meta tag instead of creating duplicate", () => {
    const { rerender } = renderHook(
      ({ title, description }) => useMetaTags({ title, description }),
      { initialProps: { title: "Page 1", description: "Description 1" } }
    );

    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Description 1");

    rerender({ title: "Page 2", description: "Description 2" });

    const descriptionMetas = document.querySelectorAll('meta[name="description"]');
    expect(descriptionMetas.length).toBe(1);
    expect(descriptionMetas[0]?.getAttribute("content")).toBe("Description 2");
  });
});
