import { CanvasConnectForm } from "@/components/canvas-connect-form";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Private setup" title="Settings" description="Connect Canvas and manage server-side secrets." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Canvas connection</CardTitle>
            <p className="text-sm text-muted">
              The token is encrypted before storage and never returned to the browser.
            </p>
          </CardHeader>
          <CardContent>
            <CanvasConnectForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Security checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>Regenerate any Canvas token pasted into chat or screenshots.</li>
              <li>Set `ALLOWED_EMAILS` before deploying to Vercel.</li>
              <li>Use a 32-byte `ENCRYPTION_KEY` and rotate it carefully.</li>
              <li>Keep Canvas read-only until OAuth/developer-key access is approved.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
