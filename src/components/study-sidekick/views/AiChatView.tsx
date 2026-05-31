"use client";

import { useRef, useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type { CourseSummary, StudyAgentConfirmation, StudySidekickActions } from "../types";
import { fileSizeLabel } from "../lib/client-utils";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  provider?: "gemini" | "fallback" | "agent";
  model?: string | null;
  confirmation?: StudyAgentConfirmation;
  confirmationStatus?: "pending" | "confirmed" | "cancelled";
};

type AiChatViewProps = {
  messages: ChatMessage[];
  courses: CourseSummary[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onConfirmAction: (messageId: string, token: string) => void;
  onCancelAction: (messageId: string) => void;
  actions: StudySidekickActions;
  isSending?: boolean;
  chatProviderStatus?: string | null;
};

const suggestions = [
  {
    tag: "QUICK START",
    prompt: "What should I focus on today?",
    className: "bg-[#FFF9E6] border-[#FFE8A3] text-[#5d4129] rotate-[-1deg]",
    icon: "auto_fix_high",
  },
  {
    tag: "DEADLINES",
    prompt: "What is due this week?",
    className: "bg-[#EBE7FF] border-[#D1C4FF] text-[#352D53] rotate-[1deg]",
    icon: "event",
  },
  {
    tag: "PLANNING",
    prompt: "Create a 1-hour study session for my most urgent assignment.",
    className: "bg-[#FFEBE6] border-[#FFC7B8] text-[#532D23] rotate-[-0.5deg]",
    icon: "schedule",
  },
  {
    tag: "AGENT",
    prompt: "What tools can you use for studying?",
    className: "bg-primary-container border-primary-fixed-dim text-primary",
    icon: "construction",
  },
];

export default function AiChatView({
  messages,
  courses,
  draft,
  onDraftChange,
  onSend,
  onConfirmAction,
  onCancelAction,
  actions,
  isSending = false,
  chatProviderStatus,
}: AiChatViewProps) {
  const [search, setSearch] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadCourseId, setUploadCourseId] = useState("");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedUploadCourse = courses.find((course) => course.id === uploadCourseId);

  const submit = async () => {
    if (isSending) return;
    const trimmed = draft.trim();
    if (!trimmed && !attachedFile) return;
    if (attachedFile) {
      if (!actions.onUploadMaterial) {
        setUploadMessage("File uploads are not available in this environment.");
        return;
      }
      if (!uploadCourseId) {
        setUploadMessage("Choose the course this file belongs to first.");
        return;
      }
      setIsUploading(true);
      setUploadMessage(null);
      try {
        await actions.onUploadMaterial({
          file: attachedFile,
          title: attachedFile.name,
          courseId: uploadCourseId,
        });
        const courseName = selectedUploadCourse?.name || "the selected course";
        setAttachedFile(null);
        setUploadCourseId("");
        setUploadMessage(`Saved ${attachedFile.name} to ${courseName}.`);
        onSend(
          `${trimmed || "Use the file I just uploaded to help me understand this assignment."}\n\nUploaded material: ${attachedFile.name} (${courseName}).`,
        );
      } catch (error) {
        setUploadMessage(error instanceof Error ? error.message : "Upload failed. Try a smaller file or paste notes instead.");
      } finally {
        setIsUploading(false);
      }
      return;
    }
    onSend(trimmed);
  };

  return (
    <div className="flex flex-col flex-grow overflow-hidden h-full">
      <div className="px-margin-desktop">
        <ViewHeader
          searchPlaceholder="Search insights..."
          searchValue={search}
          onSearchChange={setSearch}
          actions={actions}
        />
      </div>

      <div className="flex flex-grow overflow-hidden px-margin-desktop pb-lg gap-md max-w-7xl w-full mx-auto">
        <section className="hidden lg:flex flex-col w-80 flex-shrink-0 gap-md">
          <div className="flex flex-col gap-sm">
            <h3 className="font-label-md text-label-md text-on-surface-variant px-sm">SUGGESTED FOR YOU</h3>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.prompt}
                type="button"
                className={`text-left border-2 p-md rounded-lg bubbly-shadow bubbly-button transition-all hover-squish disabled:opacity-60 ${suggestion.className}`}
                onClick={() => onSend(suggestion.prompt)}
                disabled={isSending}
              >
                <span className="font-label-sm text-label-sm mb-xs block opacity-80">{suggestion.tag}</span>
                <p className="font-body-md text-body-md font-bold">{suggestion.prompt}</p>
                <div className="flex justify-end mt-sm">
                  <span className="material-symbols-outlined text-sm">{suggestion.icon}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-col flex-grow bg-surface-container-low rounded-lg p-md border-2 border-surface-variant overflow-hidden">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-md">CANVAS TOOLS</h3>
            <div className="flex flex-col gap-xs overflow-y-auto custom-scrollbar">
              {[
                ["Due this week", "event"],
                ["Unsubmitted work", "pending_actions"],
                ["Recent announcements", "campaign"],
                ["Create top session", "psychology"],
                ["Agent tools", "construction"],
              ].map(([label, icon]) => (
                <button
                  key={label}
                  type="button"
                  className="p-sm rounded-lg hover:bg-primary-container/30 cursor-pointer transition-colors border border-transparent text-left flex items-center gap-sm"
                  onClick={() =>
                    onSend(
                      label === "Create top session"
                        ? "Create a 50-minute study session for my most urgent assignment."
                        : label === "Agent tools"
                          ? "What tools can you use for studying?"
                          : `Show me ${label.toLowerCase()}.`,
                    )
                  }
                  disabled={isSending}
                >
                  <span className="material-symbols-outlined text-primary">{icon}</span>
                  <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="flex-grow flex flex-col bg-surface-container-lowest rounded-lg border-2 border-surface-variant shadow-sm relative">
          <div className="p-md border-b border-surface-variant flex items-center justify-between bg-surface-container-lowest rounded-t-lg">
            <div className="flex items-center gap-sm">
              <div className="bg-primary-container p-sm rounded-full">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  smart_toy
                </span>
              </div>
              <div>
                <p className="font-headline-md text-headline-md text-primary leading-tight">Sidekick</p>
                <p className="font-label-sm text-label-sm text-primary flex items-center gap-xs">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  Canvas-aware and grounded
                </p>
              </div>
            </div>
          </div>

          <div className="px-md pt-md">
            <div className="rounded-lg border-2 border-primary-fixed-dim bg-primary-container/25 px-md py-sm flex items-start gap-sm">
              <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">schedule</span>
                <p className="font-label-md text-label-md text-on-surface-variant">
                Chats are kept in this browser for 24 hours, then auto-cleared. Sidekick can answer from Canvas/materials and can run safe study tools when you explicitly ask.
                {chatProviderStatus ? <span className="block mt-xs text-primary">{chatProviderStatus}</span> : null}
              </p>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-md space-y-lg custom-scrollbar">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-md ${message.role === "user" ? "justify-end" : "max-w-[88%]"}`}
              >
                {message.role === "assistant" ? (
                  <div className="w-10 h-10 rounded-full bg-[#EBE7FF] flex items-center justify-center flex-shrink-0 border-2 border-[#D1C4FF]">
                    <span className="material-symbols-outlined text-[#5D4E8B]">auto_awesome</span>
                  </div>
                ) : null}
                <div
                  className={`p-md bubbly-shadow whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-[#FFEBE6] rounded-tl-xl rounded-b-xl border-2 border-[#FFC7B8] max-w-[85%] text-[#532D23]"
                      : message.provider === "agent"
                        ? "bg-primary-container rounded-tr-xl rounded-b-xl border-2 border-primary-fixed-dim text-primary"
                        : "bg-[#EBE7FF] rounded-tr-xl rounded-b-xl border-2 border-[#D1C4FF] text-[#352D53]"
                  }`}
                >
                  <p className="font-body-md text-body-md">{message.content}</p>
                  {message.role === "assistant" && message.provider ? (
                    <p className="mt-sm font-label-sm text-label-sm opacity-70">
                      {message.provider === "gemini"
                        ? `Gemini${message.model ? ` (${message.model})` : ""}`
                        : message.provider === "agent"
                          ? "Study Agent"
                      : "Deterministic fallback"}
                    </p>
                  ) : null}
                  {message.role === "assistant" && message.confirmation ? (
                    <div className="mt-md rounded-lg border-2 border-primary bg-surface-container-lowest text-on-surface p-md whitespace-normal">
                      <div className="flex items-start gap-sm">
                        <span className="material-symbols-outlined text-primary text-[22px] mt-0.5">verified_user</span>
                        <div className="min-w-0">
                          <p className="font-headline-sm text-headline-sm text-primary leading-tight">
                            {message.confirmation.title}
                          </p>
                          <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
                            {message.confirmation.body}
                          </p>
                        </div>
                      </div>
                      {message.confirmation.details.length ? (
                        <div className="mt-sm grid gap-xs">
                          {message.confirmation.details.map((detail) => (
                            <div key={detail} className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant">
                              <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                              <span>{detail}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-md flex flex-wrap gap-sm">
                        <button
                          type="button"
                          className="px-md py-sm rounded-full bg-primary text-on-primary font-label-md text-label-md bubbly-button disabled:opacity-50"
                          disabled={isSending || actions.isBusy || message.confirmationStatus !== "pending"}
                          title={actions.disabledReason || undefined}
                          onClick={() => onConfirmAction(message.id, message.confirmation?.token || "")}
                        >
                          {message.confirmationStatus === "confirmed" ? "Confirmed" : message.confirmation.confirmLabel}
                        </button>
                        <button
                          type="button"
                          className="px-md py-sm rounded-full border-2 border-surface-variant bg-surface-container-low text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
                          disabled={isSending || actions.isBusy || message.confirmationStatus !== "pending"}
                          title={actions.disabledReason || undefined}
                          onClick={() => onCancelAction(message.id)}
                        >
                          {message.confirmationStatus === "cancelled" ? "Cancelled" : message.confirmation.cancelLabel}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                {message.role === "user" ? (
                  <div className="w-10 h-10 rounded-full bg-[#FFEBE6] flex items-center justify-center flex-shrink-0 border-2 border-[#FFC7B8]">
                    <span className="material-symbols-outlined text-[#8B4E3E]">person</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="p-md bg-surface-container-lowest rounded-b-lg">
            {attachedFile ? (
              <div className="mb-sm rounded-lg border-2 border-primary-fixed-dim bg-primary-container/25 p-sm">
                <div className="flex flex-col gap-sm md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md text-label-md text-primary">One file ready for Sidekick</p>
                    <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                      {attachedFile.name} - {fileSizeLabel(attachedFile.size)}
                    </p>
                  </div>
                  <select
                    value={uploadCourseId}
                    onChange={(event) => setUploadCourseId(event.target.value)}
                    className="min-w-0 rounded-full border-2 border-surface-variant bg-white px-sm py-xs font-label-md text-label-md focus:border-primary focus:outline-none"
                    disabled={isSending || isUploading}
                  >
                    <option value="">Choose course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.courseCode || "Course"} - {course.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-full border border-primary-fixed-dim bg-white px-sm py-xs font-label-md text-label-md text-primary"
                    onClick={() => {
                      setAttachedFile(null);
                      setUploadMessage(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : null}
            {uploadMessage ? (
              <p className="mb-sm rounded-full border border-primary-fixed-dim bg-surface-container px-sm py-xs font-label-md text-label-md text-primary">
                {uploadMessage}
              </p>
            ) : null}
            <div className="relative flex items-end gap-sm bg-surface-container rounded-lg p-sm border-2 border-surface-variant focus-within:border-primary focus-within:bg-white transition-all">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.ppt,.pptx,.doc,.docx,.txt,.md,.markdown,.html,.htm,.csv,.json,.xml,text/*,image/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setAttachedFile(file);
                  setUploadMessage(file ? "Choose the course, then send your message." : null);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                className="p-sm text-on-surface-variant hover:text-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach one file"
                disabled={isSending || isUploading || !actions.onUploadMaterial}
              >
                <span className="material-symbols-outlined">attach_file</span>
              </button>
              <textarea
                className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 resize-none py-sm font-body-md text-body-md min-h-[44px] max-h-32 custom-scrollbar"
                placeholder="Ask about due dates, rubrics, lectures, files, or study plans..."
                rows={1}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                disabled={isSending || isUploading}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
              <button
                type="button"
                className="bg-primary text-on-primary w-10 h-10 rounded-lg flex items-center justify-center bubbly-button disabled:opacity-60"
                onClick={() => void submit()}
                aria-label="Send message"
                disabled={isSending || isUploading || (!draft.trim() && !attachedFile)}
              >
                <span className="material-symbols-outlined">{isSending || isUploading ? "hourglass_top" : "send"}</span>
              </button>
            </div>
            <div className="mt-sm flex justify-center">
              <p className="font-label-sm text-label-sm text-outline">
                Sidekick answers from synced Canvas data and one uploaded file at a time. Uploaded files are saved to Files under the chosen course.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
