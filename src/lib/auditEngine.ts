import { AuditFormInputState, PlanTier, SupportedTool, ToolSpendInput, UseCase } from "../types/audit";

type UsageBand = "light" | "standard" | "heavy";

type RuntimeCursorMetadata = {
  category?: string;
  subPlan?: string;
  individualTier?: string;
  individualTierPrice?: number;
  teamSeatPrice?: number;
  enterpriseMonthlyPrice?: number;
};

type RuntimeApiMetadata = {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  promptCachingWriteTokens?: number;
  promptCachingReadTokens?: number;
};

type RuntimeToolSpendInput = ToolSpendInput & {
  toolId?: SupportedTool | string;
  planTierId?: string;
  billingCycle?: string;
  customSpend?: number;
  cursorMetadata?: RuntimeCursorMetadata;
  apiMetadata?: RuntimeApiMetadata;
  activityLevel?: string;
  repoScale?: string;
};

type RuntimeAuditFormInput = AuditFormInputState & {
  activityLevel?: string;
  repoScale?: string;
};

export interface AuditBreakdownItem {
  toolId: SupportedTool;
  currentSpend: number;
  recommendedSpend: number;
  savings: number;
  reasoning: string;
}

export interface AuditResultsPayload {
  breakdown: AuditBreakdownItem[];
  totalMonthlySavings: number;
  totalAnnualSavings: number;
}

const CURSOR_INDIVIDUAL_PRICING: Record<string, number> = {
  pro: 20,
  pro_plus: 60,
  ultra: 200,
};

const COPILOT_TIER_PRICING: Record<string, number> = {
  free: 0,
  pro: 10,
  pro_plus: 39,
};

const CLAUDE_TIER_PRICING: Record<string, number> = {
  free: 0,
  pro: 17,
  max5x: 100,
  max10x: 200,
  team: 25,
};

const CHATGPT_TIER_PRICING: Record<string, number> = {
  free: 0,
  go: 4,
  plus: 20,
  pro: 106,
  business: 1800,
};

const ANTHROPIC_API_RATES = {
  opus_4_7: { input: 5, output: 25, write: 6.25, read: 0.5 },
  sonnet_4_6: { input: 3, output: 15, write: 3.75, read: 0.3 },
  haiku_4_5: { input: 1, output: 5, write: 1.25, read: 0.1 },
} as const;

const REQUESTS_PER_USER: Record<UsageBand, number> = {
  light: 330,
  standard: 1100,
  heavy: 2640,
};

const YEARLY_MONTHLY_MULTIPLIER = 0.8;
const CREDex_ADVISORY_THRESHOLD = 200;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const round2 = (value: number): number => Math.round(value * 100) / 100;

const lower = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");

const toPositiveNumber = (value: unknown, fallback = 0): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
};

const normalizeToolId = (tool: RuntimeToolSpendInput): SupportedTool => {
  const explicit = (tool.toolId ?? tool.tool) as SupportedTool | string | undefined;
  const candidate = lower(explicit);

  switch (candidate) {
    case SupportedTool.Cursor:
      return SupportedTool.Cursor;
    case SupportedTool.GitHubCopilot:
      return SupportedTool.GitHubCopilot;
    case SupportedTool.Claude:
      return SupportedTool.Claude;
    case SupportedTool.ChatGPT:
      return SupportedTool.ChatGPT;
    case SupportedTool.AnthropicApi:
      return SupportedTool.AnthropicApi;
    case SupportedTool.OpenAiApi:
      return SupportedTool.OpenAiApi;
    case SupportedTool.Gemini:
      return SupportedTool.Gemini;
    case SupportedTool.Windsurf:
      return SupportedTool.Windsurf;
    case SupportedTool.V0:
      return SupportedTool.V0;
    default:
      return tool.tool;
  }
};

const getPlanKey = (tool: RuntimeToolSpendInput): string => {
  const planTierId = lower(tool.planTierId);
  if (planTierId) {
    return planTierId;
  }

  const plan = lower(tool.plan);
  if (plan) {
    return plan;
  }

  return lower(tool.planVariant);
};

