"use client";

import { useEffect, useMemo, useState } from "react";
import { usePersistentForm } from "../hooks/usePersistentForm";
import {
  ALL_USE_CASES,
  type AuditFormInputState,
  PlanTier,
  type ShareableAuditPayload,
  SupportedTool,
  TOOL_PLAN_TIERS,
  type ToolSpendInput,
  UseCase,
  type UsageBand,
} from "../types/audit";

const SPEND_TOOL_OPTIONS: readonly SupportedTool[] = [
  SupportedTool.Cursor,
  SupportedTool.GitHubCopilot,
  SupportedTool.Claude,
  SupportedTool.ChatGPT,
  SupportedTool.AnthropicApi,
  SupportedTool.OpenAiApi,
  SupportedTool.Gemini,
  SupportedTool.V0,
] as const;

const TOOL_LABELS: Record<SupportedTool, string> = {
  [SupportedTool.Cursor]: "Cursor",
  [SupportedTool.GitHubCopilot]: "GitHub Copilot",
  [SupportedTool.Claude]: "Claude",
  [SupportedTool.ChatGPT]: "ChatGPT",
  [SupportedTool.AnthropicApi]: "Anthropic API",
  [SupportedTool.OpenAiApi]: "OpenAI API",
  [SupportedTool.Gemini]: "Gemini",
  [SupportedTool.Windsurf]: "Windsurf",
  [SupportedTool.V0]: "v0",
};

const PLAN_LABELS: Record<PlanTier, string> = {
  [PlanTier.Hobby]: "Hobby",
  [PlanTier.Pro]: "Pro",
  [PlanTier.Business]: "Business",
  [PlanTier.Enterprise]: "Enterprise",
  [PlanTier.Team]: "Team",
  [PlanTier.Individual]: "Individual",
  [PlanTier.Max]: "Max",
  [PlanTier.Ultra]: "Ultra",
  [PlanTier.ApiDirect]: "API Direct",
};

type OptionChoice = {
  id: string;
  label: string;
  price?: number;
  priceLabel?: string;
  needsTeamSize?: boolean;
};

const renderOptionLabel = (option: OptionChoice): string => {
  if (option.priceLabel) {
    return `${option.label}${option.priceLabel}`;
  }

  if (typeof option.price === "number") {
    return option.price > 0 ? `${option.label} - $${option.price}/month` : option.label;
  }

  return option.label;
};

const COPILOT_TIER_OPTIONS: readonly OptionChoice[] = [
  { id: "free", label: "Free", price: 0, priceLabel: " - $0/user/month" },
  { id: "pro", label: "Pro", price: 10, priceLabel: " - $10/user/month" },
  { id: "pro_plus", label: "Pro+", price: 39, priceLabel: " - $39/user/month" },
] as const;

const CHATGPT_TIER_OPTIONS: readonly OptionChoice[] = [
  { id: "free", label: "Free", price: 0, priceLabel: " - $0/month", needsTeamSize: false },
  { id: "go", label: "Go", price: 4, priceLabel: " - $4/month", needsTeamSize: false },
  { id: "plus", label: "Plus", price: 20, priceLabel: " - $20/month", needsTeamSize: false },
  { id: "pro", label: "Pro", price: 106, priceLabel: " - $106/month", needsTeamSize: false },
  { id: "business", label: "Business", price: 1800, priceLabel: " - $1,800/user/month", needsTeamSize: true },
  { id: "enterprise", label: "Enterprise", priceLabel: " - custom monthly price", needsTeamSize: false },
] as const;

const CLAUDE_TIER_OPTIONS: readonly OptionChoice[] = [
  { id: "free", label: "Free", price: 0, priceLabel: " - $0/month", needsTeamSize: false },
  { id: "pro", label: "Pro", price: 17, priceLabel: " - $17/month", needsTeamSize: false },
  { id: "max5x", label: "Max5x", price: 100, priceLabel: " - $100/month", needsTeamSize: false },
  { id: "max10x", label: "Max10x", price: 200, priceLabel: " - $200/month", needsTeamSize: false },
  { id: "team", label: "Team", price: 25, priceLabel: " - $25/user/month", needsTeamSize: true },
  { id: "enterprise", label: "Enterprise", price: 20, priceLabel: " - $20/user/month", needsTeamSize: true },
] as const;

