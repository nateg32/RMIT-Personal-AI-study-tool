/* eslint-disable react/no-unescaped-entities */
// src/views/AnnouncementsView.tsx

export default function AnnouncementsView() {
  return (
    <div className="min-h-screen px-margin-desktop pb-lg text-on-background bg-background selection:bg-primary-container max-w-7xl relative mx-auto">
      {/* TopNavBar Shell (Integrated Search/Actions) */}
      <header className="flex justify-between items-center w-full py-md mb-xl z-30 sticky top-0 bg-background/80 backdrop-blur-md -mx-margin-desktop px-margin-desktop">
        <div className="flex items-center gap-md flex-1">
          <h2 className="font-headline-lg text-headline-lg font-bold text-primary whitespace-nowrap">Study Command Centre</h2>
          <div className="relative flex-1 max-w-md hidden lg:block">
            <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input className="w-full bg-surface-container-low border-2 border-outline-variant rounded-full py-sm pl-xl pr-md focus:border-primary focus:ring-0 transition-all font-body-md text-body-md outline-none" placeholder="Search announcements..." type="text"/>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <button className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-primary-container/50 transition-all active:scale-95">
            <span className="material-symbols-outlined text-primary">notifications</span>
          </button>
          <button className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-primary-container/50 transition-all active:scale-95">
            <span className="material-symbols-outlined text-primary">auto_awesome</span>
          </button>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary-fixed-dim cursor-pointer active:scale-95 transition-all bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">person</span>
          </div>
        </div>
      </header>

      {/* Welcome Section */}
      <section className="mb-xl text-left relative">
        <div className="absolute -top-8 -left-8 opacity-20 pointer-events-none">
          <span className="material-symbols-outlined text-primary text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>colors_spark</span>
        </div>
        <h2 className="font-headline-lg text-headline-lg font-bold text-primary mb-xs relative z-10">Stay in the loop!</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant relative z-10">Your latest academic updates and course whispers in one cozy spot.</p>
      </section>

      {/* Bento Grid for Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter relative z-10">
        {/* Main Feed (Left Column) */}
        <div className="lg:col-span-8 flex flex-col gap-gutter">
          
          {/* Announcement Card 1 (URGENT/NEW) */}
          <div className="sticky-note bg-surface-container-lowest border-2 border-primary-fixed-dim p-md rounded-lg shadow-sm relative group cursor-pointer overflow-hidden">
            <div className="flex justify-between items-start mb-sm">
              <div className="flex items-center gap-sm">
                <span className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-md py-xs rounded-full">Biology 101</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Today, 9:45 AM</span>
              </div>
              <span className="sparkle-badge text-on-tertiary-fixed-variant px-md py-xs rounded-full font-label-sm text-label-sm flex items-center gap-xs">
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span> NEW
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary mb-sm">Upcoming Lab Practical: Preparation Tips</h3>
            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">Hey everyone! For Thursday's lab, please ensure you've reviewed the safety protocols and downloaded the digital microscope guide. We'll be focusing on cellular structures...</p>
            <div className="mt-md flex justify-between items-center">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full border-2 border-surface bg-primary-fixed flex items-center justify-center text-[10px] font-bold">JD</div>
                <div className="w-8 h-8 rounded-full border-2 border-surface bg-secondary-fixed flex items-center justify-center text-[10px] font-bold">AS</div>
              </div>
              <button className="text-primary font-label-md text-label-md flex items-center gap-xs group-hover:gap-sm transition-all">
                Read full update <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
            {/* Tactile Accent: Folded Corner */}
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-surface-container opacity-20 folded-corner"></div>
          </div>

          {/* Announcement Card 2 */}
          <div className="bg-surface-container-lowest border-2 border-surface-variant p-md rounded-lg shadow-sm group cursor-pointer hover:border-tertiary-fixed-dim transition-all">
            <div className="flex justify-between items-start mb-sm">
              <div className="flex items-center gap-sm">
                <span className="bg-tertiary-container text-on-tertiary-container font-label-sm text-label-sm px-md py-xs rounded-full">World History</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Oct 24, 2023</span>
              </div>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Essay Deadline Extension!</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">Great news for all students! The deadline for the 'Renaissance Impact' essay has been extended by 48 hours. The new submission link is now active in the Files folder...</p>
            <div className="mt-md flex justify-end">
              <button className="text-primary font-label-md text-label-md flex items-center gap-xs group-hover:gap-sm transition-all">
                View details <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Announcement Card 3 */}
          <div className="bg-surface-container-lowest border-2 border-surface-variant p-md rounded-lg shadow-sm group cursor-pointer hover:border-secondary-fixed-dim transition-all">
            <div className="flex justify-between items-start mb-sm">
              <div className="flex items-center gap-sm">
                <span className="bg-primary-container text-on-primary-container font-label-sm text-label-sm px-md py-xs rounded-full">Organic Chemistry</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Oct 22, 2023</span>
              </div>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Guest Lecture: Dr. Aris Thorne</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">We are honored to host Dr. Thorne this Friday to discuss molecular bonding in pharmaceuticals. This session is highly recommended for those pursuing the pre-med track...</p>
            <div className="mt-md flex justify-end">
              <button className="text-primary font-label-md text-label-md flex items-center gap-xs group-hover:gap-sm transition-all">
                Add to calendar <span className="material-symbols-outlined">event</span>
              </button>
            </div>
          </div>

          {/* Empty State/Pagination */}
          <div className="py-lg text-center">
            <button className="px-xl py-sm bg-surface-container border-2 border-outline-variant rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-variant transition-all active:scale-95">
              Load Older Announcements
            </button>
          </div>
        </div>

        {/* Sidebar Contextual Info (Right Column) */}
        <div className="lg:col-span-4 flex flex-col gap-gutter">
          {/* Reminder Sticky Note */}
          <div className="bg-tertiary-container p-md rounded-lg shadow-sm rotate-1 flex flex-col gap-sm border-2 border-tertiary-fixed">
            <div className="flex items-center gap-sm text-on-tertiary-container font-bold">
              <span className="material-symbols-outlined">push_pin</span>
              <span className="font-label-md text-label-md uppercase tracking-wider">Note to self</span>
            </div>
            <p className="font-body-md text-body-md text-on-tertiary-fixed-variant italic">
              "Don't forget to check the new study guides uploaded for Finals! You've got this! ✨"
            </p>
          </div>

          {/* Course Filters */}
          <div className="bg-surface-container-high p-md rounded-lg flex flex-col gap-md">
            <h4 className="font-headline-md text-headline-md text-primary">Filter by Course</h4>
            <div className="flex flex-wrap gap-xs">
              <button className="px-md py-xs bg-primary text-on-primary rounded-full font-label-sm text-label-sm">All</button>
              <button className="px-md py-xs bg-surface-container-lowest text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-primary-container transition-all">Biology</button>
              <button className="px-md py-xs bg-surface-container-lowest text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-primary-container transition-all">History</button>
              <button className="px-md py-xs bg-surface-container-lowest text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-primary-container transition-all">Math</button>
              <button className="px-md py-xs bg-surface-container-lowest text-on-surface-variant rounded-full font-label-sm text-label-sm hover:bg-primary-container transition-all">Chemistry</button>
            </div>
          </div>

          {/* Sidekick Accent */}
          <div className="bg-primary-container/20 rounded-lg p-lg flex flex-col items-center text-center gap-md border-2 border-dashed border-primary-fixed-dim">
            <span className="material-symbols-outlined text-[64px] text-primary">support_agent</span>
            <div>
              <h5 className="font-headline-md text-headline-md text-primary-fixed-variant">3 New Updates!</h5>
              <p className="font-label-md text-label-md text-on-surface-variant">Keep up the great work, you're staying well informed today.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
