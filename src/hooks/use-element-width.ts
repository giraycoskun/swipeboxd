"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** React warns about `useLayoutEffect` during SSR; the browser is the only place it can run. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The measured content width of an element, in px.
 *
 * `null` until the first measurement, which callers read as "no constraint" — a
 * server-rendered row must not pretend the strip is zero pixels wide and flash a
 * lone "+N" before the logos appear.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => setWidth(element.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
