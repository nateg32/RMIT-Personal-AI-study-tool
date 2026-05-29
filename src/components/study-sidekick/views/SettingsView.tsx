"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type { DashboardSummary, StudySidekickActions } from "../types";

type SettingsViewProps = {
  dashboard: DashboardSummary;
  actions: StudySidekickActions;
  onConnectCanvas: (canvasBaseUrl: string, accessToken: string) => Promise<void>;
  onLogout: () => void;
};

export default function SettingsView({ dashboard, actions, onConnectCanvas, onLogout }: SettingsViewProps) {
  const [search, setSearch] = useState("");
  const [canvasBaseUrl, setCanvasBaseUrl] = useState("https://rmit.instructure.com");
  const [accessToken, setAccessToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage("Connecting Canvas...");
    try {
      await onConnectCanvas(canvasBaseUrl, accessToken);
      setAccessToken("");
      setMessage("Canvas connected. Use Sync now to import your Canvas data.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect Canvas.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="px-margin-desktop pb-xl min-h-screen">
      <ViewHeader
        searchPlaceholder="Search settings..."
        searchValue={search}
        onSearchChange={setSearch}
        actions={actions}
      />

      <div className="max-w-5xl mx-auto w-full">
        <div className="mb-lg">
          <h1 className="font-display-lg text-display-lg text-primary">Settings</h1>
          <p className="font-body-lg text-on-surface-variant mt-sm">
            Connect Canvas securely. Tokens stay on the server and are encrypted before storage.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <section className="lg:col-span-7 sticky-note bg-surface-container-lowest border-2 border-primary-fixed-dim rounded-lg p-lg">
            <div className="flex items-center gap-sm mb-md">
              <span className="material-symbols-outlined text-primary">vpn_key</span>
              <h2 className="font-headline-md text-headline-md text-primary">Canvas connection</h2>
            </div>
            <form className="space-y-md" onSubmit={submit}>
              <label className="block">
                <span className="font-label-md text-label-md text-on-surface-variant">Canvas base URL</span>
                <input
                  className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                  value={canvasBaseUrl}
                  onChange={(event) => setCanvasBaseUrl(event.target.value)}
                  placeholder="https://rmit.instructure.com"
                  type="url"
                  required
                />
              </label>
              <label className="block">
                <span className="font-label-md text-label-md text-on-surface-variant">Canvas access token</span>
                <input
                  className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                  placeholder="Paste the token here. It will not be shown again."
                  type="password"
                  autoComplete="off"
                  required
                />
              </label>
              <div className="bg-primary-container/50 border-2 border-primary-fixed-dim rounded-lg p-md">
                <p className="font-body-md text-on-primary-container">
                  For v1, Canvas stays read-only. The app syncs courses, assignments, submissions, announcements,
                  files, modules, and rubrics when available.
                </p>
                <p className="font-label-md text-label-md text-on-primary-container mt-sm">
                  Connect validates and saves your token. Run Sync now separately so longer Canvas imports can report
                  clear progress and errors.
                </p>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-on-primary rounded-full py-sm font-bold bubbly-button disabled:opacity-60 flex items-center justify-center gap-sm"
                disabled={isSaving}
              >
                <span className="material-symbols-outlined">{isSaving ? "sync" : "lock"}</span>
                {isSaving ? "Connecting..." : "Connect Canvas"}
              </button>
              {message ? <p className="font-label-md text-label-md text-on-surface-variant">{message}</p> : null}
            </form>
          </section>

          <aside className="lg:col-span-5 space-y-gutter">
            <div className="bg-primary-container/30 border-2 border-primary-fixed-dim rounded-lg p-md bubbly-shadow">
              <div className="flex items-center gap-sm mb-sm">
                <span className="material-symbols-outlined text-primary">cloud_done</span>
                <h3 className="font-headline-md text-headline-md text-primary">Sync status</h3>
              </div>
              <div className="space-y-sm font-body-md text-on-surface-variant">
                <p>
                  <strong className="text-on-surface">Canvas:</strong>{" "}
                  {dashboard.canvasConfigured ? "Connected or configured" : "Not connected"}
                </p>
                <p>
                  <strong className="text-on-surface">Last sync:</strong>{" "}
                  {dashboard.lastSyncAt ? new Date(dashboard.lastSyncAt).toLocaleString("en-AU") : "Never"}
                </p>
                <p>
                  <strong className="text-on-surface">Data freshness:</strong>{" "}
                  {dashboard.stale ? "Needs refresh" : "Fresh"}
                </p>
              </div>
              <button
                type="button"
                className="mt-md w-full bg-white/80 border-2 border-primary-fixed-dim rounded-full py-sm font-label-md text-label-md bubbly-button"
                onClick={actions.onSyncCanvas}
              >
                Sync now
              </button>
            </div>

            <div className="bg-tertiary-container border-2 border-tertiary-fixed rounded-lg p-md rotate-1">
              <div className="flex items-center gap-sm text-on-tertiary-container font-bold mb-sm">
                <span className="material-symbols-outlined">security</span>
                <span className="font-label-md text-label-md uppercase tracking-wider">Security defaults</span>
              </div>
              <ul className="space-y-xs font-body-md text-on-tertiary-fixed-variant">
                <li>Canvas token is never stored in browser storage.</li>
                <li>AI receives assignment context, never your token.</li>
                <li>Canvas content is treated as untrusted data.</li>
                <li>All API calls are scoped to your signed-in user.</li>
              </ul>
            </div>

            <button
              type="button"
              className="w-full bg-error-container text-error rounded-full py-sm font-bold bubbly-button flex items-center justify-center gap-sm"
              onClick={onLogout}
            >
              <span className="material-symbols-outlined">logout</span>
              Log out
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