const ANTHROPIC_MODEL_OPTIONS: readonly OptionChoice[] = [
  { id: "opus_4_7", label: "Opus 4.7", priceLabel: " - input/output priced" },
  { id: "sonnet_4_6", label: "Sonnet 4.6", priceLabel: " - input/output priced" },
  { id: "haiku_4_5", label: "Haiku 4.5", priceLabel: " - input/output priced" },
] as const;

const CURSOR_INDIVIDUAL_OPTIONS: readonly OptionChoice[] = [
  { id: "pro", label: "Pro", price: 20, priceLabel: " - $20/seat" },
  { id: "pro_plus", label: "Pro+", price: 60, priceLabel: " - $60/seat" },
  { id: "ultra", label: "Ultra", price: 200, priceLabel: " - $200/seat" },
] as const;

const USE_CASE_LABELS: Record<UseCase, string> = {
  [UseCase.Coding]: "Coding",
  [UseCase.Writing]: "Writing",
  [UseCase.Data]: "Data",
  [UseCase.Research]: "Research",
  [UseCase.Mixed]: "Mixed",
};

const ACTIVITY_LEVEL_LABELS: Record<UsageBand, string> = {
  light: "Light / mild",
  standard: "Standard",
  heavy: "Heavy",
};

type DraftToolSpendInput = Omit<ToolSpendInput, "tool"> & {
  tool: SupportedTool | "";
};

const EMPTY_TOOL_ROW: DraftToolSpendInput = {
  tool: "",
  plan: PlanTier.Pro,
  planVariant: undefined,
  seats: 0,
  monthlySpend: 0,
};

const isBlankToolRow = (tool: ToolSpendInput | DraftToolSpendInput): tool is DraftToolSpendInput =>
  (tool as DraftToolSpendInput).tool === "";

const DEFAULT_FORM_STATE: AuditFormInputState = {
  teamSize: 1,
  primaryUseCase: UseCase.Coding,
  activityLevel: "standard",
  tools: [],
  updatedAtIso: new Date().toISOString(),
};

const clampWholeNumber = (value: number): number => Math.max(0, Math.round(value));

const clampCurrency = (value: number): number => Number(Math.max(0, value).toFixed(2));

const coerceNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const buildDefaultToolEntry = (tool: SupportedTool): ToolSpendInput => {
  const availablePlans = TOOL_PLAN_TIERS[tool];

  if (tool === SupportedTool.GitHubCopilot) {
    return {
      tool,
      plan: PlanTier.Individual,
      planVariant: "free",
      seats: 0,
      monthlySpend: 0,
    };
  }

  if (tool === SupportedTool.Claude) {
    return {
      tool,
      plan: PlanTier.Individual,
      planVariant: "free",
      seats: 0,
      monthlySpend: 0,
    };
  }

  if (tool === SupportedTool.AnthropicApi) {
    return {
      tool,
      plan: PlanTier.ApiDirect,
      planVariant: "opus_4_7",
      seats: 0,
      monthlySpend: 0,
      usageInputTokens: 0,
      usageOutputTokens: 0,
      usagePromptCachingWriteTokens: 0,
      usagePromptCachingReadTokens: 0,
    };
  }

  return {
    tool,
    plan: availablePlans[0] ?? PlanTier.Pro,
    planVariant: undefined,
    seats: 1,
    monthlySpend: 0,
  };
};

const normalizeToolEntry = (entry: Partial<ToolSpendInput> & { tool: SupportedTool }): ToolSpendInput => {
  const availablePlans = TOOL_PLAN_TIERS[entry.tool];
  const plan = entry.plan && availablePlans.includes(entry.plan) ? entry.plan : availablePlans[0];

  return {
    tool: entry.tool,
    plan: plan ?? PlanTier.Pro,
    planVariant: typeof entry.planVariant === "string" ? entry.planVariant : undefined,
    seats: clampWholeNumber(coerceNumber(entry.seats, 1)),
    monthlySpend: clampCurrency(coerceNumber(entry.monthlySpend, 0)),
    usageInputTokens: clampWholeNumber(coerceNumber(entry.usageInputTokens, 0)),
    usageOutputTokens: clampWholeNumber(coerceNumber(entry.usageOutputTokens, 0)),
    usagePromptCachingWriteTokens: clampWholeNumber(coerceNumber(entry.usagePromptCachingWriteTokens, 0)),
    usagePromptCachingReadTokens: clampWholeNumber(coerceNumber(entry.usagePromptCachingReadTokens, 0)),
  };
};

