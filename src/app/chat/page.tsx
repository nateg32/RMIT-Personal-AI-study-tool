import { AppShell } from "@/components/app-shell";
import { ChatClient } from "@/components/chat-client";
import { PageHeader } from "@/components/page-header";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await requirePageUser();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Grounded AI"
        title="Canvas-aware chat"
        description="Answers are generated from synced dashboard facts and include stale-data awareness."
      />
      <ChatClient />
    </AppShell>
  );
}
