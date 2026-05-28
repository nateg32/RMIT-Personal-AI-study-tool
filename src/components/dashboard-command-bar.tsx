"use client";

import { useRouter } from "next/navigation";
import { ActionSearchBar, type Action } from "@/components/ui/action-search-bar";

export function DashboardCommandBar() {
  const router = useRouter();

  function handleAction(action: Action) {
    if (action.href) {
      router.push(action.href);
      return;
    }

    if (action.id === "brief") {
      const button = document.querySelector<HTMLButtonElement>("[data-daily-brief-button]");
      button?.click();
    }
  }

  return <ActionSearchBar onAction={handleAction} />;
}