const calculateAnthropicApiSpend = (entry: ToolSpendInput): number => {
  const model = String(entry.planVariant ?? "opus_4_7");
  const rates =
    model === "sonnet_4_6"
      ? { input: 3, output: 15, write: 3.75, read: 0.3 }
      : model === "haiku_4_5"
        ? { input: 1, output: 5, write: 1.25, read: 0.1 }
        : { input: 5, output: 25, write: 6.25, read: 0.5 };

  const inputTokens = clampWholeNumber(coerceNumber(entry.usageInputTokens, 0));
  const outputTokens = clampWholeNumber(coerceNumber(entry.usageOutputTokens, 0));
  const writeTokens = clampWholeNumber(coerceNumber(entry.usagePromptCachingWriteTokens, 0));
  const readTokens = clampWholeNumber(coerceNumber(entry.usagePromptCachingReadTokens, 0));

  return clampCurrency(
    (inputTokens / 1_000_000) * rates.input +
      (outputTokens / 1_000_000) * rates.output +
      (writeTokens / 1_000_000) * rates.write +
      (readTokens / 1_000_000) * rates.read,
  );
};

const getToolOptionsForRow = (currentTool: SupportedTool | ""): readonly SupportedTool[] => {
  if (currentTool && SPEND_TOOL_OPTIONS.includes(currentTool)) {
    return SPEND_TOOL_OPTIONS;
  }

  return SPEND_TOOL_OPTIONS;
};

export interface SpendFormProps {
  initialState?: Partial<AuditFormInputState>;
  onSubmit?: (payload: ShareableAuditPayload, state: AuditFormInputState) => void;
  className?: string;
}

const toShareablePayload = (state: AuditFormInputState): ShareableAuditPayload => {
  const toolBreakdown = state.tools
    .filter((tool) => !isBlankToolRow(tool as ToolSpendInput | DraftToolSpendInput))
    .map((tool) => ({
      tool: tool.tool,
      plan: tool.plan,
      seats: tool.seats,
      monthlySpend: tool.monthlySpend,
      annualSpend: tool.monthlySpend * 12,
    }));

  const totalMonthlySpend = toolBreakdown.reduce((total, tool) => total + tool.monthlySpend, 0);

  return {
    schemaVersion: 1,
    generatedAtIso: new Date().toISOString(),
    teamSize: state.teamSize,
    primaryUseCase: state.primaryUseCase,
    totalMonthlySpend,
    totalAnnualSpend: totalMonthlySpend * 12,
    toolBreakdown,
  };
};

