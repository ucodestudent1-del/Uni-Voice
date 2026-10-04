import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a function", () => {
    const { result } = renderHook(() =>
      useDebouncedCallback(() => {}, 100)
    );
    expect(typeof result.current).toBe("function");
  });

  it("calls the callback after the specified delay", () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(callback, 100)
    );

    act(() => {
      result.current("value");
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("value");
  });

  it("debounces multiple calls and only fires the last one", () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(callback, 100)
    );

    act(() => {
      result.current("first");
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    act(() => {
      result.current("second");
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    act(() => {
      result.current("third");
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("third");
  });

  it("clears previous timeout on each new call", () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(callback, 200)
    );

    act(() => {
      result.current("a");
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current("b");
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("b");
  });

  it("uses the latest callback function (refs are updated)", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const { result, rerender } = renderHook(({ cb }) =>
      useDebouncedCallback(cb, 100),
      { initialProps: { cb: callback1 } }
    );

    act(() => {
      result.current("first");
    });

    rerender({ cb: callback2 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledWith("first");
  });

  it("works with different generic types (number)", () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback<number>(callback, 50)
    );

    act(() => {
      result.current(42);
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(callback).toHaveBeenCalledWith(42);
  });

  it("does not call callback before delay expires", () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(callback, 100)
    );

    act(() => {
      result.current("test");
    });
    act(() => {
      vi.advanceTimersByTime(99);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("handles delay of 0 (fires immediately after tick)", () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(callback, 0)
    );

    act(() => {
      result.current("instant");
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
