import { ScanForm } from "@/components/scan-form";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-surface text-on-surface">
      <header className="mx-auto w-full max-w-2xl px-6 pt-10">
        <h1 className="text-2xl font-bold leading-8 text-on-surface">Darkhouse</h1>
        <p className="mt-1 text-on-surface-variant">Accessibility scans, human-ready summaries.</p>
      </header>
      <ScanForm />
    </main>
  );
}