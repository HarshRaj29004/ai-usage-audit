import { SpendForm } from "../components/SpendForm";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            AI Spend Audit
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
            Audit AI tool spend with local persistence.
          </h1>
          <p className="max-w-2xl text-base text-slate-600">
            Track tool usage, preserve form state across refreshes, and generate a shareable audit payload without exposing PII.
          </p>
        </div>

        <SpendForm />
      </div>
    </main>
  );
}