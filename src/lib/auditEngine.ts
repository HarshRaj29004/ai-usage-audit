import { ALL_SUPPORTED_TOOLS, AuditFormInputState, PlanTier, SupportedTool, ToolSpendInput } from "../types/audit";

type CursorMetadata = {
  individualTier?: string;
  individualTierPrice?: number;
  teamSeatPrice?: number;
  enterpriseMonthlyPrice?: number;
};

type Breakdown = {
  toolId: SupportedTool;
  currentSpend: number;
  recommendedSpend: number;
  savings: number;
  reasoning: string;
};

type AuditCardStub = {
  toolId: SupportedTool;
  active: boolean;
  currentSpend: number;
  recommendedSpend: number;
  savings: number;
  reasoning: string;
};

export interface AuditResultsPayload {
  breakdown: Breakdown[];
  cards: AuditCardStub[];
  totalMonthlySavings: number;
  totalAnnualSavings: number;
}

const CHATGPT_TIER_PRICING: Record<string, number> = {
  free: 0,
  go: 4,
  plus: 20,
  pro: 106,
  business: 1800,
  team: 25,
};

const CLAUDE_TIER_PRICING: Record<string, number> = {
  free: 0,
  pro: 17,
  max5x: 100,
  max10x: 200,
  team: 25,
  enterprise: 20,
};

const COPILOT_TIER_PRICING: Record<string, number> = {
  free: 0,
  pro: 10,
  pro_plus: 39,
};

const CURSOR_INDIVIDUAL_PRICING: Record<string, number> = {
  pro: 20,
  pro_plus: 60,
  ultra: 200,
};

const ANTHROPIC_API_RATES = {
  opus_4_7: { input: 5, output: 25, write: 6.25, read: 0.5 },
  sonnet_4_6: { input: 3, output: 15, write: 3.75, read: 0.3 },
  haiku_4_5: { input: 1, output: 5, write: 1.25, read: 0.1 },
} as const;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const normalizeToolId = (tool: ToolSpendInput): SupportedTool =>
  (tool as ToolSpendInput & { toolId?: SupportedTool | string }).toolId &&
  Object.values(SupportedTool).includes((tool as ToolSpendInput & { toolId?: SupportedTool | string }).toolId as SupportedTool)
    ? ((tool as ToolSpendInput & { toolId?: SupportedTool | string }).toolId as SupportedTool)
    : tool.tool;