const getBillingCycleMultiplier = (tool: RuntimeToolSpendInput): number => {
  const cycle = lower(tool.billingCycle);
  return cycle.includes("year") ? YEARLY_MONTHLY_MULTIPLIER : 1;
};

const getTeamSize = (state: RuntimeAuditFormInput): number => Math.max(1, Math.trunc(toPositiveNumber(state.teamSize, 1)));

const getSeatCount = (tool: RuntimeToolSpendInput): number => Math.max(1, Math.trunc(toPositiveNumber(tool.seats, 1)));

const getCursorMetadata = (tool: RuntimeToolSpendInput): RuntimeCursorMetadata => {
  const raw = tool.cursorMetadata;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return {
    category: typeof raw.category === "string" ? raw.category : undefined,
    subPlan: typeof raw.subPlan === "string" ? raw.subPlan : undefined,
    individualTier: typeof raw.individualTier === "string" ? raw.individualTier : undefined,
    individualTierPrice: isFiniteNumber(raw.individualTierPrice) ? raw.individualTierPrice : undefined,
    teamSeatPrice: isFiniteNumber(raw.teamSeatPrice) ? raw.teamSeatPrice : undefined,
    enterpriseMonthlyPrice: isFiniteNumber(raw.enterpriseMonthlyPrice) ? raw.enterpriseMonthlyPrice : undefined,
  };
};

const getApiMetadata = (tool: RuntimeToolSpendInput): RuntimeApiMetadata => {
  const raw = tool.apiMetadata;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return {
    model: typeof raw.model === "string" ? raw.model : undefined,
    inputTokens: isFiniteNumber(raw.inputTokens) ? raw.inputTokens : undefined,
    outputTokens: isFiniteNumber(raw.outputTokens) ? raw.outputTokens : undefined,
    promptCachingWriteTokens: isFiniteNumber(raw.promptCachingWriteTokens) ? raw.promptCachingWriteTokens : undefined,
    promptCachingReadTokens: isFiniteNumber(raw.promptCachingReadTokens) ? raw.promptCachingReadTokens : undefined,
  };
};

const resolveActivityLevel = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput): UsageBand => {
  const explicit = lower(state.activityLevel ?? tool.activityLevel);
  if (explicit === "light" || explicit === "standard" || explicit === "heavy") {
    return explicit;
  }

  const repoScale = lower(state.repoScale ?? tool.repoScale);
  if (repoScale.includes("small")) {
    return "light";
  }

  if (repoScale.includes("large")) {
    return "heavy";
  }

  const toolKey = normalizeToolId(tool);
  const planKey = getPlanKey(tool);

  if (toolKey === SupportedTool.Cursor) {
    if (planKey === "pro") {
      return "light";
    }

    if (planKey === "pro_plus") {
      return "standard";
    }

    if (planKey === "ultra") {
      return "heavy";
    }

    return lower(getCursorMetadata(tool).subPlan) === "ultra" ? "heavy" : "standard";
  }

  if (toolKey === SupportedTool.GitHubCopilot) {
    return planKey === "pro_plus" ? "standard" : "light";
  }

  if (toolKey === SupportedTool.Claude) {
    if (planKey === "max10x") {
      return "heavy";
    }

    if (planKey === "max5x") {
      return "standard";
    }

    return "light";
  }

  if (toolKey === SupportedTool.ChatGPT) {
    if (planKey === "business" || planKey === "pro") {
      return "heavy";
    }

    if (planKey === "plus") {
      return "standard";
    }

    return "light";
  }

  return "standard";
};

const resolveRequestsPerUser = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput): number => REQUESTS_PER_USER[resolveActivityLevel(state, tool)];

const applyCycleMultiplier = (amount: number, tool: RuntimeToolSpendInput): number => round2(amount * getBillingCycleMultiplier(tool));

const getExplicitSpend = (tool: RuntimeToolSpendInput): number => round2(toPositiveNumber(tool.customSpend ?? tool.monthlySpend, 0));

