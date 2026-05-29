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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadCourseId, setUploadCourseId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const visibleFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return files.filter((file) =>
      query
        ? `${file.name} ${file.courseName} ${file.assignmentName || ""} ${file.contentType || ""} ${file.excerpt || ""}`
            .toLowerCase()
            .includes(query)
        : true,
    );
  }, [files, search]);
  const grouped = useMemo(() => {
    const map = new Map<string, FileSummary[]>();
    for (const file of visibleFiles) {
      map.set(file.courseName, [...(map.get(file.courseName) || []), file]);
    }
    return Array.from(map.entries());
  }, [visibleFiles]);

  const uploadMaterial = async () => {
    if (!actions.onUploadMaterial || isUploading) return;
    setIsUploading(true);
    try {
      await actions.onUploadMaterial({
        file: uploadFile,
        title: uploadTitle,
        notes: uploadNotes,
        courseId: uploadCourseId || undefined,
      });
      setUploadFile(null);
      setUploadTitle("");
      setUploadNotes("");
      setUploadCourseId("");
    } finally {
      setIsUploading(false);
    }
  };

  const openFile = (file: FileSummary) => {
    if (file.url) {
      openCanvas(file.url);
      return;
    }
    actions.onOpenChat(`Use my uploaded material "${file.name}" to help me plan what to study.`);
  };

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

      <section className="mb-lg grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-gutter max-w-7xl mx-auto w-full">
        <div className="sticky-note bg-primary-container/25 border-2 border-primary-fixed-dim rounded-lg p-md">
          <div className="flex items-center gap-sm mb-sm">
            <span className="material-symbols-outlined text-primary">upload_file</span>
            <h2 className="font-headline-md text-headline-md text-primary">Upload study material</h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-md max-w-3xl">
            Add assignment briefs, lecture notes, rubric text, or slides when Canvas file syncing is slow. DOCX and text files are indexed automatically; for PDFs, slides, or images, paste the key brief/rubric notes so AI can use them.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
            <label className="bg-white border-2 border-surface-variant rounded-lg p-sm flex flex-col gap-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">File</span>
              <input
                type="file"
                className="font-label-md text-label-md min-w-0"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
            </label>
            <label className="bg-white border-2 border-surface-variant rounded-lg p-sm flex flex-col gap-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Course</span>
              <select
                value={uploadCourseId}
                onChange={(event) => setUploadCourseId(event.target.value)}
                className="bg-transparent font-body-md focus:outline-none"
              >
                <option value="">Manual library</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.courseCode || course.name}: {course.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr] gap-sm mt-sm">
            <input
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="Optional title if you are pasting notes only"
              className="bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary"
            />
            <textarea
              value={uploadNotes}
              onChange={(event) => setUploadNotes(event.target.value)}
              placeholder="Paste brief/rubric/lecture highlights for PDFs, slides, screenshots, or anything Canvas will not sync..."
              className="bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary min-h-24 resize-y"
            />
          </div>
          <button
            type="button"
            className="mt-md bg-primary text-on-primary px-lg py-sm rounded-full font-label-md text-label-md bubbly-button disabled:opacity-60"
            onClick={uploadMaterial}
            disabled={isUploading || !actions.onUploadMaterial || (!uploadFile && !uploadNotes.trim())}
          >
            {isUploading ? "Indexing..." : "Save to AI materials"}
          </button>
        </div>

        <div className="sticky-note bg-surface-container-lowest border-2 border-surface-variant rounded-lg p-md">
          <div className="flex items-center gap-sm mb-sm">
            <span className="material-symbols-outlined text-secondary">tips_and_updates</span>
            <h2 className="font-headline-sm text-headline-sm">Cheapest path</h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Manual notes are cheaper than forcing Canvas to fetch every file because we only store searchable text snippets. Full binary storage and deep PDF parsing can come later with Supabase Storage if you need downloads.
          </p>
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
                    onClick={() => openFile(file)}
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
              onClick={() => openFile(file)}
            >
              <div className="w-20 h-20 bg-white/70 rounded-lg flex items-center justify-center mb-md">
                <span className="material-symbols-outlined text-primary text-[40px]">{fileIcon(file.contentType)}</span>
              </div>
              <span className="mb-xs px-sm py-1 rounded-full bg-white/70 border border-surface-variant font-label-sm text-label-sm text-on-surface-variant">
                {file.source === "manual_upload" ? "Manual" : "Canvas"}
              </span>
              <p className="font-label-md text-label-md font-bold mb-xs truncate w-full">{file.name}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant truncate w-full">{file.courseName}</p>
              {file.assignmentName ? (
                <p className="font-label-sm text-label-sm text-secondary truncate w-full">{file.assignmentName}</p>
              ) : null}
              <p className="font-label-sm text-label-sm text-on-surface-variant">{fileSizeLabel(file.size)}</p>
            </button>
          ))}
        </section>
      )}

      {!visibleFiles.length ? (
        <section className="max-w-4xl mx-auto w-full">
          <div className="drag-area p-xl rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary-container/20 transition-all w-full">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md mb-md transform rotate-3">
              <span className="material-symbols-outlined text-primary text-[48px]">cloud_sync</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary mb-xs w-full">No study materials loaded yet</h3>
            <p className="font-body-md text-on-surface-variant max-w-2xl w-full whitespace-normal">
              Upload a brief or paste rubric notes above, or run a Canvas sync to pull recent files and module resources for your courses.
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
