"use client";

import { useMemo, useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type { CourseSummary, FileSummary, StudySidekickActions } from "../types";
import { fileSizeLabel, formatDateOnly } from "../lib/client-utils";
import { openExternalUrl } from "../lib/safe-url";

type FilesViewProps = {
  files: FileSummary[];
  courses: CourseSummary[];
  actions: StudySidekickActions;
};

const MAX_FILES = 2;
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const NOTE_WORD_LIMIT = 500;

function fileIcon(contentType?: string | null) {
  if (contentType?.includes("pdf")) return "picture_as_pdf";
  if (contentType?.includes("image")) return "image";
  if (contentType?.includes("spreadsheet") || contentType?.includes("excel")) return "table_chart";
  if (contentType?.includes("presentation")) return "slideshow";
  return "description";
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function limitWords(value: string, limit: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return value;
  return words.slice(0, limit).join(" ");
}

export default function FilesView({ files, courses, actions }: FilesViewProps) {
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadCourseId, setUploadCourseId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const actionsDisabled = Boolean(actions.isBusy);
  const selectedCourse = courses.find((course) => course.id === uploadCourseId);
  const noteWords = wordCount(uploadNotes);
  const oversizedFiles = uploadFiles.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
  const hasMaterial = uploadFiles.length > 0 || Boolean(uploadNotes.trim());
  const canUpload =
    Boolean(uploadCourseId) &&
    hasMaterial &&
    !oversizedFiles.length &&
    !isUploading &&
    !actionsDisabled &&
    Boolean(actions.onUploadMaterial);

  const recentMaterials = useMemo(
    () =>
      [...files]
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt || left.updatedAtCanvas || 0).getTime();
          const rightTime = new Date(right.createdAt || right.updatedAtCanvas || 0).getTime();
          return rightTime - leftTime;
        })
        .slice(0, 8),
    [files],
  );

  const materialCountByCourse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      counts.set(file.courseName, (counts.get(file.courseName) || 0) + 1);
    }
    return counts;
  }, [files]);

  const selectFiles = (fileList: FileList | null) => {
    const nextFiles = Array.from(fileList || []).slice(0, MAX_FILES);
    setUploadFiles(nextFiles);
    setLocalMessage(fileList && fileList.length > MAX_FILES ? "Only the first two files were selected." : null);
  };

  const removeSelectedFile = (name: string) => {
    setUploadFiles((current) => current.filter((file) => file.name !== name));
    setFileInputKey((current) => current + 1);
  };

  const updateNotes = (value: string) => {
    const limited = limitWords(value, NOTE_WORD_LIMIT);
    setUploadNotes(limited);
    setLocalMessage(wordCount(value) > NOTE_WORD_LIMIT ? `Notes are limited to ${NOTE_WORD_LIMIT} words.` : null);
  };

  const uploadMaterial = async () => {
    if (!actions.onUploadMaterial || isUploading || !canUpload) return;
    setIsUploading(true);
    setLocalMessage(null);
    try {
      const notes = uploadNotes.trim();
      const title = uploadTitle.trim();

      if (uploadFiles.length) {
        for (let index = 0; index < uploadFiles.length; index += 1) {
          await actions.onUploadMaterial({
            file: uploadFiles[index],
            title: index === 0 ? title : undefined,
            notes: index === 0 ? notes : undefined,
            courseId: uploadCourseId,
          });
        }
      } else {
        await actions.onUploadMaterial({
          title: title || `${selectedCourse?.name || "Course"} notes`,
          notes,
          courseId: uploadCourseId,
        });
      }

      setUploadFiles([]);
      setUploadTitle("");
      setUploadNotes("");
      setFileInputKey((current) => current + 1);
      setLocalMessage(`Saved to ${selectedCourse?.name || "this course"}. Sidekick can now use it in chat and study sessions.`);
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : "Upload failed. Try a smaller file or paste notes instead.");
    } finally {
      setIsUploading(false);
    }
  };

  const openFile = (file: FileSummary) => {
    if (file.url) {
      openExternalUrl(file.url);
      return;
    }
    actions.onOpenChat(`Use my uploaded material "${file.name}" to help me plan what to study.`);
  };

  return (
    <div className="px-margin-desktop pb-lg min-h-screen w-full relative">
      <ViewHeader actions={actions} />

      <section className="max-w-7xl mx-auto mb-lg">
        <p className="font-label-md text-label-md uppercase tracking-wide text-primary mb-xs">Course material</p>
        <h1 className="font-display-md text-display-md text-primary mb-sm">Add context for Sidekick</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl">
          Choose one course, add up to two files, or paste a short brief. Sidekick uses this material only to explain
          requirements, suggest where to start, and build better study sessions for that course.
        </p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,760px)_minmax(320px,420px)] gap-gutter max-w-7xl mx-auto w-full mb-xl">
        <form
          className="bg-surface-container-lowest border-2 border-primary-fixed-dim rounded-lg p-md shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void uploadMaterial();
          }}
        >
          <div className="flex items-center gap-sm mb-md">
            <span className="material-symbols-outlined text-primary">upload_file</span>
            <h2 className="font-headline-md text-headline-md text-primary">Upload study material</h2>
          </div>

          <div className="space-y-md">
            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase">Course</span>
              <select
                value={uploadCourseId}
                onChange={(event) => setUploadCourseId(event.target.value)}
                className="mt-xs w-full bg-white border-2 border-surface-variant rounded-full px-md py-sm font-body-md focus:outline-none focus:border-primary"
                required
              >
                <option value="">Choose the course this material belongs to</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.courseCode || "Course"} - {course.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-lg border-2 border-dashed border-primary-fixed-dim bg-primary-container/20 p-md">
              <label className="flex cursor-pointer flex-col gap-xs">
                <span className="font-label-md text-label-md text-on-surface-variant uppercase">Files</span>
                <span className="font-body-md text-body-md text-on-surface-variant">
                  Add up to {MAX_FILES} files. Keep each file under 4 MB so Vercel does not reject the upload.
                </span>
                <input
                  key={fileInputKey}
                  type="file"
                  multiple
                  className="mt-sm font-label-md text-label-md min-w-0"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.ppt,.pptx,.doc,.docx,.txt,.md,.markdown,.html,.htm,.csv,.json,.xml,text/*,image/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => selectFiles(event.target.files)}
                />
              </label>

              {uploadFiles.length ? (
                <div className="mt-sm space-y-xs">
                  {uploadFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex items-center justify-between gap-sm rounded-full border border-surface-variant bg-white px-sm py-xs"
                    >
                      <span className="min-w-0 truncate font-label-md text-label-md">
                        {file.name} <span className="text-on-surface-variant">({fileSizeLabel(file.size)})</span>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded-full px-xs py-1 text-primary hover:bg-primary-container active:scale-95"
                        onClick={() => removeSelectedFile(file.name)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {oversizedFiles.length ? (
                <p className="mt-sm font-label-md text-label-md text-error">
                  {oversizedFiles[0].name} is too large. Use a smaller file or paste the key notes below.
                </p>
              ) : null}
            </div>

            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase">Material title</span>
              <input
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value.slice(0, 180))}
                placeholder="Optional, for example Assignment 2 rubric notes"
                className="mt-xs w-full bg-white border-2 border-surface-variant rounded-full px-md py-sm font-body-md focus:outline-none focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase">Extra notes</span>
              <textarea
                value={uploadNotes}
                onChange={(event) => updateNotes(event.target.value)}
                placeholder="Paste only the useful instructions, rubric points, or lecture hints. Do not paste a full assignment answer."
                className="mt-xs w-full bg-white border-2 border-surface-variant rounded-lg p-sm font-body-md focus:outline-none focus:border-primary min-h-32 resize-y"
              />
              <span className="mt-xs block text-right font-label-sm text-label-sm text-on-surface-variant">
                {noteWords}/{NOTE_WORD_LIMIT} words
              </span>
            </label>
          </div>

          {localMessage ? (
            <p className="mt-md rounded-full border border-primary-fixed-dim bg-primary-container/35 px-sm py-xs font-label-md text-label-md text-primary">
              {localMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-md w-full bg-primary text-on-primary px-lg py-sm rounded-full font-label-md text-label-md bubbly-button disabled:opacity-60"
            disabled={!canUpload}
            title={actions.disabledReason || undefined}
          >
            {isUploading ? "Saving material..." : "Save to Sidekick"}
          </button>
        </form>

        <aside className="bg-surface-container-lowest border-2 border-surface-variant rounded-lg p-md shadow-sm h-fit">
          <div className="flex items-center gap-sm mb-sm">
            <span className="material-symbols-outlined text-primary">verified_user</span>
            <h2 className="font-headline-sm text-headline-sm text-primary">Study guidance only</h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-md">
            The purpose of this is for AI to understand your assignment, rubric, and course context so it can give you
            directions on how to start or attempt the task.
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant mb-md">
            It is not for final answers, copy-paste submissions, or replacing your own work. Keep uploads focused on the
            brief, marking criteria, lecture notes, and anything that helps you plan honestly.
          </p>
          <div className="rounded-lg bg-primary-container/25 border border-primary-fixed-dim p-sm">
            <p className="font-label-md text-label-md text-primary">Current limits</p>
            <ul className="mt-xs space-y-xs font-body-sm text-body-sm text-on-surface-variant">
              <li>Course must be selected.</li>
              <li>Maximum {MAX_FILES} files per upload.</li>
              <li>Maximum {NOTE_WORD_LIMIT} words of notes.</li>
              <li>Each file should stay under 4 MB.</li>
            </ul>
          </div>
        </aside>
      </section>

      <section className="max-w-7xl mx-auto w-full">
        <div className="mb-md flex flex-col gap-xs sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-label-md text-label-md uppercase tracking-wide text-primary">Saved material</p>
            <h2 className="font-headline-md text-headline-md text-primary">Recent course context</h2>
          </div>
          {files.length ? (
            <p className="font-label-md text-label-md text-on-surface-variant">
              {files.length} item{files.length === 1 ? "" : "s"} across {materialCountByCourse.size} course
              {materialCountByCourse.size === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        {recentMaterials.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter">
            {recentMaterials.map((file) => (
              <button
                key={file.id}
                type="button"
                className="bg-surface-container-lowest border-2 border-surface-variant rounded-lg p-md text-left transition-all hover:border-primary hover:-translate-y-0.5 active:scale-[0.99]"
                onClick={() => openFile(file)}
              >
                <div className="flex items-start justify-between gap-sm">
                  <span className="material-symbols-outlined text-primary text-[36px]">{fileIcon(file.contentType)}</span>
                  <span className="rounded-full bg-primary-container/60 px-sm py-1 font-label-sm text-label-sm text-primary">
                    {file.source === "manual_upload" ? "Manual" : "Canvas"}
                  </span>
                </div>
                <p className="mt-md font-label-lg text-label-lg font-bold line-clamp-2">{file.name}</p>
                <p className="mt-xs font-label-md text-label-md text-on-surface-variant line-clamp-1">{file.courseName}</p>
                {file.assignmentName ? (
                  <p className="mt-xs font-label-sm text-label-sm text-secondary line-clamp-1">{file.assignmentName}</p>
                ) : null}
                <p className="mt-sm font-label-sm text-label-sm text-on-surface-variant">
                  {fileSizeLabel(file.size)} - {formatDateOnly(file.createdAt || file.updatedAtCanvas)}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-lg text-center">
            <span className="material-symbols-outlined text-primary text-[48px]">folder_open</span>
            <h3 className="mt-sm font-headline-sm text-headline-sm text-primary">No material saved yet</h3>
            <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
              Choose a course above, then upload a brief or paste notes so Sidekick can understand what you are working on.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
