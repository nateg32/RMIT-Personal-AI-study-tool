"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type { DashboardScopeSummary, DashboardSummary, StudySidekickActions } from "../types";

type SettingsViewProps = {
  dashboard: DashboardSummary;
  scope: DashboardScopeSummary;
  actions: StudySidekickActions;
  onConnectCanvas: (canvasBaseUrl: string, accessToken: string) => Promise<void>;
  onResetCanvasConnection: () => Promise<void>;
  onUpdateProfileName: (name: string) => Promise<void>;
  onResetDashboardScope: () => Promise<void>;
  onLogout: () => void;
};

const emptySyncSummary = {
  visibleCourses: 0,
  hiddenCourses: 0,
  assignments: 0,
  unsubmittedAssignments: 0,
  announcements: 0,
  files: 0,
  resources: 0,
  manualMaterials: 0,
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("en-AU") : "Never";
}

function connectionLabel(dashboard: DashboardSummary) {
  if (dashboard.canvasConnectionMode === "saved_token") return "Saved Canvas token";
  if (dashboard.canvasConnectionMode === "environment") return "Deployment env token";
  return dashboard.canvasConfigured ? "Configured" : "Not connected";
}

function syncStatusLabel(dashboard: DashboardSummary, isSyncing?: boolean) {
  if (isSyncing) return "Syncing now";
  if (dashboard.syncStatus === "success") return "Last sync succeeded";
  if (dashboard.syncStatus === "error") return "Last sync failed";
  if (dashboard.syncStatus === "syncing") return "Syncing now";
  if (dashboard.syncStatus === "never_synced") return "Connected, never synced";
  return dashboard.canvasConfigured ? "Ready to sync" : "No Canvas connection";
}

function freshnessLabel(dashboard: DashboardSummary, isSyncing?: boolean) {
  if (isSyncing) return "Refreshing";
  if (!dashboard.canvasConfigured) return "No Canvas connection";
  if (dashboard.syncStatus === "error") return "Blocked by last sync error";
  if (!dashboard.lastSuccessfulSyncAt && !dashboard.lastSyncAt) return "No successful sync yet";
  return dashboard.stale ? "Stale, refresh recommended" : "Fresh";
}

