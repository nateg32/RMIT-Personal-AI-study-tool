/* eslint-disable react/no-unescaped-entities */
// src/views/AiChatView.tsx

export default function AiChatView() {
  return (
    <div className="flex flex-col flex-grow overflow-hidden h-full">
      {/* TopNavBar */}
      <header className="flex justify-between items-center w-full px-margin-desktop py-md bg-background/80 backdrop-blur-md sticky top-0 z-30 max-w-7xl mx-auto">
        <div className="flex items-center gap-md flex-1">
          <h2 className="font-headline-lg text-headline-lg font-bold text-primary whitespace-nowrap">Study Command Centre</h2>
          <div className="hidden lg:flex items-center bg-surface-container-low border-2 border-outline-variant rounded-full px-md py-xs flex-1 max-w-md">
            <span className="material-symbols-outlined text-outline mr-sm">search</span>
            <input className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-md w-full font-body-md" placeholder="Search insights..." type="text"/>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <div className="flex items-center gap-sm">
            <button className="p-sm text-primary hover:bg-primary-container/50 rounded-full transition-all duration-200 active:scale-95">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-sm text-primary hover:bg-primary-container/50 rounded-full transition-all duration-200 active:scale-95">
              <span className="material-symbols-outlined">auto_awesome</span>
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-primary ml-sm cursor-pointer hover:scale-105 transition-transform bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Workspace */}
      <div className="flex flex-grow overflow-hidden px-margin-desktop pb-lg gap-md max-w-7xl w-full mx-auto">
        
        {/* Left Panel: Chat History & Suggestions */}
        <section className="hidden lg:flex flex-col w-80 flex-shrink-0 gap-md">
          {/* Suggested Prompts Sticky Notes */}
          <div className="flex flex-col gap-sm">
            <h3 className="font-label-md text-label-md text-on-surface-variant px-sm">SUGGESTED FOR YOU</h3>
            
            <button className="text-left bg-[#FFF9E6] border-2 border-[#FFE8A3] p-md rounded-lg bubbly-shadow bubbly-button rotate-[-1deg] transition-all hover-squish">
              <span className="font-label-sm text-label-sm text-[#816147] mb-xs block">QUICK START</span>
              <p className="font-body-md text-body-md font-bold text-[#5d4129]">What should I focus on today?</p>
              <div className="flex justify-end mt-sm">
                <span className="material-symbols-outlined text-[#FFE8A3] text-sm">auto_fix_high</span>
              </div>
            </button>
            
            <button className="text-left bg-[#EBE7FF] border-2 border-[#D1C4FF] p-md rounded-lg bubbly-shadow bubbly-button rotate-[1deg] transition-all hover-squish">
              <span className="font-label-sm text-label-sm text-[#5D4E8B] mb-xs block">DEADLINES</span>
              <p className="font-body-md text-body-md font-bold text-[#352D53]">What is due this week?</p>
              <div className="flex justify-end mt-sm">
                <span className="material-symbols-outlined text-[#D1C4FF] text-sm">event</span>
              </div>
            </button>
            
            <button className="text-left bg-[#FFEBE6] border-2 border-[#FFC7B8] p-md rounded-lg bubbly-shadow bubbly-button rotate-[-0.5deg] transition-all hover-squish">
              <span className="font-label-sm text-label-sm text-[#8B4E3E] mb-xs block">PLANNING</span>
              <p className="font-body-md text-body-md font-bold text-[#532D23]">Make me a 1-hour study plan</p>
              <div className="flex justify-end mt-sm">
                <span className="material-symbols-outlined text-[#FFC7B8] text-sm">schedule</span>
              </div>
            </button>
          </div>

          {/* Recent Conversations */}
          <div className="flex flex-col flex-grow bg-surface-container-low rounded-lg p-md border-2 border-surface-variant overflow-hidden">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-md">RECENT CHATS</h3>
            <div className="flex flex-col gap-xs overflow-y-auto custom-scrollbar">
              <div className="p-sm rounded-lg bg-surface-container hover:bg-primary-container/30 cursor-pointer transition-colors border border-transparent">
                <p className="font-label-md text-label-md text-on-surface truncate">Macroeconomics Exam Prep</p>
                <span className="text-[10px] text-outline font-label-sm">2 hours ago</span>
              </div>
              <div className="p-sm rounded-lg hover:bg-primary-container/30 cursor-pointer transition-colors border border-transparent">
                <p className="font-label-md text-label-md text-on-surface-variant truncate">Essay Outline: Ethics in AI</p>
                <span className="text-[10px] text-outline font-label-sm">Yesterday</span>
              </div>
              <div className="p-sm rounded-lg hover:bg-primary-container/30 cursor-pointer transition-colors border border-transparent">
                <p className="font-label-md text-label-md text-on-surface-variant truncate">Weekly Review (May 1-7)</p>
                <span className="text-[10px] text-outline font-label-sm">Monday</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel: Chat Thread */}
        <section className="flex-grow flex flex-col bg-surface-container-lowest rounded-lg border-2 border-surface-variant shadow-sm relative">
          {/* Thread Header */}
          <div className="p-md border-b border-surface-variant flex items-center justify-between bg-surface-container-lowest rounded-t-lg">
            <div className="flex items-center gap-sm">
              <div className="bg-primary-container p-sm rounded-full">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div>
                <p className="font-headline-md text-headline-md text-primary leading-tight">Sidekick</p>
                <p className="font-label-sm text-label-sm text-primary flex items-center gap-xs">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                  Online & Thinking
                </p>
              </div>
            </div>
            <div className="flex gap-xs">
              <button className="p-sm rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
          </div>

          {/* Messages Content */}
          <div className="flex-grow overflow-y-auto p-md space-y-lg custom-scrollbar">
            {/* AI Welcome */}
            <div className="flex items-start gap-md max-w-[85%]">
              <div className="w-10 h-10 rounded-full bg-[#EBE7FF] flex items-center justify-center flex-shrink-0 border-2 border-[#D1C4FF]">
                <span className="material-symbols-outlined text-[#5D4E8B]">auto_awesome</span>
              </div>
              <div className="bg-[#EBE7FF] p-md rounded-tr-xl rounded-b-xl border-2 border-[#D1C4FF] bubbly-shadow">
                <p className="font-body-md text-body-md text-[#352D53]">
                  Hi there! 👋 I'm your Study Sidekick. I can help you break down complex topics, organize your schedule, or even just keep you motivated while you grind through those notes.
                </p>
                <p className="font-body-md text-body-md text-[#352D53] mt-sm">
                  What's on your mind today?
                </p>
              </div>
            </div>

            {/* User Message */}
            <div className="flex items-start gap-md justify-end">
              <div className="bg-[#FFEBE6] p-md rounded-tl-xl rounded-b-xl border-2 border-[#FFC7B8] max-w-[85%] bubbly-shadow">
                <p className="font-body-md text-body-md text-[#532D23]">
                  Hey Sidekick! I'm feeling a bit overwhelmed with my Chemistry exam on Friday. Can you help me prioritize?
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#FFEBE6] flex items-center justify-center flex-shrink-0 border-2 border-[#FFC7B8]">
                <span className="material-symbols-outlined text-[#8B4E3E]">person</span>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex items-start gap-md max-w-[85%]">
              <div className="w-10 h-10 rounded-full bg-[#EBE7FF] flex items-center justify-center flex-shrink-0 border-2 border-[#D1C4FF]">
                <span className="material-symbols-outlined text-[#5D4E8B]">auto_awesome</span>
              </div>
              <div className="bg-[#EBE7FF] p-md rounded-tr-xl rounded-b-xl border-2 border-[#D1C4FF] bubbly-shadow">
                <p className="font-body-md text-body-md text-[#352D53]">
                  Chem can be a lot! 🧪 Don't worry, we've got this. Based on your syllabus, it looks like **Organic Compounds** and **Stoichiometry** carry the most weight. 
                </p>
                <div className="mt-md space-y-sm">
                  <div className="bg-white/50 p-sm rounded-lg border border-[#D1C4FF]">
                    <p className="font-label-md text-label-md font-bold text-[#352D53] flex items-center gap-xs">
                      <span className="material-symbols-outlined text-sm">stars</span> Suggested Action:
                    </p>
                    <p className="font-body-md text-body-md text-[#352D53]">Let's spend the next 45 minutes reviewing Lewis structures. I can quiz you after! ✨</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Thinking Indicator */}
            <div className="flex items-start gap-md max-w-[85%] animate-pulse opacity-60">
              <div className="w-10 h-10 rounded-full bg-[#EBE7FF] flex items-center justify-center flex-shrink-0 border-2 border-[#D1C4FF]">
                <span className="material-symbols-outlined text-[#5D4E8B]">auto_awesome</span>
              </div>
              <div className="bg-[#EBE7FF] px-md py-sm rounded-full border-2 border-[#D1C4FF]">
                <div className="flex gap-xs items-center h-full">
                  <div className="w-2 h-2 bg-[#5D4E8B] rounded-full"></div>
                  <div className="w-2 h-2 bg-[#5D4E8B] rounded-full opacity-70"></div>
                  <div className="w-2 h-2 bg-[#5D4E8B] rounded-full opacity-40"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className="p-md bg-surface-container-lowest rounded-b-lg">
            <div className="relative flex items-end gap-sm bg-surface-container rounded-lg p-sm border-2 border-surface-variant focus-within:border-primary focus-within:bg-white transition-all">
              <button className="p-sm text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">attach_file</span>
              </button>
              <textarea 
                className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 resize-none py-sm font-body-md text-body-md min-h-[44px] max-h-32 custom-scrollbar" 
                placeholder="Type your message here..." 
                rows={1}
              />
              <button className="bg-primary text-on-primary w-10 h-10 rounded-lg flex items-center justify-center bubbly-button">
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
            <div className="mt-sm flex justify-center">
              <p className="font-label-sm text-label-sm text-outline">Sidekick can make mistakes. Verify important info!</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
