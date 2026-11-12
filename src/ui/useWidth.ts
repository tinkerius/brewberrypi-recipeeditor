/** The width of a box, for charts drawn to fit it (EDT-036, EDT-054); 640 until measured (and in tests). */

import { useEffect, useRef, useState } from "preact/hooks";

export function useWidth() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { box, width };
}