const computeApiSpend = (tool: RuntimeToolSpendInput): number => {
  const metadata = getApiMetadata(tool);
  const modelKey = lower(metadata.model ?? tool.planVariant ?? "opus_4_7");
  const rates = modelKey === "sonnet_4_6" ? ANTHROPIC_API_RATES.sonnet_4_6 : modelKey === "haiku_4_5" ? ANTHROPIC_API_RATES.haiku_4_5 : ANTHROPIC_API_RATES.opus_4_7;
  const inputTokens = toPositiveNumber(metadata.inputTokens ?? tool.usageInputTokens, 0);
  const outputTokens = toPositiveNumber(metadata.outputTokens ?? tool.usageOutputTokens, 0);
  const writeTokens = toPositiveNumber(metadata.promptCachingWriteTokens ?? tool.usagePromptCachingWriteTokens, 0);
  const readTokens = toPositiveNumber(metadata.promptCachingReadTokens ?? tool.usagePromptCachingReadTokens, 0);

  return round2(
    (inputTokens / 1_000_000) * rates.input +
      (outputTokens / 1_000_000) * rates.output +
      (writeTokens / 1_000_000) * rates.write +
      (readTokens / 1_000_000) * rates.read,
  );
};

const computeCursorCurrentSpend = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput): number => {
  const planKey = getPlanKey(tool);
  const metadata = getCursorMetadata(tool);

  if (planKey === "enterprise" || lower(tool.plan) === lower(PlanTier.Enterprise)) {
    return getExplicitSpend(tool);
  }

  if (planKey === "team" || lower(metadata.category) === "team") {
    return round2((metadata.teamSeatPrice ?? 40) * getTeamSize(state) * getBillingCycleMultiplier(tool));
  }

  const tier = lower(metadata.individualTier ?? tool.planVariant ?? planKey) || "pro";
  const price = metadata.individualTierPrice ?? CURSOR_INDIVIDUAL_PRICING[tier] ?? CURSOR_INDIVIDUAL_PRICING.pro;
  return round2(price * getSeatCount(tool) * getBillingCycleMultiplier(tool));
};

