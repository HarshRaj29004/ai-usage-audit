"use client";

import React, { useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

export interface AuditToolResult {
  tool: string;
  label?: string;
  plan?: string;
  currentMonthly: number;
  recommendedMonthly: number;
  savings?: number;
  reason?: string;
}

export interface AuditResultsOutput {
  totalMonthlySavings?: number;
  totalMonthlySpend?: number;
  totalAnnualSavings?: number;
  totalAnnualSpend?: number;
  tools: AuditToolResult[];
  aiSummary?: string;
}

export default function AuditResults({ results }: { results: AuditResultsOutput }): ReactElement {
  const [email, setEmail] = useState("");
  const [aiSummary, setAiSummary] = useState<string | undefined>(results.aiSummary);
  const [aiStructured, setAiStructured] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const monthlySavings = useMemo(() => {
    if (typeof results.totalMonthlySavings === "number") return results.totalMonthlySavings;
    return results.tools?.reduce((s, t) => s + (t.savings ?? Math.max(0, (t.currentMonthly ?? 0) - (t.recommendedMonthly ?? 0))), 0) ?? 0;
  }, [results]);

  const annualSavings = useMemo(() => {
    if (typeof results.totalAnnualSavings === "number") return results.totalAnnualSavings;
    return Math.round(monthlySavings * 12 * 100) / 100;
  }, [monthlySavings, results]);

  const handleBook = () => {
    window.open("https://calendly.com/credex/savings-consultation", "_blank");
  };

  const handleActivate = () => {
    console.log("activate alerts for", email);
    setEmail("");
  };

  return (
    <section className="w-full max-w-6xl mx-auto">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700/90">Audit results</p>
          <h2 className="mt-2 font-serif text-4xl md:text-5xl lg:text-6xl leading-tight text-slate-900">
            <span className="block text-sm text-slate-500">Estimated savings</span>
            <span className="mt-2 inline-flex items-baseline gap-3">
              <strong className="text-5xl md:text-6xl lg:text-7xl font-extrabold">${monthlySavings.toFixed(2)}</strong>
              <span className="text-sm text-slate-500">/ month</span>
            </span>
          </h2>
          <p className="mt-3 text-lg text-slate-600">Annualized: <span className="font-semibold text-slate-900">${annualSavings.toFixed(2)}</span></p>
        </div>

        <div className="mt-4 md:mt-0">
          {monthlySavings > 500 ? (
            <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-4 shadow-lg text-white">
              <p className="font-semibold text-lg">You could be saving big — explore Credex</p>
              <p className="mt-1 text-sm opacity-90">Book a tailored session to capture hidden savings across your AI stack.</p>
              <div className="mt-3 flex gap-3">
                <button onClick={handleBook} className="btn btn--primary">
                  Book Savings Consultation
                </button>
              </div>
            </div>
          ) : monthlySavings < 100 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
              <p className="font-semibold">You're spending well. Your stack is highly optimized.</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field__control"
                />
                <button onClick={handleActivate} className="btn btn--primary">
                  Activate Alerts
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <section className="panel panel--surface">
            <div className="panel__inner">
              <h3 className="panel__title">Per-tool breakdown</h3>
              <div className="tool-stack mt-4">
                {results.tools?.map((t, i) => {
                  const savings = typeof t.savings === "number" ? t.savings : Math.round(((t.currentMonthly ?? 0) - (t.recommendedMonthly ?? 0)) * 100) / 100;

                  return (
                    <article key={`${t.tool}-${i}`} className="tool-card">
                      <div className="tool-card__header">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-md bg-slate-100 grid place-items-center text-lg font-semibold text-slate-700">
                            {t.label ? t.label.charAt(0).toUpperCase() : t.tool?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="tool-card__title">{t.label ?? t.tool}</p>
                            {t.plan ? <p className="text-sm text-slate-500">{t.plan}</p> : null}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-slate-500">Savings</div>
                          <div className="mt-1 inline-flex items-center gap-3">
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 font-semibold">${savings.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="tool-card__grid">
                        <div>
                          <div className="text-xs text-slate-500">Current</div>
                          <div className="text-lg font-semibold">${(t.currentMonthly ?? 0).toFixed(2)} / mo</div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-500">Recommended</div>
                          <div className="text-lg font-semibold">${(t.recommendedMonthly ?? 0).toFixed(2)} / mo</div>
                        </div>

                        <div className="md:col-span-2">
                          <p className="text-sm text-slate-600">{t.reason ?? "Recommended configuration reduces retail spend while preserving capacity."}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="panel panel--soft" ref={summaryRef}>
            <div className="panel__inner">
              <h3 className="panel__title">Executive summary</h3>
              <p className="mt-2 text-sm text-slate-500">Generate a concise executive readout from the audit results.</p>
              <div className="flex items-start gap-3">
                <blockquote className="callout callout--dark mt-4 flex-1">
                  {aiStructured ? (
                    <div>
                      <h4 className="text-lg font-semibold">{aiStructured.title}</h4>
                      <div className="mt-2 text-sm text-slate-700">
                        <p><strong>Total monthly savings:</strong> {aiStructured.totalMonthlySavings}</p>
                        <p className="mt-1"><strong>Highest ROI tool:</strong> {aiStructured.highestROITool}</p>
                        <div className="mt-2">
                          <strong>Strategic recommendations:</strong>
                          <ul className="list-disc list-inside mt-1">
                            {(aiStructured.strategicRecommendations || []).map((r: any, idx: number) => (
                              <li key={idx} className="mt-1">
                                <div className="font-semibold">{r.title}</div>
                                <div className="text-sm text-slate-700 mt-0.5"><strong>Cause:</strong> {r.cause}</div>
                                <div className="text-sm text-slate-700"><strong>Benefit:</strong> {r.benefit}</div>
                                {r.notes ? <div className="text-sm text-slate-500">{r.notes}</div> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="callout__text whitespace-pre-wrap">{aiSummary ?? "No AI summary available yet."}</p>
                  )}
                </blockquote>
                <div className="mt-4">
                  <button
                    className="btn btn--secondary"
                    onClick={async () => {
                      try {
                        setAiLoading(true);
                        const res = await fetch("/api/llm-summary", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(results),
                        });

                        if (!res.ok) {
                          let errText = "Failed to get AI summary";
                          try {
                            const errJson = await res.json();
                            errText = errJson?.error ?? JSON.stringify(errJson) ?? errText;
                            if (errJson?.hint) errText += " — " + errJson.hint;
                          } catch (e) {
                            const txt = await res.text().catch(() => null);
                            if (txt) errText = txt;
                          }
                          throw new Error(errText || "Failed to get AI summary");
                        }

                        const data = await res.json();
                        // Accept either a parsed JSON object (preferred) or raw text
                        if (data?.summary && typeof data.summary === "object") {
                          setAiStructured(data.summary);
                          setAiSummary(undefined);
                        } else if (data?.summaryText) {
                          setAiSummary(data.summaryText);
                          setAiStructured(null);
                        } else if (typeof data?.summary === "string") {
                          setAiSummary(data.summary);
                          setAiStructured(null);
                        } else {
                          setAiSummary(JSON.stringify(data));
                          setAiStructured(null);
                        }

                        requestAnimationFrame(() => {
                          summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      } catch (err) {
                        console.error(err);
                        const message = err instanceof Error ? err.message : String(err);
                        alert(`Unable to generate AI summary — ${message}`);
                      } finally {
                        setAiLoading(false);
                      }
                    }}
                    disabled={aiLoading}
                  >
                    {aiLoading ? "Summarizing…" : "Summarize with AI"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="panel panel--surface">
            <div className="panel__inner">
              <p className="panel__kicker">Snapshot</p>
              <div className="mt-2">
                <p className="text-sm text-slate-500">Total monthly savings</p>
                <p className="form-footer__value">${monthlySavings.toFixed(2)}</p>
                <p className="mt-2 text-sm text-slate-500">Total annual savings</p>
                <p className="text-lg font-semibold">${annualSavings.toFixed(2)}</p>
              </div>
            </div>
          </section>

          <section className="panel panel--surface">
            <div className="panel__inner">
              <p className="panel__kicker">Actions</p>
              <div className="mt-3 flex flex-col gap-3">
                <button className="btn btn--primary" onClick={() => navigator.clipboard?.writeText(JSON.stringify(results))}>
                  Copy JSON
                </button>
                <a className="btn btn--secondary" href="#" onClick={(e) => e.preventDefault()}>
                  Export CSV
                </a>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
