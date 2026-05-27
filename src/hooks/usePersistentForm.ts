"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_SUPPORTED_TOOLS,
  type AuditFormInputState,
  type AuditFormPatch,
  type ToolSpendInput,
  PlanTier,
  SupportedTool,
  TOOL_PLAN_TIERS,
  UseCase,
} from "../types/audit";

const DEFAULT_STORAGE_KEY = "AI-usage-Audit:form";

const DEFAULT_FORM_STATE: AuditFormInputState = {
  teamSize: 1,
  primaryUseCase: UseCase.Coding,
  activityLevel: "standard",
  tools: [],
  updatedAtIso: new Date().toISOString(),
};

const CHATGPT_TIER_PRICING: Record<string, number> = {
  free: 0,
  go: 4,
  plus: 20,
  pro: 106,
  business: 1800,
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampNonNegative = (value: number): number => Math.max(0, value);

const isSupportedTool = (value: unknown): value is SupportedTool =>
  typeof value === "string" && Object.values(SupportedTool).includes(value as SupportedTool);

const isPlanTier = (value: unknown): value is PlanTier =>
  typeof value === "string" && Object.values(PlanTier).includes(value as PlanTier);

const isUseCase = (value: unknown): value is UseCase =>
  typeof value === "string" && Object.values(UseCase).includes(value as UseCase);

const resolveToolKey = (value: unknown): SupportedTool | null => {
  if (isSupportedTool(value)) {
    return value;
  }

  return null;
};

const defaultSeatsForTool = (tool: SupportedTool, plan: PlanTier): number => {
  if (tool === SupportedTool.GitHubCopilot) {
    return 0;
  }

  if (tool === SupportedTool.AnthropicApi || tool === SupportedTool.OpenAiApi) {
    return 0;
  }

  if (tool === SupportedTool.ChatGPT && plan === PlanTier.Enterprise) {
    return 0;
  }

  return 1;
};

const normalizeToolEntry = (entry: unknown): ToolSpendInput | null => {
  if (!isRecord(entry)) {
    return null;
  }

  const tool = resolveToolKey(entry.tool ?? entry.toolId);
  if (!tool) {
    return null;
  }

  const availablePlans = TOOL_PLAN_TIERS[tool];
  const plan = isPlanTier(entry.plan) && availablePlans.includes(entry.plan) ? entry.plan : availablePlans[0] ?? PlanTier.Pro;
  const seats = isFiniteNumber(entry.seats) ? clampNonNegative(entry.seats) : defaultSeatsForTool(tool, plan);
  const monthlySpend = isFiniteNumber(entry.monthlySpend) ? clampNonNegative(entry.monthlySpend) : 0;

  return {
    tool,
    plan,
    planVariant: typeof entry.planVariant === "string" ? entry.planVariant : undefined,
    seats,
    monthlySpend,
    usageInputTokens: isFiniteNumber(entry.usageInputTokens) ? clampNonNegative(entry.usageInputTokens) : 0,
    usageOutputTokens: isFiniteNumber(entry.usageOutputTokens) ? clampNonNegative(entry.usageOutputTokens) : 0,
    usagePromptCachingWriteTokens: isFiniteNumber(entry.usagePromptCachingWriteTokens)
      ? clampNonNegative(entry.usagePromptCachingWriteTokens)
      : 0,
    usagePromptCachingReadTokens: isFiniteNumber(entry.usagePromptCachingReadTokens)
      ? clampNonNegative(entry.usagePromptCachingReadTokens)
      : 0,
    activityLevel:
      entry.activityLevel === "light" || entry.activityLevel === "standard" || entry.activityLevel === "heavy"
        ? entry.activityLevel
        : undefined,
    repoScale: typeof entry.repoScale === "string" ? entry.repoScale : undefined,
  };
};

const normalizeToolCollection = (incoming: unknown, fallback: ToolSpendInput[]): ToolSpendInput[] => {
  if (!Array.isArray(incoming)) {
    return fallback;
  }

  const nextByTool = new Map<SupportedTool, ToolSpendInput>();

  for (const entry of incoming) {
    const normalized = normalizeToolEntry(entry);
    if (normalized) {
      nextByTool.set(normalized.tool, normalized);
    }
  }

  const orderedTools: ToolSpendInput[] = [];
  for (const tool of ALL_SUPPORTED_TOOLS) {
    const entry = nextByTool.get(tool);
    if (entry) {
      orderedTools.push(entry);
    }
  }

  return orderedTools.length > 0 ? orderedTools : fallback;
};

const sanitizeState = (incoming: unknown, fallback: AuditFormInputState): AuditFormInputState => {
  if (!isRecord(incoming)) {
    return fallback;
  }

  const activityLevel =
    incoming.activityLevel === "light" || incoming.activityLevel === "standard" || incoming.activityLevel === "heavy"
      ? incoming.activityLevel
      : fallback.activityLevel;

  return {
    teamSize: isFiniteNumber(incoming.teamSize) ? Math.max(1, clampNonNegative(incoming.teamSize)) : fallback.teamSize,
    primaryUseCase: isUseCase(incoming.primaryUseCase) ? incoming.primaryUseCase : fallback.primaryUseCase,
    activityLevel,
    repoScale: typeof incoming.repoScale === "string" ? incoming.repoScale : fallback.repoScale,
    tools: normalizeToolCollection(incoming.tools, fallback.tools),
    updatedAtIso: typeof incoming.updatedAtIso === "string" ? incoming.updatedAtIso : new Date().toISOString(),
  };
};

const getPlanVariant = (tool: ToolSpendInput, fallbackVariant: string): string =>
  typeof tool.planVariant === "string" && tool.planVariant.length > 0 ? tool.planVariant : fallbackVariant;

const calculateCursorSpend = (tool: ToolSpendInput): number => {
  const variant = getPlanVariant(tool, "pro");

  if (tool.plan === PlanTier.Hobby) {
    return 0;
  }

  if (tool.plan === PlanTier.Enterprise) {
    return clampNonNegative(tool.monthlySpend);
  }

  if (tool.plan === PlanTier.Team) {
    const teamSeatPrice = 40;
    return clampNonNegative(teamSeatPrice * Math.max(1, tool.seats));
  }

  return clampNonNegative((CURSOR_INDIVIDUAL_PRICING[variant] ?? CURSOR_INDIVIDUAL_PRICING.pro) * 1);
};

const calculateChatGPTSpend = (tool: ToolSpendInput): number => {
  const variant = getPlanVariant(tool, "free");

  if (variant === "enterprise" || tool.plan === PlanTier.Enterprise) {
    return clampNonNegative(tool.monthlySpend);
  }

  if (variant === "business" || tool.plan === PlanTier.Business) {
    return clampNonNegative(1800 * Math.max(1, tool.seats));
  }

  if (tool.plan === PlanTier.Team) {
    return clampNonNegative((CHATGPT_TIER_PRICING.team ?? 25) * Math.max(1, tool.seats));
  }

  return clampNonNegative(CHATGPT_TIER_PRICING[variant] ?? CHATGPT_TIER_PRICING.free);
};

const calculateClaudeSpend = (tool: ToolSpendInput): number => {
  const variant = getPlanVariant(tool, "free");
  const price = CLAUDE_TIER_PRICING[variant] ?? CLAUDE_TIER_PRICING.free;

  if (variant === "team" || variant === "enterprise" || tool.plan === PlanTier.Team || tool.plan === PlanTier.Enterprise) {
    return clampNonNegative(price * Math.max(1, tool.seats));
  }

  return clampNonNegative(price);
};

const calculateCopilotSpend = (tool: ToolSpendInput): number => {
  const variant = getPlanVariant(tool, "free");
  const price = COPILOT_TIER_PRICING[variant] ?? COPILOT_TIER_PRICING.free;

  if (variant === "free") {
    return 0;
  }

  return clampNonNegative(price * Math.max(1, tool.seats));
};

const calculateGenericSpend = (tool: ToolSpendInput): number => clampNonNegative(tool.monthlySpend);

const calculateToolMonthlySpend = (tool: ToolSpendInput): number => {
  switch (tool.tool) {
    case SupportedTool.Cursor:
      return calculateCursorSpend(tool);
    case SupportedTool.GitHubCopilot:
      return calculateCopilotSpend(tool);
    case SupportedTool.Claude:
      return calculateClaudeSpend(tool);
    case SupportedTool.ChatGPT:
      return calculateChatGPTSpend(tool);
    default:
      return calculateGenericSpend(tool);
  }
};

export interface UsePersistentFormResult {
  form: AuditFormInputState;
  setForm: React.Dispatch<React.SetStateAction<AuditFormInputState>>;
  patchForm: (patch: AuditFormPatch) => void;
  upsertTool: (entry: ToolSpendInput | ToolSpendInput[]) => void;
  removeTool: (tool: SupportedTool | SupportedTool[]) => void;
  resetForm: () => void;
  totalMonthlySpend: number;
}

export const usePersistentForm = (
  initialState: Partial<AuditFormInputState> = {},
  storageKey = DEFAULT_STORAGE_KEY,
): UsePersistentFormResult => {
  const resolvedInitialState = useMemo<AuditFormInputState>(
    () => sanitizeState(initialState, DEFAULT_FORM_STATE),
    [initialState],
  );

  const [form, setForm] = useState<AuditFormInputState>(resolvedInitialState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawStored = window.localStorage.getItem(storageKey);
    if (!rawStored) {
      setForm(resolvedInitialState);
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(rawStored) as unknown;
      setForm(sanitizeState(parsed, resolvedInitialState));
    } catch {
      setForm(resolvedInitialState);
    }

    setIsHydrated(true);
  }, [resolvedInitialState, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(form));
  }, [form, isHydrated, storageKey]);

  const patchForm = useCallback((patch: AuditFormPatch) => {
    setForm((prev) =>
      sanitizeState(
        {
          ...prev,
          ...patch,
          updatedAtIso: new Date().toISOString(),
        },
        prev,
      ),
    );
  }, []);

  const upsertTool = useCallback((entry: ToolSpendInput | ToolSpendInput[]) => {
    setForm((prev) => {
      const entries = Array.isArray(entry) ? entry : [entry];
      const nextByTool = new Map<SupportedTool, ToolSpendInput>(prev.tools.map((tool) => [tool.tool, tool]));

      for (const item of entries) {
        const normalized = normalizeToolEntry(item);
        if (normalized) {
          nextByTool.set(normalized.tool, normalized);
        }
      }

      return {
        ...prev,
        tools: ALL_SUPPORTED_TOOLS.flatMap((tool) => {
          const nextTool = nextByTool.get(tool);
          return nextTool ? [nextTool] : [];
        }),
        updatedAtIso: new Date().toISOString(),
      };
    });
  }, []);

  const removeTool = useCallback((toolToRemove: SupportedTool | SupportedTool[]) => {
    setForm((prev) => {
      const removalSet = new Set(Array.isArray(toolToRemove) ? toolToRemove : [toolToRemove]);

      return {
        ...prev,
        tools: prev.tools.filter((tool) => !removalSet.has(tool.tool)),
        updatedAtIso: new Date().toISOString(),
      };
    });
  }, []);

  const resetForm = useCallback(() => {
    setForm({ ...resolvedInitialState, updatedAtIso: new Date().toISOString() });
  }, [resolvedInitialState]);

  const totalMonthlySpend = useMemo(
    () => form.tools.reduce((sum, tool) => sum + calculateToolMonthlySpend(tool), 0),
    [form.tools],
  );

  return {
    form,
    setForm,
    patchForm,
    upsertTool,
    removeTool,
    resetForm,
    totalMonthlySpend,
  };
};
