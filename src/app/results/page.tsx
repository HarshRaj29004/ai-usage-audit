import React from "react";
import AuditResults from "../../components/AuditResults";

const mock = {
  totalMonthlySavings: 823.45,
  totalMonthlySpend: 2400.0,
  totalAnnualSavings: 9881.4,
  totalAnnualSpend: 28800.0,
  aiSummary:
    "Consolidating model endpoints and rightsizing instance classes can reduce your monthly spend by ~34% while maintaining latency SLOs. Prioritize high-volume tools for immediate savings.",
  tools: [
    {
      tool: "openai-chat",
      label: "OpenAI Chat",
      plan: "gpt-4o-mini",
      currentMonthly: 1200.0,
      recommendedMonthly: 650.0,
      savings: 550.0,
      reason: "Switch to batching and reservoir sampling for long context chatflows; use streaming outputs to reduce token usage.",
    },
    {
      tool: "vertex-text",
      label: "Vertex Text",
      plan: "n1-standard",
      currentMonthly: 800.0,
      recommendedMonthly: 500.0,
      savings: 300.0,
      reason: "Move low-priority inference to spot instances and introduce caching for repeated prompts.",
    },
    {
      tool: "embeddings-svc",
      label: "Embeddings",
      plan: "vector-optimized",
      currentMonthly: 400.0,
      recommendedMonthly: 426.55,
      savings: -26.55,
      reason: "Current usage is efficient; minor increases are recommended for recall improvements.",
    },
  ],
};

export default function Page() {
  return (
    <main className="container py-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold mb-6">Audit Results — Preview</h1>
        <AuditResults results={mock} />
      </div>
    </main>
  );
}