export default function SettingsView({
  dashboard,
  scope,
  actions,
  onConnectCanvas,
  onResetCanvasConnection,
  onUpdateProfileName,
  onResetDashboardScope,
  onLogout,
}: SettingsViewProps) {
  const [search, setSearch] = useState("");
  const [displayName, setDisplayName] = useState(dashboard.userName === "there" ? "" : dashboard.userName);
  const [canvasBaseUrl, setCanvasBaseUrl] = useState("https://rmit.instructure.com");
  const [accessToken, setAccessToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isResettingCanvas, setIsResettingCanvas] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const syncSummary = dashboard.syncSummary || emptySyncSummary;

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setMessage("Saving display name...");
    try {
      await onUpdateProfileName(displayName);
      setMessage("Display name saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save display name.");
    } finally {
      setIsSavingProfile(false);
    }
  };

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

  const resetCanvas = async () => {
    const confirmed = window.confirm(
      "Restart Canvas connection? This clears the saved Canvas token and synced Canvas courses, assignments, files, modules, and announcements. Manual uploads and study sessions stay in the app.",
    );
    if (!confirmed) return;
    setIsResettingCanvas(true);
    setMessage("Restarting Canvas connection...");
    try {
      await onResetCanvasConnection();
      setAccessToken("");
      setMessage("Canvas connection reset. Paste a fresh token, connect, then run Sync now.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reset Canvas connection.");
    } finally {
      setIsResettingCanvas(false);
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
          <div className="lg:col-span-7 space-y-gutter">
            <section className="sticky-note bg-surface-container-lowest border-2 border-primary-fixed-dim rounded-lg p-lg">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">badge</span>
                <h2 className="font-headline-md text-headline-md text-primary">Profile</h2>
              </div>
              <form className="space-y-md" onSubmit={saveProfile}>
                <label className="block">
                  <span className="font-label-md text-label-md text-on-surface-variant">Display name</span>
                  <input
                    className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Nathaniel"
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="w-full bg-white/80 border-2 border-primary-fixed-dim rounded-full py-sm font-label-md text-label-md bubbly-button disabled:opacity-60"
                  disabled={isSavingProfile || !displayName.trim()}
                >
                  {isSavingProfile ? "Saving..." : "Save display name"}
                </button>
              </form>
            </section>

            <section className="sticky-note bg-surface-container-lowest border-2 border-primary-fixed-dim rounded-lg p-lg">
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
          </div>

          <aside className="lg:col-span-5 space-y-gutter">
            <div className="bg-primary-container/30 border-2 border-primary-fixed-dim rounded-lg p-md bubbly-shadow">
              <div className="flex items-start justify-between gap-sm mb-sm">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">cloud_done</span>
                  <h3 className="font-headline-md text-headline-md text-primary">Sync status</h3>
                </div>
                <span className="rounded-full border-2 border-primary-fixed-dim bg-white/80 px-sm py-xxs font-label-sm text-label-sm text-primary">
                  {syncStatusLabel(dashboard, actions.isSyncing)}
                </span>
              </div>
              <div className="space-y-sm font-body-md text-on-surface-variant">
                <p>
                  <strong className="text-on-surface">Connection:</strong> {connectionLabel(dashboard)}
                </p>
                <p>
                  <strong className="text-on-surface">Last successful sync:</strong>{" "}
                  {formatDate(dashboard.lastSuccessfulSyncAt || dashboard.lastSyncAt)}
                </p>
                <p>
                  <strong className="text-on-surface">Last attempt:</strong> {formatDate(dashboard.lastSyncAttemptAt)}
                </p>
                <p>
                  <strong className="text-on-surface">Data freshness:</strong> {freshnessLabel(dashboard, actions.isSyncing)}
                </p>
              </div>
              {dashboard.syncError ? (
                <div className="mt-sm rounded-lg border-2 border-error/30 bg-error-container/50 p-sm">
                  <p className="font-label-md text-label-md text-error">Last error</p>
                  <p className="font-body-sm text-on-error-container break-words">{dashboard.syncError}</p>
                </div>
              ) : null}
              <div className="mt-md grid grid-cols-2 gap-sm">
                {[
                  ["Courses shown", syncSummary.visibleCourses],
                  ["Courses hidden", syncSummary.hiddenCourses],
                  ["Assignments", syncSummary.assignments],
                  ["Unsubmitted", syncSummary.unsubmittedAssignments],
                  ["Announcements", syncSummary.announcements],
                  ["Canvas files", syncSummary.files],
                  ["Module items", syncSummary.resources],
                  ["Uploads", syncSummary.manualMaterials],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white/80 border-2 border-primary-fixed-dim rounded-lg p-sm">
                    <p className="font-display-sm text-display-sm text-primary">{value}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-md w-full bg-white/80 border-2 border-primary-fixed-dim rounded-full py-sm font-label-md text-label-md bubbly-button disabled:opacity-60"
                onClick={actions.onSyncCanvas}
                disabled={actions.isSyncing}
              >
                {actions.isSyncing ? "Syncing..." : "Sync now"}
              </button>
              <button
                type="button"
                className="mt-sm w-full bg-error-container/70 border-2 border-error/30 text-error rounded-full py-sm font-label-md text-label-md bubbly-button disabled:opacity-60"
                onClick={resetCanvas}
                disabled={isResettingCanvas || actions.isSyncing}
              >
                {isResettingCanvas ? "Restarting..." : "Restart Canvas connection"}
              </button>
              {dashboard.canvasConnectionMode === "environment" ? (
                <p className="mt-sm font-label-sm text-label-sm text-on-surface-variant">
                  A Vercel Canvas token is still configured. Restart clears synced data, but that deployment token can
                  still sync until it is removed or replaced in Vercel.
                </p>
              ) : null}
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

            <div className="straight-panel bg-surface-container-lowest border-2 border-surface-variant rounded-lg p-md">
              <div className="flex items-center gap-sm mb-sm">
                <span className="material-symbols-outlined text-primary">tune</span>
                <h3 className="font-headline-md text-headline-md text-primary">Dashboard scope</h3>
              </div>
              <p className="font-body-md text-on-surface-variant">
                Hidden items are removed from dashboard views and skipped by future Canvas syncs.
              </p>
              <div className="grid grid-cols-2 gap-sm my-md">
                <div className="bg-white border-2 border-surface-variant rounded-lg p-sm text-center">
                  <p className="font-display-sm text-display-sm text-primary">{scope.hiddenCourses.length}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Courses hidden</p>
                </div>
                <div className="bg-white border-2 border-surface-variant rounded-lg p-sm text-center">
                  <p className="font-display-sm text-display-sm text-primary">{scope.hiddenAssignments.length}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Tasks hidden</p>
                </div>
              </div>
              {scope.hiddenCourses.length || scope.hiddenAssignments.length ? (
                <div className="max-h-36 overflow-auto space-y-xs mb-md pr-xs">
                  {scope.hiddenCourses.slice(0, 4).map((course) => (
                    <p key={course.id} className="font-label-sm text-label-sm text-on-surface-variant line-clamp-1">
                      Course: {course.courseCode ? `${course.courseCode} - ` : ""}
                      {course.name}
                    </p>
                  ))}
                  {scope.hiddenAssignments.slice(0, 4).map((assignment) => (
                    <p key={assignment.id} className="font-label-sm text-label-sm text-on-surface-variant line-clamp-1">
                      Task: {assignment.courseCode || assignment.courseName} - {assignment.name}
                    </p>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                className="w-full bg-white/80 border-2 border-primary-fixed-dim rounded-full py-sm font-label-md text-label-md bubbly-button disabled:opacity-60"
                onClick={onResetDashboardScope}
                disabled={!scope.hiddenCourses.length && !scope.hiddenAssignments.length}
              >
                Show everything again
              </button>
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
