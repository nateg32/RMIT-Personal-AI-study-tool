import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main
      className="bg-background text-on-background"
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        minHeight: "100svh",
        overflowX: "hidden",
        padding: "clamp(20px, 5vw, 56px)",
        width: "100vw",
      }}
    >
      <section
        className="items-stretch"
        style={{
          alignItems: "stretch",
          display: "flex",
          flexWrap: "wrap",
          gap: "clamp(24px, 4vw, 48px)",
          justifyContent: "center",
          width: "min(100%, 1060px)",
        }}
      >
        <div
          className="hidden md:flex sticky-note-mint rounded-lg p-lg border-2 border-primary-fixed-dim flex-col justify-between bubbly-shadow"
          style={{ flex: "1 1 360px", maxWidth: "520px", minHeight: "460px", minWidth: 0 }}
        >
          <div>
            <div className="w-16 h-16 rounded-full bg-primary-container border-2 border-primary-fixed-dim flex items-center justify-center mb-md">
              <span className="material-symbols-outlined text-primary text-[32px]">smart_toy</span>
            </div>
            <p className="font-label-md text-label-md text-primary uppercase tracking-wider">Study Sidekick</p>
            <h1 className="font-display-lg text-display-lg text-primary mt-xs">Your Canvas command centre.</h1>
          </div>
          <p className="font-body-lg text-body-lg text-on-primary-container mt-lg">
            Sign in, sync Canvas, and turn assignments into focused study sessions.
          </p>
        </div>

        <div
          className="bg-surface-container-lowest border-2 border-surface-variant rounded-lg bubbly-shadow"
          style={{
            flex: "0 1 480px",
            maxWidth: "480px",
            minWidth: 0,
            width: "100%",
          }}
        >
          <div className="p-lg pb-md">
            <p className="font-label-md text-label-md text-primary uppercase tracking-wider">Private dashboard</p>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-xs">Sign in</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-sm">
              Use your allowed RMIT email to receive a one-time sign-in code.
            </p>
          </div>
          <div className="p-lg pt-0">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
