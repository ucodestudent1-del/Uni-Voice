import { useCallback, useRef } from "react";

/**
 * Returns a debounced version of the callback that delays invoking `fn`
 * until `delay` ms have elapsed since the last time the debounced function
 * was invoked.
 *
 * The returned function is stable across renders (same identity) and the
 * latest closure values are always used, so it is safe to pass as an
 * effect dependency or event handler.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);

  // Always keep the latest callback in the ref so stale closures are avoided.
  fnRef.current = fn;

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        fnRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

export default useDebouncedCallback;