export function SpendForm({ initialState, onSubmit, className }: SpendFormProps) {
  const { form, patchForm, setForm, totalMonthlySpend, resetForm } = usePersistentForm(
    initialState ?? DEFAULT_FORM_STATE,
  );
  const [auditResults, setAuditResults] = useState<null | any>(null);
  const tools = form.tools as DraftToolSpendInput[];

  useEffect(() => {
    setForm((prev) => {
      let changed = false;
      const tools = prev.tools.map((tool) => {
        if (tool.tool !== SupportedTool.GitHubCopilot) {
          if (
            tool.tool !== SupportedTool.Claude &&
            tool.tool !== SupportedTool.AnthropicApi &&
            tool.tool !== SupportedTool.ChatGPT
          ) {
            return tool;
          }
        }

        if (tool.tool === SupportedTool.GitHubCopilot) {
          const variant = tool.planVariant && COPILOT_TIER_OPTIONS.some((option) => option.id === tool.planVariant)
            ? tool.planVariant
            : "free";
          const variantPrice = COPILOT_TIER_OPTIONS.find((option) => option.id === variant)?.price ?? 0;
          const effectiveSeats = variant === "free" ? 0 : Math.max(1, tool.seats);
          const nextMonthlySpend = clampCurrency(variantPrice * effectiveSeats);

          if (
            tool.plan !== PlanTier.Individual ||
            tool.planVariant !== variant ||
            tool.monthlySpend !== nextMonthlySpend ||
            tool.seats !== effectiveSeats
          ) {
            changed = true;
            return {
              ...tool,
              plan: PlanTier.Individual,
              planVariant: variant,
              seats: effectiveSeats,
              monthlySpend: nextMonthlySpend,
            };
          }

          return tool;
        }

        if (tool.tool === SupportedTool.Claude) {
          const variant = tool.planVariant && CLAUDE_TIER_OPTIONS.some((option) => option.id === tool.planVariant)
            ? tool.planVariant
            : "free";
          const variantConfig = CLAUDE_TIER_OPTIONS.find((option) => option.id === variant) ?? CLAUDE_TIER_OPTIONS[0];
          const variantPrice = variantConfig.price ?? 0;
          const effectiveSeats = variantConfig.needsTeamSize ? Math.max(1, tool.seats) : 0;
          const nextMonthlySpend = variantConfig.needsTeamSize
            ? clampCurrency(variantPrice * effectiveSeats)
            : clampCurrency(variantPrice);

          if (
            tool.planVariant !== variant ||
            tool.monthlySpend !== nextMonthlySpend ||
            tool.seats !== effectiveSeats ||
            (variantConfig.needsTeamSize ? tool.plan !== (variant === "enterprise" ? PlanTier.Enterprise : PlanTier.Team) : tool.plan !== PlanTier.Individual)
          ) {
            changed = true;
            return {
              ...tool,
              plan: variantConfig.needsTeamSize
                ? variant === "enterprise"
                  ? PlanTier.Enterprise
                  : PlanTier.Team
                : PlanTier.Individual,
              planVariant: variant,
              seats: effectiveSeats,
              monthlySpend: nextMonthlySpend,
            };
          }

          return tool;
        }

        if (tool.tool === SupportedTool.ChatGPT) {
          const variant = tool.planVariant && CHATGPT_TIER_OPTIONS.some((option) => option.id === tool.planVariant)
            ? tool.planVariant
            : "free";
          const variantPrice = CHATGPT_TIER_OPTIONS.find((option) => option.id === variant)?.price ?? 0;

          // Business: $1800 per user
          if (variant === "business") {
            const effectiveSeats = Math.max(1, tool.seats);
            const nextMonthlySpend = clampCurrency(1800 * effectiveSeats);

            if (
              tool.plan !== PlanTier.Business ||
              tool.planVariant !== variant ||
              tool.monthlySpend !== nextMonthlySpend ||
              tool.seats !== effectiveSeats
            ) {
              changed = true;
              return {
                ...tool,
                plan: PlanTier.Business,
                planVariant: variant,
                seats: effectiveSeats,
                monthlySpend: nextMonthlySpend,
              };
            }

            return tool;
          }

          // Enterprise: editable monthly price, seats not required.
          if (variant === "enterprise") {
            const nextMonthlySpend = clampCurrency(coerceNumber(tool.monthlySpend, 0));
            if (
              tool.plan !== PlanTier.Enterprise ||
              tool.planVariant !== variant ||
              tool.seats !== 0 ||
              tool.monthlySpend !== nextMonthlySpend
            ) {
              changed = true;
              return {
                ...tool,
                plan: PlanTier.Enterprise,
                planVariant: variant,
                seats: 0,
                monthlySpend: nextMonthlySpend,
              };
            }

            return tool;
          }

          // Individual tiers always use a single seat.
          const effectiveSeats = 1;
          const nextMonthlySpend = clampCurrency(variantPrice * effectiveSeats);
          const expectedPlan = PlanTier.Individual;

          if (
            tool.plan !== expectedPlan ||
            tool.planVariant !== variant ||
            tool.monthlySpend !== nextMonthlySpend ||
            tool.seats !== effectiveSeats
          ) {
            changed = true;
            return {
              ...tool,
              plan: expectedPlan,
              planVariant: variant,
              seats: effectiveSeats,
              monthlySpend: nextMonthlySpend,
            };
          }

          return tool;
        }

        const model = tool.planVariant && ANTHROPIC_MODEL_OPTIONS.some((option) => option.id === tool.planVariant)
          ? tool.planVariant
          : "opus_4_7";
        const nextMonthlySpend = calculateAnthropicApiSpend({
          ...tool,
          planVariant: model,
        });

        if (
          tool.plan !== PlanTier.ApiDirect ||
          tool.planVariant !== model ||
          tool.monthlySpend !== nextMonthlySpend
        ) {
          changed = true;
          return {
            ...tool,
            plan: PlanTier.ApiDirect,
            planVariant: model,
            seats: 0,
            monthlySpend: nextMonthlySpend,
          };
        }

        return tool;
      });

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        tools,
        updatedAtIso: new Date().toISOString(),
      };
    });
  }, [form.tools, setForm]);

  const selectedTools = useMemo(
    () =>
      form.tools.reduce((counts, tool) => {
        if (isBlankToolRow(tool as ToolSpendInput | DraftToolSpendInput)) {
          return counts;
        }

        counts.set(tool.tool, (counts.get(tool.tool) ?? 0) + 1);
        return counts;
      }, new Map<SupportedTool, number>()),
    [form.tools],
  );

  const availableToolSlots = SPEND_TOOL_OPTIONS.filter((tool) => !selectedTools.has(tool));
  const canAddAnotherTool = availableToolSlots.length > 0;

  const addToolRow = () => {
    if (!canAddAnotherTool) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      tools: [EMPTY_TOOL_ROW as ToolSpendInput, ...prev.tools],
      updatedAtIso: new Date().toISOString(),
    }));
  };

  const updateToolRow = (index: number, patch: Partial<ToolSpendInput>) => {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.map((tool, toolIndex) => {
        if (toolIndex !== index) {
          return tool;
        }

        if (isBlankToolRow(tool as ToolSpendInput | DraftToolSpendInput)) {
          if (!patch.tool) {
            return tool;
          }

          return normalizeToolEntry({
            ...buildDefaultToolEntry(patch.tool),
            ...patch,
            tool: patch.tool,
          });
        }

        const merged = normalizeToolEntry({
          ...tool,
          ...patch,
          tool: patch.tool ?? tool.tool,
        });

        if (merged.tool === SupportedTool.GitHubCopilot) {
          const variant = (patch.planVariant as string) ?? merged.planVariant ?? "free";
          const variantPrice = COPILOT_TIER_OPTIONS.find((option) => option.id === variant)?.price ?? 0;
          merged.plan = PlanTier.Individual;
          merged.planVariant = variant;
          merged.seats = variant === "free"
            ? 0
            : Math.max(1, clampWholeNumber(coerceNumber(patch.seats ?? merged.seats, merged.seats)));
          merged.monthlySpend = clampCurrency(variantPrice * merged.seats);
        } else if (merged.tool === SupportedTool.Claude) {
          const variant = (patch.planVariant as string) ?? merged.planVariant ?? "free";
          const variantConfig = CLAUDE_TIER_OPTIONS.find((option) => option.id === variant) ?? CLAUDE_TIER_OPTIONS[0];
          const variantPrice = variantConfig.price ?? 0;
          merged.planVariant = variant;
          merged.plan = variantConfig.needsTeamSize
            ? variant === "enterprise"
              ? PlanTier.Enterprise
              : PlanTier.Team
            : PlanTier.Individual;
          merged.seats = variantConfig.needsTeamSize
            ? Math.max(1, clampWholeNumber(coerceNumber(patch.seats ?? merged.seats, merged.seats)))
            : 0;
          merged.monthlySpend = clampCurrency(
            variantConfig.needsTeamSize ? variantPrice * merged.seats : variantPrice,
          );
        } else if (merged.tool === SupportedTool.AnthropicApi) {
          const model = (patch.planVariant as string) ?? merged.planVariant ?? "opus_4_7";
          merged.plan = PlanTier.ApiDirect;
          merged.planVariant = model;
          merged.seats = 0;
          merged.monthlySpend = calculateAnthropicApiSpend({
            ...merged,
            planVariant: model,
          });
        } else if (merged.tool === SupportedTool.ChatGPT) {
          const variant = (patch.planVariant as string) ?? merged.planVariant ?? "free";
          const variantPrice = CHATGPT_TIER_OPTIONS.find((o) => o.id === variant)?.price ?? 0;

          // Business: $1800 per user
          if (variant === "business") {
            merged.plan = PlanTier.Business;
            merged.planVariant = variant;
            merged.seats = Math.max(1, clampWholeNumber(coerceNumber(patch.seats ?? merged.seats, merged.seats)));
            merged.monthlySpend = clampCurrency(1800 * merged.seats);
          } else if (variant === "enterprise") {
            merged.plan = PlanTier.Enterprise;
            merged.planVariant = variant;
            merged.seats = 0;
            if (typeof patch.monthlySpend === "number") {
              merged.monthlySpend = clampCurrency(patch.monthlySpend);
            }
          } else {
            // Individual tiers always use one seat.
            merged.planVariant = variant;
            merged.plan = PlanTier.Individual;
            merged.seats = 1;
            merged.monthlySpend = clampCurrency(variantPrice * merged.seats);
          }
        }

        // Special handling for Cursor hierarchical plans
        if (merged.tool === SupportedTool.Cursor) {
          // Hobby is free — seats not required
          if (merged.plan === PlanTier.Hobby) {
            merged.monthlySpend = 0;
            merged.seats = 0;
          }

          // Individual -> variants (price is a flat per-account value; seats not required)
          if (merged.plan === PlanTier.Individual) {
            const variant = (patch.planVariant as string) ?? merged.planVariant ?? "pro";
            const variantPrice = CURSOR_INDIVIDUAL_OPTIONS.find((o) => o.id === variant)?.price ?? 20;
            merged.planVariant = variant;
            merged.monthlySpend = clampCurrency(variantPrice);
            merged.seats = 0;
          }

          // Team pricing: $40 per user (seats required)
          if (merged.plan === PlanTier.Team) {
            const teamPrice = 40;
            merged.monthlySpend = clampCurrency(merged.seats * teamPrice);
          }

          // Enterprise: custom monthly price (single value); seats not required
          if (merged.plan === PlanTier.Enterprise) {
            if (typeof patch.monthlySpend === "number") {
              merged.monthlySpend = clampCurrency(patch.monthlySpend);
            }
            merged.seats = 0;
          }
        }

        return merged;
      }),
      updatedAtIso: new Date().toISOString(),
    }));
  };

  const removeToolRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.filter((_, toolIndex) => toolIndex !== index),
      updatedAtIso: new Date().toISOString(),
    }));
  };

  return (
    <>
      <form
        className={["audit-form", className].filter(Boolean).join(" ")}
        onSubmit={(event) => {
          event.preventDefault();
          const selectedForm: AuditFormInputState = {
            ...form,
            tools: form.tools.filter((tool) => !isBlankToolRow(tool as ToolSpendInput | DraftToolSpendInput)),
          };

          onSubmit?.(toShareablePayload(selectedForm), selectedForm);
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { calculateAudit } = require("../lib/auditEngine");
            const engineOutput = calculateAudit(selectedForm);
            const breakdownByToolId = new Map<
              SupportedTool,
              { currentSpend: number; recommendedSpend: number; savings: number; reasoning: string }
            >(
              engineOutput.breakdown.map(
                (entry: { toolId: SupportedTool; currentSpend: number; recommendedSpend: number; savings: number; reasoning: string }) =>
                  [entry.toolId, entry] as const,
              ),
            );

            const tools = selectedForm.tools.map((t) => {
              const entry = breakdownByToolId.get(t.tool);
              return {
                tool: String(t.tool),
                label: TOOL_LABELS[t.tool as SupportedTool] ?? String(t.tool),
                plan: String(t.plan),
                currentMonthly: entry ? Number(entry.currentSpend ?? t.monthlySpend ?? 0) : Number(t.monthlySpend ?? 0),
                recommendedMonthly: entry ? Number(entry.recommendedSpend ?? 0) : Number(t.monthlySpend ?? 0),
                savings: entry ? Number(entry.savings ?? 0) : 0,
                reason: entry ? String(entry.reasoning ?? "") : "",
              };
            });

            const totalMonthlySavings = engineOutput.totalMonthlySavings ?? tools.reduce((s: number, x: any) => s + (x.savings ?? 0), 0);

            const aiSummary = `Deterministic audit: estimated monthly savings $${totalMonthlySavings.toFixed(2)}.`;

            setAuditResults({
              tools,
              totalMonthlySavings,
              totalMonthlySpend: toShareablePayload(selectedForm).totalMonthlySpend,
              totalAnnualSavings: engineOutput.totalAnnualSavings ?? totalMonthlySavings * 12,
              aiSummary,
            });
          } catch (err) {
            console.error(err);
          }
        }}
      >
        <div className="audit-form__hero" style={{ padding: 20 }}>
          <div className="audit-form__hero-copy">
            <h2 className="audit-form__title">Spend model</h2>
            <p className="audit-form__lede">Quickly capture team size and active tool spend.</p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <div className="chip">{form.tools.length} tools</div>
              <div className="chip">${totalMonthlySpend.toFixed(0)} / month</div>
            </div>
          </div>
        </div>

        <div className="audit-form__body">
          <div className="audit-form__main">
            <section className="panel panel--soft">
              <div className="panel__inner" style={{ padding: 16 }}>
                <div className="field-grid field-grid--two">
                  <label className="field">
                    <span className="field__label">Team size</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={form.teamSize}
                      onChange={(event) => {
                        patchForm({ teamSize: Math.max(1, clampWholeNumber(event.currentTarget.valueAsNumber || 0)) });
                      }}
                      className="field__control"
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">Primary use case</span>
                    <select
                      value={form.primaryUseCase}
                      onChange={(event) => patchForm({ primaryUseCase: event.currentTarget.value as UseCase })}
                      className="field__control"
                    >
                      {ALL_USE_CASES.map((useCase) => (
                        <option key={useCase} value={useCase}>
                          {USE_CASE_LABELS[useCase]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span className="field__label">Usage intensity</span>
                    <select
                      value={form.activityLevel ?? "standard"}
                      onChange={(event) => patchForm({ activityLevel: event.currentTarget.value as UsageBand })}
                      className="field__control"
                    >
                      {Object.entries(ACTIVITY_LEVEL_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="panel panel--surface tool-section">
              <div className="panel__inner">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p className="panel__title">Tools</p>
                  <button type="button" onClick={addToolRow} disabled={!canAddAnotherTool} className="btn btn--primary">
                    Add Tool
                  </button>
                </div>

                {form.tools.length === 0 ? (
                  <div style={{ padding: 12 }}>
                    <p style={{ margin: 0 }}>No tools yet. Click “Add Tool” to start.</p>
                  </div>
                ) : (
                  <div className="tool-stack">
                    {tools.map((toolConfig, index) => {
                      const rowToolOptions = getToolOptionsForRow(toolConfig.tool);
                      const rowPlanOptions = toolConfig.tool === "" ? [] : TOOL_PLAN_TIERS[toolConfig.tool];

                      return (
                        <article key={`${toolConfig.tool}-${index}`} className="tool-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <p className="tool-card__title">{toolConfig.tool === "" ? "New tool" : TOOL_LABELS[toolConfig.tool]}</p>
                              <p className="tool-card__text" style={{ margin: 0 }}>
                                {toolConfig.tool === "" ? "--" : `${PLAN_LABELS[toolConfig.plan]} ${toolConfig.planVariant ? `· ${String(toolConfig.planVariant)}` : ""}`}
                              </p>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button type="button" onClick={() => removeToolRow(index)} className="btn btn--danger">
                                Delete
                              </button>
                            </div>
                          </div>

                          <div className="tool-card__grid" style={{ marginTop: 10 }}>
                            <label className="field">
                              <span className="field__label">Tool</span>
                              <select
                                value={toolConfig.tool}
                                onChange={(event) => updateToolRow(index, { tool: event.currentTarget.value as SupportedTool })}
                                className="field__control field__control--soft"
                              >
                                <option value="">--</option>
                                {rowToolOptions.map((tool) => {
                                  const isTakenByAnotherRow = selectedTools.get(tool) !== undefined && tool !== toolConfig.tool;
                                  return (
                                    <option key={tool} value={tool} disabled={isTakenByAnotherRow}>
                                      {TOOL_LABELS[tool]}
                                    </option>
                                  );
                                })}
                              </select>
                            </label>

                            {toolConfig.tool !== "" ? (
                              <>
                                <label className="field">
                                  <span className="field__label">Plan / Variant</span>
                                  {toolConfig.tool === SupportedTool.GitHubCopilot ? (
                                    <select value={toolConfig.planVariant ?? "free"} onChange={(e) => updateToolRow(index, { planVariant: e.currentTarget.value })} className="field__control field__control--soft">
                                      {COPILOT_TIER_OPTIONS.map((o) => (
                                        <option key={o.id} value={o.id}>{renderOptionLabel(o)}</option>
                                      ))}
                                    </select>
                                  ) : toolConfig.tool === SupportedTool.Claude ? (
                                    <select value={toolConfig.planVariant ?? "free"} onChange={(e) => updateToolRow(index, { planVariant: e.currentTarget.value })} className="field__control field__control--soft">
                                      {CLAUDE_TIER_OPTIONS.map((o) => (
                                        <option key={o.id} value={o.id}>{renderOptionLabel(o)}</option>
                                      ))}
                                    </select>
                                  ) : toolConfig.tool === SupportedTool.ChatGPT ? (
                                    <select value={toolConfig.planVariant ?? "free"} onChange={(e) => updateToolRow(index, { planVariant: e.currentTarget.value })} className="field__control field__control--soft">
                                      {CHATGPT_TIER_OPTIONS.map((o) => (
                                        <option key={o.id} value={o.id}>{renderOptionLabel(o)}</option>
                                      ))}
                                    </select>
                                  ) : toolConfig.tool === SupportedTool.AnthropicApi ? (
                                    <select value={toolConfig.planVariant ?? "opus_4_7"} onChange={(e) => updateToolRow(index, { planVariant: e.currentTarget.value })} className="field__control field__control--soft">
                                      {ANTHROPIC_MODEL_OPTIONS.map((o) => (
                                        <option key={o.id} value={o.id}>{renderOptionLabel(o)}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <select value={toolConfig.plan} onChange={(e) => updateToolRow(index, { plan: e.currentTarget.value as PlanTier })} className="field__control field__control--soft">
                                      {rowPlanOptions.map((plan) => <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>)}
                                    </select>
                                  )}
                                </label>

                                <label className="field">
                                  <span className="field__label">Seats</span>
                                  <input type="number" min={0} step={1} value={toolConfig.seats} onChange={(e) => updateToolRow(index, { seats: clampWholeNumber(e.currentTarget.valueAsNumber || 0) })} className="field__control field__control--soft" />
                                </label>

                                <label className="field">
                                  <span className="field__label">Monthly spend (USD)</span>
                                  <input type="number" min={0} step={0.01} value={toolConfig.monthlySpend} onChange={(e) => updateToolRow(index, { monthlySpend: clampCurrency(e.currentTarget.valueAsNumber || 0) })} className="field__control field__control--soft" />
                                </label>
                              </>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="audit-form__aside">
            <section className="panel panel--surface">
              <div className="panel__inner">
                <p className="panel__kicker">Total</p>
                <p className="form-footer__value">${totalMonthlySpend.toFixed(2)}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={resetForm} className="btn btn--secondary">Reset</button>
                  <button type="submit" className="btn btn--primary">Generate audit</button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </form>

      {auditResults ? (
        <div style={{ marginTop: 24 }}>
          {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
          {(() => {
            const AuditResults = require("./AuditResults").default;
            return <AuditResults results={auditResults} />;
          })()}
        </div>
      ) : null}
    </>
  );
}


