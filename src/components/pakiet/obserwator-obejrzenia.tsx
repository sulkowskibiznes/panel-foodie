"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Materiał liczy się jako obejrzany po 2 sekundach w polu widzenia (SPEC rozdz. 6.2). Nie blokuje akceptacji. */
export function ObserwatorObejrzenia({ id, aktywny, onObejrzano, children }: { id: string; aktywny: boolean; onObejrzano: (id: string) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!aktywny || !el || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const obserwator = new IntersectionObserver(
      (wpisy) => {
        const w = wpisy[0];
        if (w?.isIntersecting && w.intersectionRatio >= 0.3) {
          if (timer === undefined) {
            timer = window.setTimeout(() => {
              onObejrzano(id);
              obserwator.disconnect();
            }, 2000);
          }
        } else if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: [0, 0.3] },
    );
    obserwator.observe(el);
    return () => {
      obserwator.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [id, aktywny, onObejrzano]);
  return <div ref={ref}>{children}</div>;
}