const getCursorMetadata = (tool: ToolSpendInput): CursorMetadata => {
  const raw = (tool as ToolSpendInput & { cursorMetadata?: unknown }).cursorMetadata;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const metadata = raw as CursorMetadata;
  return {
    individualTier: typeof metadata.individualTier === "string" ? metadata.individualTier : undefined,
    individualTierPrice: isFiniteNumber(metadata.individualTierPrice) ? metadata.individualTierPrice : undefined,
    teamSeatPrice: isFiniteNumber(metadata.teamSeatPrice) ? metadata.teamSeatPrice : undefined,
    enterpriseMonthlyPrice: isFiniteNumber(metadata.enterpriseMonthlyPrice) ? metadata.enterpriseMonthlyPrice : undefined,
  };
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const getPlanVariant = (tool: ToolSpendInput, fallback: string): string =>
  typeof tool.planVariant === "string" && tool.planVariant.length > 0 ? tool.planVariant : fallback;

const calculateAnthropicApiSpend = (tool: ToolSpendInput): number => {
  const variant = getPlanVariant(tool, "opus_4_7");
  const rates = variant === "sonnet_4_6" ? ANTHROPIC_API_RATES.sonnet_4_6 : variant === "haiku_4_5" ? ANTHROPIC_API_RATES.haiku_4_5 : ANTHROPIC_API_RATES.opus_4_7;
  const inputTokens = Math.max(0, Number(tool.usageInputTokens ?? 0));
  const outputTokens = Math.max(0, Number(tool.usageOutputTokens ?? 0));
  const writeTokens = Math.max(0, Number(tool.usagePromptCachingWriteTokens ?? 0));
  const readTokens = Math.max(0, Number(tool.usagePromptCachingReadTokens ?? 0));

  return round2(
    (inputTokens / 1_000_000) * rates.input +
      (outputTokens / 1_000_000) * rates.output +
      (writeTokens / 1_000_000) * rates.write +
      (readTokens / 1_000_000) * rates.read,
  );
};

const calculateCursorSpend = (tool: ToolSpendInput): number => {
  const metadata = getCursorMetadata(tool);
  const variant = metadata.individualTier ?? getPlanVariant(tool, "pro");

  if (tool.plan === PlanTier.Hobby) {
    return 0;
  }

  if (tool.plan === PlanTier.Enterprise) {
    return round2(metadata.enterpriseMonthlyPrice ?? tool.monthlySpend ?? 0);
  }

  if (tool.plan === PlanTier.Team) {
    const teamSeatPrice = metadata.teamSeatPrice ?? 40;
    return round2(teamSeatPrice * Math.max(1, Number(tool.seats ?? 0)));
  }

  const tierPrice = metadata.individualTierPrice ?? CURSOR_INDIVIDUAL_PRICING[variant] ?? CURSOR_INDIVIDUAL_PRICING.pro;
  return round2(tierPrice);
};

const calculateCopilotSpend = (tool: ToolSpendInput): number => {
  const variant = getPlanVariant(tool, "free");
  const price = COPILOT_TIER_PRICING[variant] ?? COPILOT_TIER_PRICING.free;
  const seats = variant === "free" ? 0 : Math.max(1, Number(tool.seats ?? 0));
  return round2(price * seats);
};

const calculateClaudeSpend = (tool: ToolSpendInput): number => {
  const variant = getPlanVariant(tool, "free");
  const price = CLAUDE_TIER_PRICING[variant] ?? CLAUDE_TIER_PRICING.free;

  if (variant === "team" || variant === "enterprise" || tool.plan === PlanTier.Team || tool.plan === PlanTier.Enterprise) {
    return round2(price * Math.max(1, Number(tool.seats ?? 0)));
  }

  return round2(price);
};

const calculateChatGPTSpend = (tool: ToolSpendInput): number => {
  const variant = getPlanVariant(tool, "free");

  if (variant === "enterprise" || tool.plan === PlanTier.Enterprise) {
    return round2(tool.monthlySpend ?? 0);
  }

  if (variant === "business" || tool.plan === PlanTier.Business) {
    return round2(1800 * Math.max(1, Number(tool.seats ?? 0)));
  }

  if (variant === "team" || tool.plan === PlanTier.Team) {
    return round2((CHATGPT_TIER_PRICING.team ?? 25) * Math.max(1, Number(tool.seats ?? 0)));
  }

  return round2(CHATGPT_TIER_PRICING[variant] ?? CHATGPT_TIER_PRICING.free);
};

const calculateKnownCurrentSpend = (tool: ToolSpendInput): number => {
  switch (normalizeToolId(tool)) {
    case SupportedTool.Cursor:
      return calculateCursorSpend(tool);
    case SupportedTool.GitHubCopilot:
      return calculateCopilotSpend(tool);
    case SupportedTool.Claude:
      return calculateClaudeSpend(tool);
    case SupportedTool.ChatGPT:
      return calculateChatGPTSpend(tool);
    case SupportedTool.AnthropicApi:
    case SupportedTool.OpenAiApi:
      return calculateAnthropicApiSpend(tool);
    default:
      return round2(Math.max(0, Number(tool.monthlySpend ?? 0)));
  }
};

const fallbackForTool = (toolId: SupportedTool): string => {
  switch (toolId) {
    case SupportedTool.Cursor:
      return "pro";
    case SupportedTool.GitHubCopilot:
      return "pro";
    case SupportedTool.Claude:
      return "pro";
    case SupportedTool.ChatGPT:
      return "plus";
    default:
      return "pro";
  }
};

const fallbackSpendForTool = (tool: ToolSpendInput, seats: number): number => {
  switch (normalizeToolId(tool)) {
    case SupportedTool.Cursor:
      return round2(CURSOR_INDIVIDUAL_PRICING[fallbackForTool(SupportedTool.Cursor)] ?? CURSOR_INDIVIDUAL_PRICING.pro);
    case SupportedTool.GitHubCopilot:
      return round2(COPILOT_TIER_PRICING.pro * Math.max(1, seats));
    case SupportedTool.Claude:
      return round2(CLAUDE_TIER_PRICING[fallbackForTool(SupportedTool.Claude)] ?? CLAUDE_TIER_PRICING.pro);
    case SupportedTool.ChatGPT:
      return round2(CHATGPT_TIER_PRICING[fallbackForTool(SupportedTool.ChatGPT)] ?? CHATGPT_TIER_PRICING.plus);
    default:
      return round2(Math.max(0, Number(tool.monthlySpend ?? 0)));
  }
};

const appendReason = (existing: string, addition: string): string => (existing ? `${existing}; ${addition}` : addition);

const buildBreakdownEntry = (tool: ToolSpendInput): Breakdown => {
  const currentSpend = calculateKnownCurrentSpend(tool);
  return {
    toolId: normalizeToolId(tool),
    currentSpend,
    recommendedSpend: currentSpend,
    savings: 0,
    reasoning: "",
  };
};

const applyFallbackRecommendation = (tool: ToolSpendInput, entry: Breakdown): Breakdown => {
  const seats = Math.max(0, Number(tool.seats ?? 0));
  const plan = String(tool.plan ?? "");

  if ((plan === "business" || plan === "team" || plan === "enterprise") && seats <= 2) {
    const fallbackTier = fallbackForTool(entry.toolId);
    const fallbackPrice = fallbackSpendForTool(tool, seats);

    if (fallbackPrice < entry.recommendedSpend) {
      return {
        ...entry,
        recommendedSpend: fallbackPrice,
        reasoning: `Overkill: ${seats} seat(s) on ${plan} tier — recommend ${fallbackTier}`,
      };
    }
  }

  return entry;
};

const buildToolCard = (toolId: SupportedTool, match?: Breakdown): AuditCardStub => {
  if (!match) {
    return {
      toolId,
      active: false,
      currentSpend: 0,
      recommendedSpend: 0,
      savings: 0,
      reasoning: "",
    };
  }

  return {
    toolId,
    active: true,
    currentSpend: match.currentSpend,
    recommendedSpend: match.recommendedSpend,
    savings: match.savings,
    reasoning: match.reasoning,
  };
};

export function calculateAudit(state: AuditFormInputState): AuditResultsPayload {
  const tools = state.tools ?? [];
  const breakdown = tools.map((tool) => buildBreakdownEntry(tool));

  breakdown.forEach((entry, index) => {
    const tool = tools[index];
    const normalized = applyFallbackRecommendation(tool, entry);
    breakdown[index] = normalized;
  });

  const cursorIndex = tools.findIndex((tool) => normalizeToolId(tool) === SupportedTool.Cursor);
  const copilotIndex = tools.findIndex((tool) => normalizeToolId(tool) === SupportedTool.GitHubCopilot);

  if (state.primaryUseCase === "coding" && cursorIndex >= 0 && copilotIndex >= 0) {
    const cursor = tools[cursorIndex];
    const copilot = tools[copilotIndex];
    const combinedSeats = Math.max(Number(cursor.seats ?? 0), Number(copilot.seats ?? 0));
    const cursorPro = CURSOR_INDIVIDUAL_PRICING.pro;
    const copilotPro = COPILOT_TIER_PRICING.pro;
    const costIfCursor = round2(combinedSeats * cursorPro);
    const costIfCopilot = round2(Math.max(0, Number(copilot.seats ?? 0)) * copilotPro);

    if (costIfCursor < costIfCopilot) {
      breakdown[cursorIndex].recommendedSpend = Math.min(breakdown[cursorIndex].recommendedSpend, costIfCursor);
      breakdown[copilotIndex].recommendedSpend = 0;
      breakdown[copilotIndex].reasoning = `Redundant for coding: consolidate to Cursor Pro for ${combinedSeats} seats`;
      breakdown[cursorIndex].reasoning = `Consolidation: cost-optimal choice for coding consolidation`;
    } else {
      breakdown[copilotIndex].recommendedSpend = Math.min(breakdown[copilotIndex].recommendedSpend, costIfCopilot);
      breakdown[cursorIndex].recommendedSpend = 0;
      breakdown[cursorIndex].reasoning = `Redundant for coding: consolidate to Copilot Pro for ${combinedSeats} seats`;
      breakdown[copilotIndex].reasoning = `Consolidation: cost-optimal choice for coding consolidation`;
    }
  }

  const claudeIndex = tools.findIndex((tool) => normalizeToolId(tool) === SupportedTool.Claude);
  if (claudeIndex >= 0) {
    const claudeSpend = calculateClaudeSpend(tools[claudeIndex]);
    breakdown[claudeIndex].recommendedSpend = Math.min(breakdown[claudeIndex].recommendedSpend, claudeSpend);
    if (breakdown[claudeIndex].reasoning === "") {
      breakdown[claudeIndex].reasoning = "Claude tier pricing applied from the selected configuration.";
    }
  }

  const anthropicApiIndex = tools.findIndex((tool) => normalizeToolId(tool) === SupportedTool.AnthropicApi);
  if (anthropicApiIndex >= 0) {
    const apiSpend = calculateAnthropicApiSpend(tools[anthropicApiIndex]);
    breakdown[anthropicApiIndex].recommendedSpend = Math.min(breakdown[anthropicApiIndex].recommendedSpend, apiSpend);
    if (breakdown[anthropicApiIndex].reasoning === "") {
      breakdown[anthropicApiIndex].reasoning = "Anthropic API spend is calculated from the selected model's token usage rates.";
    }
  }

  breakdown.forEach((entry) => {
    if (entry.currentSpend > 200) {
      const discounted = round2(entry.currentSpend * 0.7);
      if (discounted < entry.recommendedSpend) {
        entry.recommendedSpend = discounted;
        entry.reasoning = appendReason(entry.reasoning, "Potential 30% Credex credit baseline applied");
      }
    }
  });

  for (const entry of breakdown) {
    entry.recommendedSpend = round2(Math.max(0, entry.recommendedSpend));
    entry.savings = round2(entry.currentSpend - entry.recommendedSpend);
  }

  const totalMonthlySavings = round2(breakdown.reduce((sum, entry) => sum + Math.max(0, entry.savings), 0));
  const totalAnnualSavings = round2(totalMonthlySavings * 12);
  const cards = ALL_SUPPORTED_TOOLS.map((toolId) => buildToolCard(toolId, breakdown.find((entry) => entry.toolId === toolId)));

  return {
    breakdown,
    cards,
    totalMonthlySavings,
    totalAnnualSavings,
  };
}
