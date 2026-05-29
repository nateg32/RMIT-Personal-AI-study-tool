"use client";

import { useMemo, useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type { CourseSummary, FileSummary, StudySidekickActions } from "../types";
import { fileSizeLabel, formatDateOnly } from "../lib/client-utils";

type FilesViewProps = {
  files: FileSummary[];
  courses: CourseSummary[];
  actions: StudySidekickActions;
};

function fileIcon(contentType?: string | null) {
  if (contentType?.includes("pdf")) return "picture_as_pdf";
  if (contentType?.includes("image")) return "image";
  if (contentType?.includes("spreadsheet") || contentType?.includes("excel")) return "table_chart";
  if (contentType?.includes("presentation")) return "slideshow";
  return "description";
}

function openCanvas(url?: string | null) {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export default function FilesView({ files, courses, actions }: FilesViewProps) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"recent" | "course">("recent");
  const visibleFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return files.filter((file) =>
      query ? `${file.name} ${file.courseName} ${file.contentType || ""}`.toLowerCase().includes(query) : true,
    );
  }, [files, search]);
  const grouped = useMemo(() => {
    const map = new Map<string, FileSummary[]>();
    for (const file of visibleFiles) {
      map.set(file.courseName, [...(map.get(file.courseName) || []), file]);
    }
    return Array.from(map.entries());
  }, [visibleFiles]);

  return (
    <div className="px-margin-desktop pb-lg min-h-screen w-full relative">
      <ViewHeader
        searchPlaceholder="Search your files..."
        searchValue={search}
        onSearchChange={setSearch}
        actions={actions}
      />

      <section className="mb-lg">
        <div className="flex flex-wrap gap-sm">
          <button
            type="button"
            className={`px-lg py-sm rounded-full font-label-md text-label-md bubbly-button shadow-sm ${
              mode === "recent" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
            }`}
            onClick={() => setMode("recent")}
          >
            Recent
          </button>
          <button
            type="button"
            className={`px-lg py-sm rounded-full font-label-md text-label-md bubbly-button ${
              mode === "course" ? "bg-tertiary-container text-on-tertiary-container" : "bg-surface-container text-on-surface-variant"
            }`}
            onClick={() => setMode("course")}
          >
            By Course
          </button>
          <button
            type="button"
            className="px-lg py-sm bg-secondary-container text-on-secondary-container rounded-full font-label-md text-label-md bubbly-button hover:bg-secondary-fixed transition-colors"
            onClick={() => actions.onOpenChat("Which recent Canvas files should I read first?")}
          >
            Ask AI
          </button>
          <button
            type="button"
            className="px-lg py-sm bg-surface-container text-on-surface-variant rounded-full font-label-md text-label-md bubbly-button border-2 border-outline-variant hover:border-primary transition-colors"
            onClick={actions.onSyncCanvas}
          >
            Refresh files
          </button>
        </div>
      </section>

      {mode === "course" ? (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter mb-xl relative z-10">
          {grouped.map(([courseName, items], index) => (
            <article
              key={courseName}
              className={`${index % 2 ? "bg-secondary-container/20 border-secondary-fixed-dim" : "bg-primary-container/30 border-primary-fixed-dim"} sticky-note border-2 p-md rounded-lg flex flex-col justify-between min-h-[220px]`}
            >
              <div>
                <span className="material-symbols-outlined text-primary text-[48px] mb-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  folder
                </span>
                <h3 className="font-headline-md text-headline-md text-on-primary-container">{courseName}</h3>
                <p className="font-label-md text-on-surface-variant">
                  {items.length} files, latest {formatDateOnly(items[0]?.updatedAtCanvas)}
                </p>
              </div>
              <div className="mt-lg flex -space-x-sm">
                {items.slice(0, 3).map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className="w-8 h-8 rounded-full bg-white border-2 border-primary-container flex items-center justify-center text-[12px] font-bold"
                    onClick={() => openCanvas(file.url)}
                    title={file.name}
                  >
                    {fileIcon(file.contentType).slice(0, 3).toUpperCase()}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-gutter mb-xl relative z-10">
          {visibleFiles.map((file, index) => (
            <button
              key={file.id}
              type="button"
              className={`sticky-note ${
                index % 3 === 0
                  ? "bg-surface-container-lowest border-secondary-container"
                  : index % 3 === 1
                    ? "bg-tertiary-container/40 border-tertiary-fixed-dim"
                    : "bg-primary-container/20 border-primary-fixed-dim"
              } border-2 p-md rounded-lg flex flex-col items-center text-center min-h-[190px]`}
              onClick={() => openCanvas(file.url)}
            >
              <div className="w-20 h-20 bg-white/70 rounded-lg flex items-center justify-center mb-md">
                <span className="material-symbols-outlined text-primary text-[40px]">{fileIcon(file.contentType)}</span>
              </div>
              <p className="font-label-md text-label-md font-bold mb-xs truncate w-full">{file.name}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant truncate w-full">{file.courseName}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">{fileSizeLabel(file.size)}</p>
            </button>
          ))}
        </section>
      )}

      {!visibleFiles.length ? (
        <section className="max-w-4xl mx-auto">
          <div className="drag-area p-xl rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary-container/20 transition-all">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md mb-md transform rotate-3">
              <span className="material-symbols-outlined text-primary text-[48px]">cloud_sync</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary mb-xs">No Canvas files loaded yet</h3>
            <p className="font-body-md text-on-surface-variant max-w-sm">
              Run a Canvas sync to pull recent files and module resources for your courses.
            </p>
            <button
              type="button"
              className="mt-lg bg-primary text-on-primary px-lg py-sm rounded-full font-label-md text-label-md bubbly-button"
              onClick={actions.onSyncCanvas}
            >
              Sync Canvas
            </button>
          </div>
        </section>
      ) : null}

      {courses.length && visibleFiles.length ? (
        <p className="font-label-sm text-label-sm text-outline text-center">
          Showing {visibleFiles.length} files across {courses.length} synced courses.
        </p>
      ) : null}
    </div>
  );
}
