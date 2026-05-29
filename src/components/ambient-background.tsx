"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const LazyDottedSurface = dynamic(
  () => import("@/components/ui/dotted-surface").then((mod) => mod.DottedSurface),
  {
    ssr: false,
    loading: () => null,
  },
);

export function AmbientBackground({ className }: { className?: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    let idleId = 0;

    const showBackground = () => setReady(true);

    const scheduleIdle = window.requestIdleCallback;
    const cancelIdle = window.cancelIdleCallback;

    if (typeof scheduleIdle === "function") {
      idleId = scheduleIdle(showBackground, { timeout: 1_200 });
    } else {
      timeoutId = globalThis.setTimeout(showBackground, 500);
    }

    return () => {
      if (idleId && typeof cancelIdle === "function") cancelIdle(idleId);
      if (timeoutId) globalThis.clearTimeout(timeoutId);
    };
  }, []);

  if (!ready) return null;

  return <LazyDottedSurface className={className} />;
}
