/* eslint-disable react/no-unescaped-entities */
// src/views/AssignmentsView.tsx

export default function AssignmentsView() {
  return (
    <div className="pb-lg px-margin-desktop min-h-screen">
      {/* Top Nav Bar Content */}
      <header className="flex justify-between items-center w-full max-w-7xl mx-auto mb-lg sticky top-0 z-30 bg-background/80 backdrop-blur-md py-md -mx-margin-desktop px-margin-desktop">
        <div className="flex items-center gap-md flex-1">
          <h2 className="font-headline-lg text-headline-lg font-bold text-primary whitespace-nowrap">Study Command Centre</h2>
          <div className="hidden lg:flex items-center bg-surface-container-low border-2 border-outline-variant rounded-full px-md py-xs flex-1 max-w-md">
            <span className="material-symbols-outlined text-on-surface-variant mr-sm">search</span>
            <input className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-md w-full" placeholder="Search tasks..." type="text" />
          </div>
        </div>
        <div className="flex items-center gap-md">
          <div className="flex gap-sm">
            <button className="p-sm rounded-full hover:bg-primary-container transition-colors scale-105 active:scale-95">
              <span className="material-symbols-outlined text-primary">notifications</span>
            </button>
            <button className="p-sm rounded-full hover:bg-primary-container transition-colors scale-105 active:scale-95">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-primary overflow-hidden flex items-center justify-center bg-primary-container">
              <span className="material-symbols-outlined text-primary">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Page Title & Specific Headers */}
      <div className="max-w-7xl mx-auto w-full mb-md">
        <h1 className="font-display-lg text-display-lg text-primary">Assignments & Tasks</h1>
        <p className="font-body-lg text-on-surface-variant mt-sm">Manage your tasks and stay on top of your grades!</p>
      </div>

      {/* Filters Section */}
      <section className="flex flex-wrap items-center gap-sm mb-xl max-w-7xl mx-auto w-full">
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mr-xs">Filter:</span>
        <button className="px-md py-sm rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm bubbly-button">Due Soon</button>
        <button className="px-md py-sm rounded-full bg-surface-container border-2 border-surface-variant text-on-surface-variant font-label-md text-label-md hover:bg-primary-container hover:border-primary-fixed transition-all bubbly-button">Submitted</button>
        <button className="px-md py-sm rounded-full bg-surface-container border-2 border-surface-variant text-on-surface-variant font-label-md text-label-md hover:bg-primary-container hover:border-primary-fixed transition-all bubbly-button">Unsubmitted</button>
        <button className="px-md py-sm rounded-full bg-surface-container border-2 border-surface-variant text-on-surface-variant font-label-md text-label-md hover:bg-primary-container hover:border-primary-fixed transition-all bubbly-button flex items-center gap-xs">
          By Course
          <span className="material-symbols-outlined text-[16px]">expand_more</span>
        </button>
        <div className="ml-auto hidden sm:block">
          <button className="bg-primary-container text-on-primary-container px-lg py-sm rounded-full font-label-md text-label-md flex items-center gap-sm bubbly-button border-2 border-primary-fixed-dim">
            <span className="material-symbols-outlined">add</span>
            Create Study Session
          </button>
        </div>
      </section>

      {/* Assignments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter max-w-7xl mx-auto w-full">
        {/* Card 1: High Urgency */}
        <div className="sticky-note bg-tertiary-container p-md rounded-lg bubbly-shadow border-2 border-tertiary-fixed-dim flex flex-col justify-between min-h-[280px] folded-corner">
          <div>
            <div className="flex justify-between items-start mb-sm">
              <span className="px-sm py-xs bg-tertiary text-on-tertiary rounded-full font-label-sm text-label-sm">Intro to Psychology</span>
              <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-tertiary-container mb-xs">Neural Networks Essay</h3>
            <p className="font-body-md text-on-tertiary-container opacity-80 mb-md">Draft the final section about cognitive synaptic links and proofread the citations.</p>
          </div>
          <div className="space-y-md">
            <div className="flex justify-between items-center text-on-tertiary-container">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                <span className="font-label-md text-label-md">Oct 24, 2023</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-sm">schedule</span>
                <span className="font-label-md text-label-md">In Progress</span>
              </div>
            </div>
            <div className="flex gap-sm">
              <button className="flex-1 bg-on-tertiary-container text-tertiary-container py-xs rounded-lg font-label-md text-label-md bubbly-button">Focus Now</button>
              <button className="p-xs bg-white/40 rounded-lg text-on-tertiary-container hover:bg-white/60 transition-all">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Medium Urgency */}
        <div className="sticky-note-peach bg-secondary-container p-md rounded-lg bubbly-shadow border-2 border-secondary-fixed-dim flex flex-col justify-between min-h-[280px] folded-corner">
          <div>
            <div className="flex justify-between items-start mb-sm">
              <span className="px-sm py-xs bg-secondary text-on-secondary rounded-full font-label-sm text-label-sm">Applied Calculus</span>
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-secondary-container mb-xs">Derivatives Worksheet</h3>
            <p className="font-body-md text-on-secondary-container opacity-80 mb-md">Complete the 20 problems on the Chain Rule and implicit differentiation.</p>
          </div>
          <div className="space-y-md">
            <div className="flex justify-between items-center text-on-secondary-container">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                <span className="font-label-md text-label-md">Oct 26, 2023</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-sm">pending</span>
                <span className="font-label-md text-label-md">Unsubmitted</span>
              </div>
            </div>
            <div className="flex gap-sm">
              <button className="flex-1 bg-on-secondary-container text-secondary-container py-xs rounded-lg font-label-md text-label-md bubbly-button">Start Work</button>
              <button className="p-xs bg-white/40 rounded-lg text-on-secondary-container hover:bg-white/60 transition-all">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Low Urgency */}
        <div className="sticky-note-lavender bg-primary-container p-md rounded-lg bubbly-shadow border-2 border-primary-fixed-dim flex flex-col justify-between min-h-[280px] folded-corner">
          <div>
            <div className="flex justify-between items-start mb-sm">
              <span className="px-sm py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm">Modern History</span>
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-primary-container mb-xs">Cold War Reading</h3>
            <p className="font-body-md text-on-primary-container opacity-80 mb-md">Read chapters 4 and 5 of "The Iron Curtain" and take summarized notes.</p>
          </div>
          <div className="space-y-md">
            <div className="flex justify-between items-center text-on-primary-container">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                <span className="font-label-md text-label-md">Nov 02, 2023</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span className="font-label-md text-label-md">Not Started</span>
              </div>
            </div>
            <div className="flex gap-sm">
              <button className="flex-1 bg-on-primary-container text-primary-container py-xs rounded-lg font-label-md text-label-md bubbly-button">Review</button>
              <button className="p-xs bg-white/40 rounded-lg text-on-primary-container hover:bg-white/60 transition-all">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
          </div>
        </div>

        {/* Add New Card Styled Bento Style */}
        <div className="col-span-1 md:col-span-2 xl:col-span-1 p-md rounded-lg bg-white border-2 border-surface-variant flex items-center justify-center border-dashed group cursor-pointer hover:bg-surface transition-all">
          <div className="text-center group-hover:scale-110 transition-transform">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-md">
              <span className="material-symbols-outlined text-primary text-display-lg">add</span>
            </div>
            <p className="font-headline-md text-headline-md text-on-surface-variant">Add New Assignment</p>
            <p className="font-label-md text-label-md text-outline">Keep your dashboard tidy and up to date</p>
          </div>
        </div>

        {/* Stats Card (Bento Twist) */}
        <div className="xl:col-span-2 bg-surface-container p-md rounded-lg border-2 border-surface-variant flex flex-col md:flex-row items-center gap-lg">
          <div className="flex-1">
            <h3 className="font-headline-md text-headline-md text-primary mb-xs">Your Progress Sparkles! ✨</h3>
            <p className="font-body-md text-on-surface-variant mb-md">You've completed 85% of your tasks this week. Keep up the momentum to unlock the "Focus Wizard" badge!</p>
            <div className="w-full bg-white rounded-full h-4 relative overflow-hidden border-2 border-primary-fixed">
              <div className="h-full bg-primary w-[85%] rounded-full progress-candy"></div>
            </div>
            <div className="flex justify-between mt-sm">
              <span className="font-label-sm text-label-sm text-on-surface-variant">12 Tasks Completed</span>
              <span className="font-label-sm text-label-sm text-primary font-bold">85% Mastery</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
