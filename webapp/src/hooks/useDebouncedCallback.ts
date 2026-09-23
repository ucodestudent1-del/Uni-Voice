import { useRef } from "react";

/**
 * Returns a debounced version of the callback that delays invoking `fn`
 * until `delay` ms have elapsed since the last time the debounced function
 * was invoked.
 */
export function useDebouncedCallback<T = string>(
  fn: (value: T) => void,
  delay: number
): (value: T) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return (value: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      fnRef.current(value);
    }, delay);
  };
}

export default useDebouncedCallback;