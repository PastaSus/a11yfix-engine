import { ScanForm } from "@/components/scan-form";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-background text-on-surface">
      <header className="mx-auto w-full max-w-2xl px-6 pb-2 pt-14 sm:pt-20">
        <p className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-on-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z"
                fill="currentColor"
              />
              <path d="M17.5 10V5h2v5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-2xl font-bold leading-8 tracking-tight text-on-surface font-display">
            Darkhouse
          </span>
        </p>
        <h1 className="mt-6 max-w-xl text-2xl font-semibold leading-8 text-on-surface sm:text-3xl">
          Accessibility scans, human-ready remediation.
        </h1>
        <p className="mt-3 max-w-xl text-base leading-6 text-on-surface-variant">
          Paste a public URL and Darkhouse audits it for accessibility and core web
          vitals, then explains the fixes in plain language for you and your clients.
        </p>
      </header>
      <ScanForm />
    </main>
  );
}