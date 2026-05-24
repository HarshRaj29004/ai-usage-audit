import { AuditFormInputState, ToolSpendInput } from "../types/audit";

type Breakdown = {
  toolId: string;
  currentSpend: number;
  recommendedSpend: number;
  savings: number;
  reasoning: string;
};

const PRICING_PER_SEAT: Record<string, Record<string, number>> = {
  cursor: { pro: 20, business: 40 },
  github_copilot: { individual: 10, business: 19, enterprise: 39 },
  claude: { pro: 20, team: 30 },
  chatgpt: { plus: 20, team: 25 },
};

function perSeatPrice(toolId: string, tier: string): number | null {
  const tool = PRICING_PER_SEAT[toolId];
  if (!tool) return null;
  return tool[tier] ?? null;
}

export function calculateAudit(state: AuditFormInputState) {
  const tools = state.tools ?? [];
  const breakdown: Breakdown[] = [];

  // base entries
  for (const t of tools) {
    const current = Number(t.monthlySpend ?? 0);
    breakdown.push({
      toolId: String(t.tool),
      currentSpend: round2(current),
      recommendedSpend: round2(current),
      savings: 0,
      reasoning: "",
    });
  }

  // Overkill check per tool
  breakdown.forEach((b, i) => {
    const input = tools[i];
    const seats = Math.max(0, Number(input.seats ?? 0));
    const plan = String(input.plan ?? "");
    if ((plan === "business" || plan === "team" || plan === "enterprise") && seats <= 2) {
      const fallbackTier = fallbackForTool(String(input.tool));
      const fallbackPrice = perSeatPrice(String(input.tool), fallbackTier);
      if (fallbackPrice !== null) {
        const fallbackSpend = round2(fallbackPrice * seats);
        if (fallbackSpend < b.recommendedSpend) {
          b.recommendedSpend = fallbackSpend;
          b.reasoning = `Overkill: ${seats} seat(s) on ${plan} tier — recommend ${fallbackTier} @ $${fallbackPrice}/seat`;
        }
      }
    }
  });

  // Alternative tool check for coding overlap (Cursor + GitHub Copilot)
  const cursorIndex = tools.findIndex((x) => String(x.tool) === "cursor");
  const copilotIndex = tools.findIndex((x) => String(x.tool) === "github_copilot");
  if (state.primaryUseCase === "coding" && cursorIndex >= 0 && copilotIndex >= 0) {
    const cursor = tools[cursorIndex];
    const copilot = tools[copilotIndex];
    const combinedSeats = Math.max(Number(cursor.seats ?? 0), Number(copilot.seats ?? 0));
    const cursorPro = perSeatPrice("cursor", "pro") ?? Infinity;
    const copilotInd = perSeatPrice("github_copilot", "individual") ?? Infinity;
    const costIfCursor = round2(combinedSeats * cursorPro);
    const costIfCopilot = round2(combinedSeats * copilotInd);
    if (costIfCursor < costIfCopilot) {
      // consolidate to Cursor Pro
      breakdown[cursorIndex].recommendedSpend = Math.min(breakdown[cursorIndex].recommendedSpend, costIfCursor);
      breakdown[copilotIndex].recommendedSpend = 0;
      breakdown[copilotIndex].reasoning = `Redundant for coding: consolidate to Cursor Pro for ${combinedSeats} seats`;
      breakdown[cursorIndex].reasoning = `Consolidation: cost-optimal choice for coding consolidation`;
    } else {
      breakdown[copilotIndex].recommendedSpend = Math.min(breakdown[copilotIndex].recommendedSpend, costIfCopilot);
      breakdown[cursorIndex].recommendedSpend = 0;
      breakdown[cursorIndex].reasoning = `Redundant for coding: consolidate to Copilot Individual for ${combinedSeats} seats`;
      breakdown[copilotIndex].reasoning = `Consolidation: cost-optimal choice for coding consolidation`;
    }
  }

  // Retail vs Credit check: apply 30% discount baseline for any tool currentSpend > 200
  breakdown.forEach((b, i) => {
    const input = tools[i];
    const current = b.currentSpend;
    if (current > 200) {
      const discounted = round2(current * 0.7);
      if (discounted < b.recommendedSpend) {
        b.recommendedSpend = discounted;
        b.reasoning = appendReason(b.reasoning, `Potential 30% Credex credit baseline applied`);
      }
    }
  });

  // Finalize savings and rounding
  for (const b of breakdown) {
    b.recommendedSpend = round2(Math.max(0, b.recommendedSpend));
    b.savings = round2(b.currentSpend - b.recommendedSpend);
  }

  const totalMonthlySavings = round2(breakdown.reduce((s, x) => s + Math.max(0, x.savings), 0));
  const totalAnnualSavings = round2(totalMonthlySavings * 12);

  return {
    breakdown,
    totalMonthlySavings,
    totalAnnualSavings,
  };
}

function fallbackForTool(toolId: string) {
  switch (toolId) {
    case "cursor":
      return "pro";
    case "github_copilot":
      return "individual";
    case "claude":
      return "pro";
    case "chatgpt":
      return "plus";
    default:
      return "pro";
  }
}

function appendReason(existing: string, add: string) {
  if (!existing) return add;
  return `${existing}; ${add}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
