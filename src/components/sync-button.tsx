"use client";

import { useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

export function SyncButton() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const needsConnection = message.toLowerCase().includes("canvas is not connected");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={pending}
        onClick={() => {
          setMessage("");
          startTransition(async () => {
            const prepareResponse = await fetch("/api/canvas/sync", { method: "POST" });
            const prepared = await prepareResponse.json();
            if (!prepareResponse.ok) {
              setMessage(prepared.error || "Sync failed");
              return;
            }

            let successfulCourses = 0;
            const warnings: string[] = [];
            for (const course of prepared.courses || []) {
              const response = await fetch("/api/canvas/sync/course", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ canvasCourseId: course.canvasCourseId, includeResources: false }),
              });
              const data = await response.json().catch(() => ({}));
              if (response.ok) {
                successfulCourses += 1;
                warnings.push(...(data.warnings || []));
              } else {
                warnings.push(`${course.name}: ${data.error || "course sync failed"}`);
              }
            }

            await fetch("/api/canvas/sync/finish", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                successfulCourses,
                totalCourses: prepared.courses?.length || 0,
                warnings: warnings.slice(0, 10),
                syncError:
                  prepared.courses?.length && successfulCourses === 0
                    ? warnings[0] || "No Canvas courses synced successfully"
                    : null,
              }),
            });

            const totalCourses = prepared.courses?.length || 0;
            setMessage(
              totalCourses > 0 && successfulCourses === 0
                ? `Sync could not finish any courses. ${warnings[0] || "Try again from the dashboard."}`
                : `Synced ${successfulCourses}/${totalCourses} courses`,
            );
          });
        }}
      >
        <RefreshCcw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        Sync now
      </Button>
      {message ? (
        <p className={needsConnection ? "text-sm text-warning" : "text-sm text-muted"}>
          {needsConnection ? "Canvas is not connected for this deployment yet." : message}
        </p>
      ) : null}
      {needsConnection ? (
        <ButtonLink href="/settings" variant="secondary">
          Connect Canvas
        </ButtonLink>
      ) : null}
    </div>
  );
}