const computeCursorRecommendation = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput, currentSpend: number): { recommendedSpend: number; reasoning: string } => {
  const planKey = getPlanKey(tool);
  const metadata = getCursorMetadata(tool);
  const requestsPerUser = resolveRequestsPerUser(state, tool);
  const teamRequests = requestsPerUser * getTeamSize(state);
  const multiplier = getBillingCycleMultiplier(tool);
  const multiplierSeats = lower(metadata.category) === "team" || planKey === "team" ? getTeamSize(state) : getSeatCount(tool);

  if (planKey === "enterprise" || lower(tool.plan) === lower(PlanTier.Enterprise)) {
    const advisory = currentSpend > CREDex_ADVISORY_THRESHOLD ? " Enterprise spend above $200/mo triggers a 30% Credex infrastructure credit offloading advisory." : "";
    return {
      recommendedSpend: currentSpend,
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Enterprise pricing stays anchored to the explicit spend input.${advisory}`,
    };
  }

  const candidateTier = requestsPerUser <= REQUESTS_PER_USER.light ? "Pro" : requestsPerUser <= REQUESTS_PER_USER.standard ? "Pro+" : "Ultra";
  const candidatePrice = requestsPerUser <= REQUESTS_PER_USER.light ? CURSOR_INDIVIDUAL_PRICING.pro : requestsPerUser <= REQUESTS_PER_USER.standard ? CURSOR_INDIVIDUAL_PRICING.pro_plus : CURSOR_INDIVIDUAL_PRICING.ultra;
  const candidateSpend = round2(candidatePrice * multiplierSeats * multiplier);
  const currentTier = lower(metadata.individualTier ?? tool.planVariant ?? planKey) || "pro";

  if (requestsPerUser > REQUESTS_PER_USER.standard && currentTier === "pro") {
    return {
      recommendedSpend: candidateSpend,
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Cursor Pro is likely throttling at that footprint, so ${candidateTier} is the safer capacity match to preserve engineering velocity.`,
    };
  }

  if (requestsPerUser <= REQUESTS_PER_USER.light && (planKey === "team" || currentTier === "ultra")) {
    return {
      recommendedSpend: candidateSpend,
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. ${currentTier === "ultra" ? "Ultra" : "Team"} is oversized for that workload, so ${candidateTier} is the more efficient plan match.`,
    };
  }

  if (requestsPerUser > REQUESTS_PER_USER.light && requestsPerUser <= REQUESTS_PER_USER.standard && currentTier === "pro") {
    return {
      recommendedSpend: round2(CURSOR_INDIVIDUAL_PRICING.pro_plus * multiplierSeats * multiplier),
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Cursor Pro+ is the closest fit for that workload band and remains cost controlled.`,
    };
  }

  if (requestsPerUser <= REQUESTS_PER_USER.light && currentTier === "pro_plus") {
    return {
      recommendedSpend: round2(CURSOR_INDIVIDUAL_PRICING.pro * multiplierSeats * multiplier),
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Cursor Pro covers that footprint without paying for unused headroom.`,
    };
  }

  return {
    recommendedSpend: currentSpend,
    reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. The selected Cursor tier already matches that workload band.`,
  };
};

const computeCopilotCurrentSpend = (tool: RuntimeToolSpendInput): number => {
  const planKey = getPlanKey(tool);
  if (planKey === "enterprise" || lower(tool.plan) === lower(PlanTier.Enterprise)) {
    return getExplicitSpend(tool);
  }

  const price = COPILOT_TIER_PRICING[planKey] ?? COPILOT_TIER_PRICING.free;
  return round2(price * getSeatCount(tool) * getBillingCycleMultiplier(tool));
};

const warrantsAdvancedCompliance = (primaryUseCase: AuditFormInputState["primaryUseCase"]): boolean => primaryUseCase === UseCase.Data || primaryUseCase === UseCase.Research;

const computeCopilotRecommendation = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput, currentSpend: number): { recommendedSpend: number; reasoning: string } => {
  const planKey = getPlanKey(tool);
  const requestsPerUser = resolveRequestsPerUser(state, tool);
  const teamRequests = requestsPerUser * getTeamSize(state);
  const multiplier = getBillingCycleMultiplier(tool);
  const seatCount = getSeatCount(tool);

  if (planKey === "enterprise" || lower(tool.plan) === lower(PlanTier.Enterprise)) {
    const advisory = currentSpend > CREDex_ADVISORY_THRESHOLD ? " Enterprise spend above $200/mo triggers a 30% Credex infrastructure credit offloading advisory." : "";
    return {
      recommendedSpend: currentSpend,
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Enterprise pricing remains tied to the explicit spend input.${advisory}`,
    };
  }

  if (planKey === "pro_plus" && requestsPerUser === REQUESTS_PER_USER.light && !warrantsAdvancedCompliance(state.primaryUseCase)) {
    return {
      recommendedSpend: round2(COPILOT_TIER_PRICING.pro * seatCount * multiplier),
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Light usage does not justify Pro+ feature gating here, so Pro is the lower-cost fit.`,
    };
  }

  return {
    recommendedSpend: currentSpend,
    reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. The selected Copilot tier already matches the current workload band.`,
  };
};

const computeClaudeCurrentSpend = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput): number => {
  const planKey = getPlanKey(tool);
  if (planKey === "enterprise" || lower(tool.plan) === lower(PlanTier.Enterprise)) {
    return getExplicitSpend(tool);
  }

  const price = CLAUDE_TIER_PRICING[planKey] ?? CLAUDE_TIER_PRICING.free;
  const seatMultiplier = planKey === "team" ? getTeamSize(state) : getSeatCount(tool);
  return round2(price * seatMultiplier * getBillingCycleMultiplier(tool));
};

const computeClaudeRecommendation = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput, currentSpend: number): { recommendedSpend: number; reasoning: string } => {
  const planKey = getPlanKey(tool);
  const requestsPerUser = resolveRequestsPerUser(state, tool);
  const teamRequests = requestsPerUser * getTeamSize(state);
  const multiplier = getBillingCycleMultiplier(tool);
  const seatCount = getSeatCount(tool);

  if (planKey === "enterprise" || lower(tool.plan) === lower(PlanTier.Enterprise)) {
    const advisory = currentSpend > CREDex_ADVISORY_THRESHOLD ? " Enterprise spend above $200/mo triggers a 30% Credex infrastructure credit offloading advisory." : "";
    return {
      recommendedSpend: currentSpend,
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Enterprise pricing stays fixed to the explicit spend input.${advisory}`,
    };
  }

  if ((planKey === "max5x" || planKey === "max10x") && requestsPerUser <= REQUESTS_PER_USER.standard) {
    return {
      recommendedSpend: round2(CLAUDE_TIER_PRICING.pro * seatCount * multiplier),
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Max tiers are oversized for light-to-standard usage, so Pro is the more efficient match.`,
    };
  }

  if (planKey === "team" && getTeamSize(state) === 1) {
    return {
      recommendedSpend: round2(CLAUDE_TIER_PRICING.pro * multiplier),
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. A team plan for a single user is not economical, so the individual Pro tier is the correct fallback.`,
    };
  }

  if (requestsPerUser > REQUESTS_PER_USER.standard && planKey === "pro") {
    return {
      recommendedSpend: round2(CLAUDE_TIER_PRICING.max5x * seatCount * multiplier),
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Pro is too thin for that footprint, so Max5x is the better capacity match.`,
    };
  }

  return {
    recommendedSpend: currentSpend,
    reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. The selected Claude tier already fits the current workload band.`,
  };
};

