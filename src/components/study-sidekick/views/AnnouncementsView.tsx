"use client";

import { useMemo, useState } from "react";
import ViewHeader from "../components/ViewHeader";
import type { AnnouncementSummary, CourseSummary, StudySidekickActions } from "../types";
import { compactText, formatDate } from "../lib/client-utils";

type AnnouncementsViewProps = {
  announcements: AnnouncementSummary[];
  courses: CourseSummary[];
  actions: StudySidekickActions;
};

function openCanvas(url?: string | null) {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export default function AnnouncementsView({ announcements, courses, actions }: AnnouncementsViewProps) {
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("all");
  const actionsDisabled = Boolean(actions.isBusy);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return announcements.filter((announcement) => {
      if (course !== "all" && announcement.courseName !== course) return false;
      if (!query) return true;
      return `${announcement.courseName} ${announcement.title} ${announcement.message || ""}`.toLowerCase().includes(query);
    });
  }, [announcements, course, search]);

  return (
    <div className="min-h-screen px-margin-desktop pb-lg text-on-background bg-background selection:bg-primary-container max-w-7xl relative mx-auto">
      <ViewHeader
        searchPlaceholder="Search announcements..."
        searchValue={search}
        onSearchChange={setSearch}
        actions={actions}
      />

      <section className="mb-xl flex flex-col gap-md text-left relative md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-primary mb-xs relative z-10">Stay in the loop</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant relative z-10">
            Announcements are synced from Canvas so you can spot lecturer updates without opening every course.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-xs self-start rounded-full border-2 border-surface-variant bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface transition-all duration-200 hover:border-primary-fixed hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60 md:self-auto"
          onClick={actions.onSyncAnnouncements}
          disabled={actionsDisabled}
          title={actions.disabledReason || "Refresh announcements only"}
        >
          <span className={`material-symbols-outlined text-[18px] ${actions.isSyncingAnnouncements ? "animate-spin" : ""}`}>
            sync
          </span>
          {actions.isSyncingAnnouncements ? "Refreshing..." : "Refresh announcements"}
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter relative z-10">
        <div className="lg:col-span-8 flex flex-col gap-gutter">
          {visible.map((announcement, index) => (
            <article
              key={announcement.id}
              className={`${
                index === 0
                  ? "sticky-note bg-surface-container-lowest border-primary-fixed-dim"
                  : "bg-surface-container-lowest border-surface-variant"
              } border-2 p-md rounded-lg shadow-sm relative group cursor-pointer overflow-hidden`}
              onClick={() => openCanvas(announcement.htmlUrl)}
            >
              <div className="flex justify-between items-start mb-sm gap-sm">
                <div className="flex flex-wrap items-center gap-sm">
                  <span className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-md py-xs rounded-full">
                    {announcement.courseName}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {formatDate(announcement.postedAt)}
                  </span>
                </div>
                {index === 0 ? (
                  <span className="sparkle-badge text-on-tertiary-fixed-variant px-md py-xs rounded-full font-label-sm text-label-sm flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span> NEW
                  </span>
                ) : null}
              </div>
              <h3 className="font-headline-md text-headline-md text-primary mb-sm">{announcement.title}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant line-clamp-3">
                {compactText(announcement.message, "Open in Canvas to read the full announcement.")}
              </p>
              <div className="mt-md flex justify-end">
                <button
                  type="button"
                  className="text-primary font-label-md text-label-md flex items-center gap-xs group-hover:gap-sm transition-all"
                  onClick={(event) => {
                    event.stopPropagation();
                    openCanvas(announcement.htmlUrl);
                  }}
                >
                  Read full update <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-surface-container opacity-20 folded-corner" />
            </article>
          ))}

          {!visible.length ? (
            <div className="py-xl text-center bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-lg">
              <span className="material-symbols-outlined text-primary text-[48px]">campaign</span>
              <h3 className="font-headline-md text-headline-md text-primary mt-sm">No announcements found</h3>
              <p className="font-body-md text-on-surface-variant">Sync Canvas or adjust your filters.</p>
            </div>
          ) : null}
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-gutter">
          <div className="bg-tertiary-container p-md rounded-lg shadow-sm rotate-1 flex flex-col gap-sm border-2 border-tertiary-fixed">
            <div className="flex items-center gap-sm text-on-tertiary-container font-bold">
              <span className="material-symbols-outlined">push_pin</span>
              <span className="font-label-md text-label-md uppercase tracking-wider">What changed?</span>
            </div>
            <p className="font-body-md text-body-md text-on-tertiary-fixed-variant italic">
              Use Daily Brief on the dashboard to turn these updates into a priority list.
            </p>
          </div>

          <div className="bg-surface-container-high p-md rounded-lg flex flex-col gap-md">
            <h4 className="font-headline-md text-headline-md text-primary">Filter by Course</h4>
            <div className="flex flex-wrap gap-xs">
              <button
                type="button"
                className={`px-md py-xs rounded-full font-label-sm text-label-sm ${
                  course === "all" ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant"
                }`}
                onClick={() => setCourse("all")}
              >
                All
              </button>
              {courses.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`px-md py-xs rounded-full font-label-sm text-label-sm ${
                    course === item.name
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-lowest text-on-surface-variant hover:bg-primary-container"
                  } transition-all`}
                  onClick={() => setCourse(item.name)}
                >
                  {item.courseCode || item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-primary-container/20 rounded-lg p-lg flex flex-col items-center text-center gap-md border-2 border-dashed border-primary-fixed-dim">
            <span className="material-symbols-outlined text-[64px] text-primary">support_agent</span>
            <div>
              <h5 className="font-headline-md text-headline-md text-primary-fixed-variant">
                {announcements.length} synced updates
              </h5>
              <p className="font-label-md text-label-md text-on-surface-variant">
                Ask Sidekick if any announcement changes what you should do today.
              </p>
            </div>
            <button
              type="button"
              className="bg-primary text-on-primary px-lg py-sm rounded-full font-label-md text-label-md bubbly-button"
              onClick={() => actions.onOpenChat("Did any lecturer post something important recently?")}
            >
              Ask Sidekick
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
