/* eslint-disable react/no-unescaped-entities */
// src/views/StudySessionsView.tsx

export default function StudySessionsView() {
  return (
    <div className="min-h-screen px-margin-desktop pb-lg flex flex-col">
      {/* Top Nav Bar Content */}
      <header className="flex justify-between items-center w-full max-w-7xl mx-auto mb-lg sticky top-0 z-30 bg-background/80 backdrop-blur-md py-md -mx-margin-desktop px-margin-desktop">
        <div className="flex items-center gap-md flex-1">
          <h2 className="font-headline-lg text-headline-lg font-bold text-primary whitespace-nowrap">Study Command Centre</h2>
          <div className="hidden lg:flex items-center bg-surface-container-low border-2 border-outline-variant rounded-full px-md py-xs flex-1 max-w-md">
            <span className="material-symbols-outlined text-on-surface-variant mr-sm">search</span>
            <input className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-md w-full" placeholder="Search sessions..." type="text" />
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
            <div className="w-10 h-10 rounded-full border-2 border-primary overflow-hidden flex items-center justify-center bg-primary-container cursor-pointer active:scale-95 transition-all">
              <span className="material-symbols-outlined text-primary">person</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full flex-grow pb-xl">
        {/* Header Greeting */}
        <div className="mb-lg flex flex-col md:flex-row md:items-end justify-between gap-md mt-sm">
          <div>
            <h1 className="font-display-lg text-display-lg text-primary mb-xs">Study Session Builder ✨</h1>
            <p className="text-body-lg font-body-lg text-on-surface-variant flex items-center gap-xs">
              Designing a perfect flow for: <span className="font-bold text-secondary">Organic Chemistry Quiz Prep</span>
            </p>
          </div>
          <div className="bg-tertiary-container px-md py-sm rounded-lg flex items-center gap-sm self-start md:self-auto">
            <span className="material-symbols-outlined text-on-tertiary-container">auto_awesome</span>
            <p className="font-label-md text-on-tertiary-container italic">"You've got this, superstar!"</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          {/* Step 1: Configuration Sticky Notes */}
          <div className="col-span-12 lg:col-span-5 space-y-gutter">
            <div className="sticky-note bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant -rotate-1">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">schedule</span>
                <h3 className="font-headline-md text-headline-md">1. How long?</h3>
              </div>
              <div className="grid grid-cols-3 gap-sm">
                <button className="p-sm border-2 border-surface-variant rounded-lg font-bold hover:border-primary hover:bg-primary-container/30 transition-all text-center">
                  <span className="block text-xl">25m</span>
                  <span className="text-xs uppercase opacity-70">Quick Sprint</span>
                </button>
                <button className="p-sm border-2 border-primary bg-primary-container rounded-lg font-bold transition-all text-center hover-squish">
                  <span className="block text-xl">50m</span>
                  <span className="text-xs uppercase opacity-70">The Classic</span>
                </button>
                <button className="p-sm border-2 border-surface-variant rounded-lg font-bold hover:border-primary hover:bg-primary-container/30 transition-all text-center">
                  <span className="block text-xl">90m</span>
                  <span className="text-xs uppercase opacity-70">Deep Dive</span>
                </button>
              </div>
            </div>

            <div className="sticky-note bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant rotate-1">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">battery_charging_80</span>
                <h3 className="font-headline-md text-headline-md">2. Energy Level?</h3>
              </div>
              <div className="grid grid-cols-3 gap-sm">
                <button className="p-sm border-2 border-surface-variant rounded-lg font-bold hover:border-primary hover:bg-primary-container/30 transition-all flex flex-col items-center">
                  <span className="material-symbols-outlined mb-xs">sentiment_dissatisfied</span>
                  <span className="text-sm">Low</span>
                </button>
                <button className="p-sm border-2 border-primary bg-primary-container rounded-lg font-bold transition-all flex flex-col items-center hover-squish">
                  <span className="material-symbols-outlined mb-xs">sentiment_satisfied</span>
                  <span className="text-sm">Medium</span>
                </button>
                <button className="p-sm border-2 border-surface-variant rounded-lg font-bold hover:border-primary hover:bg-primary-container/30 transition-all flex flex-col items-center">
                  <span className="material-symbols-outlined mb-xs">sentiment_very_satisfied</span>
                  <span className="text-sm">High</span>
                </button>
              </div>
            </div>

            <div className="sticky-note bg-surface-container-lowest p-md rounded-lg border-2 border-surface-variant -rotate-1">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-primary">psychology</span>
                <h3 className="font-headline-md text-headline-md">3. Study Mode?</h3>
              </div>
              <div className="space-y-sm">
                <button className="w-full flex items-center justify-between p-md border-2 border-surface-variant rounded-lg hover:bg-primary-container/10 transition-all">
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-secondary-container">timer</span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Pomodoro</p>
                      <p className="text-xs text-on-surface-variant">Focus/Break cycles</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-surface-variant">check_circle</span>
                </button>
                <button className="w-full flex items-center justify-between p-md border-2 border-primary bg-primary-container rounded-lg transition-all hover-squish">
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-primary">waves</span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-on-primary-container">Flow State</p>
                      <p className="text-xs text-on-surface-variant">Gentle transitions</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                </button>
              </div>
            </div>
          </div>

          {/* Session Output & Timer */}
          <div className="col-span-12 lg:col-span-7 space-y-gutter">
            {/* Progress Section */}
            <div className="bg-surface-container-low border-2 border-outline-variant p-lg rounded-lg bubbly-shadow flex flex-col items-center relative overflow-hidden">
              <div className="absolute -top-4 -right-4 opacity-20 transform rotate-12">
                <span className="material-symbols-outlined text-[120px] text-primary">temp_preferences_custom</span>
              </div>
              <div className="relative w-64 h-64 mb-lg">
                <svg className="w-full h-full transform -rotate-90">
                  <circle className="text-surface-variant" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeWidth="12"></circle>
                  <circle className="text-primary" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeDasharray="691" strokeDashoffset="172" strokeLinecap="round" strokeWidth="12"></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-display-lg text-primary">50:00</span>
                  <span className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">Focus Time</span>
                </div>
              </div>
              
              <div className="w-full bg-white rounded-lg border-2 border-surface-variant p-md mb-md">
                <div className="flex items-center justify-between mb-sm">
                  <span className="font-bold text-primary">Today's Session Plan</span>
                  <span className="text-xs font-bold text-on-surface-variant px-sm py-1 bg-surface-container rounded-full">Classic Flow</span>
                </div>
                <div className="space-y-sm">
                  <div className="flex items-center gap-md p-sm bg-primary-container rounded-lg border border-primary/20">
                    <span className="font-bold text-primary w-12">25m</span>
                    <span className="material-symbols-outlined text-primary">menu_book</span>
                    <span className="flex-1 font-medium">Deep Focus: Reading & Notes</span>
                  </div>
                  <div className="flex items-center gap-md p-sm bg-secondary-container rounded-lg border border-secondary/20">
                    <span className="font-bold text-secondary w-12">5m</span>
                    <span className="material-symbols-outlined text-secondary">celebration</span>
                    <span className="flex-1 font-medium">Dance Break / Hydration</span>
                  </div>
                  <div className="flex items-center gap-md p-sm border border-surface-variant rounded-lg opacity-60">
                    <span className="font-bold w-12">20m</span>
                    <span className="material-symbols-outlined">edit</span>
                    <span className="flex-1 font-medium">Practice Problems</span>
                  </div>
                </div>
              </div>

              <button className="bubbly-button w-full bg-primary text-on-primary font-bold py-md rounded-lg text-lg flex items-center justify-center gap-sm shadow-lg">
                <span className="material-symbols-outlined">play_circle</span> Start Focused Session
              </button>
            </div>

            {/* Task Checklist */}
            <div className="bg-surface-container-highest p-md rounded-lg border-2 border-primary-fixed-dim">
              <div className="flex items-center justify-between mb-md">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">checklist</span>
                  <h3 className="font-headline-md text-headline-md">Session Milestones</h3>
                </div>
                <span className="text-xs bg-primary text-on-primary px-sm py-1 rounded-full">0/4 Completed</span>
              </div>
              <div className="space-y-sm">
                <div className="flex items-center gap-md bg-white p-md rounded-lg border-2 border-transparent hover:border-primary-fixed transition-all cursor-pointer">
                  <div className="w-6 h-6 rounded-md border-2 border-outline flex items-center justify-center"></div>
                  <span className="flex-1 text-on-surface">Review Chapter 4 molecular structures</span>
                  <span className="material-symbols-outlined text-surface-variant">star</span>
                </div>
                <div className="flex items-center gap-md bg-white p-md rounded-lg border-2 border-transparent hover:border-primary-fixed transition-all cursor-pointer">
                  <div className="w-6 h-6 rounded-md border-2 border-outline flex items-center justify-center"></div>
                  <span className="flex-1 text-on-surface">Practice balancing reaction equations</span>
                  <span className="material-symbols-outlined text-surface-variant">star</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