const computeChatGPTCurrentSpend = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput): number => {
  const planKey = getPlanKey(tool);
  if (planKey === "enterprise" || lower(tool.plan) === lower(PlanTier.Enterprise)) {
    return getExplicitSpend(tool);
  }

  const price = CHATGPT_TIER_PRICING[planKey] ?? CHATGPT_TIER_PRICING.free;
  const multiplier = planKey === "business" ? getTeamSize(state) : getSeatCount(tool);
  return round2(price * multiplier * getBillingCycleMultiplier(tool));
};

const computeChatGPTRecommendation = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput, currentSpend: number): { recommendedSpend: number; reasoning: string } => {
  const planKey = getPlanKey(tool);
  const requestsPerUser = resolveRequestsPerUser(state, tool);
  const teamRequests = requestsPerUser * getTeamSize(state);
  const multiplier = getBillingCycleMultiplier(tool);
  const seatCount = Math.max(1, getSeatCount(tool), getTeamSize(state));

  if (planKey === "enterprise" || lower(tool.plan) === lower(PlanTier.Enterprise)) {
    const advisory = currentSpend > CREDex_ADVISORY_THRESHOLD ? " Enterprise spend above $200/mo triggers a 30% Credex infrastructure credit offloading advisory." : "";
    return {
      recommendedSpend: currentSpend,
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Enterprise pricing stays fixed to the explicit spend input.${advisory}`,
    };
  }

  if (planKey === "business" && getTeamSize(state) < 10) {
    const plusPath = round2(CHATGPT_TIER_PRICING.plus * seatCount * multiplier);
    const proPath = round2(CHATGPT_TIER_PRICING.pro * seatCount * multiplier);
    const recommendedSpend = Math.min(plusPath, proPath);
    const preferredTier = recommendedSpend === plusPath ? "Plus" : "Pro";

    return {
      recommendedSpend,
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. A small team does not justify the pooled Business pack, and ${preferredTier} seats are the cheaper deterministic alternative.`,
    };
  }

  return {
    recommendedSpend: currentSpend,
    reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. The selected ChatGPT tier already matches the current cost structure.`,
  };
};

const computeGenericCurrentSpend = (tool: RuntimeToolSpendInput): number => {
  const toolId = normalizeToolId(tool);
  if (toolId === SupportedTool.AnthropicApi || toolId === SupportedTool.OpenAiApi) {
    const apiSpend = computeApiSpend(tool);
    return apiSpend > 0 ? apiSpend : getExplicitSpend(tool);
  }

  return getExplicitSpend(tool);
};

const computeGenericRecommendation = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput, currentSpend: number): { recommendedSpend: number; reasoning: string } => {
  const requestsPerUser = resolveRequestsPerUser(state, tool);
  const teamRequests = requestsPerUser * getTeamSize(state);
  const planKey = getPlanKey(tool);

  if (planKey === "enterprise" || lower(tool.plan) === lower(PlanTier.Enterprise)) {
    const advisory = currentSpend > CREDex_ADVISORY_THRESHOLD ? " Enterprise spend above $200/mo triggers a 30% Credex infrastructure credit offloading advisory." : "";
    return {
      recommendedSpend: currentSpend,
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. Enterprise pricing stays fixed to the explicit spend input.${advisory}`,
    };
  }

  if (currentSpend > 0) {
    return {
      recommendedSpend: currentSpend,
      reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. No lower-risk pricing matrix is available for this tool, so the explicit spend remains the deterministic baseline.`,
    };
  }

  return {
    recommendedSpend: 0,
    reasoning: `Your team generates about ${requestsPerUser.toLocaleString()} requests/mo per user, or ${teamRequests.toLocaleString()} requests/mo across the team. No spend was supplied for this tool, so the optimized baseline is zero.`,
  };
};

const buildReasonedBreakdownItem = (state: RuntimeAuditFormInput, tool: RuntimeToolSpendInput): AuditBreakdownItem => {
  const toolId = normalizeToolId(tool);

  if (toolId === SupportedTool.Cursor) {
    const currentSpend = computeCursorCurrentSpend(state, tool);
    const recommendation = computeCursorRecommendation(state, tool, currentSpend);
    return {
      toolId,
      currentSpend: round2(currentSpend),
      recommendedSpend: round2(recommendation.recommendedSpend),
      savings: round2(currentSpend - recommendation.recommendedSpend),
      reasoning: recommendation.reasoning,
    };
  }

  if (toolId === SupportedTool.GitHubCopilot) {
    const currentSpend = computeCopilotCurrentSpend(tool);
    const recommendation = computeCopilotRecommendation(state, tool, currentSpend);
    return {
      toolId,
      currentSpend: round2(currentSpend),
      recommendedSpend: round2(recommendation.recommendedSpend),
      savings: round2(currentSpend - recommendation.recommendedSpend),
      reasoning: recommendation.reasoning,
    };
  }

  if (toolId === SupportedTool.Claude) {
    const currentSpend = computeClaudeCurrentSpend(state, tool);
    const recommendation = computeClaudeRecommendation(state, tool, currentSpend);
    return {
      toolId,
      currentSpend: round2(currentSpend),
      recommendedSpend: round2(recommendation.recommendedSpend),
      savings: round2(currentSpend - recommendation.recommendedSpend),
      reasoning: recommendation.reasoning,
    };
  }

  if (toolId === SupportedTool.ChatGPT) {
    const currentSpend = computeChatGPTCurrentSpend(state, tool);
    const recommendation = computeChatGPTRecommendation(state, tool, currentSpend);
    return {
      toolId,
      currentSpend: round2(currentSpend),
      recommendedSpend: round2(recommendation.recommendedSpend),
      savings: round2(currentSpend - recommendation.recommendedSpend),
      reasoning: recommendation.reasoning,
    };
  }

  const currentSpend = computeGenericCurrentSpend(tool);
  const recommendation = computeGenericRecommendation(state, tool, currentSpend);
  return {
    toolId,
    currentSpend: round2(currentSpend),
    recommendedSpend: round2(recommendation.recommendedSpend),
    savings: round2(currentSpend - recommendation.recommendedSpend),
    reasoning: recommendation.reasoning,
  };
};

export function calculateAudit(state: AuditFormInputState): AuditResultsPayload {
  const runtimeState = state as RuntimeAuditFormInput;
  const tools = Array.isArray(state.tools) ? state.tools : [];
  const breakdown = tools.map((tool) => buildReasonedBreakdownItem(runtimeState, tool as RuntimeToolSpendInput));
  const totalMonthlySavings = round2(breakdown.reduce((sum, entry) => sum + entry.savings, 0));

  return {
    breakdown,
    totalMonthlySavings,
    totalAnnualSavings: round2(totalMonthlySavings * 12),
  };
}
