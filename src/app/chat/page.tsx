import { AppShell } from "@/components/app-shell";
import { ChatClient } from "@/components/chat-client";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default function ChatPage() {
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
