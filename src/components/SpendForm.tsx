"use client";

import { useMemo } from "react";
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

const USE_CASE_LABELS: Record<UseCase, string> = {
  [UseCase.Coding]: "Coding",
  [UseCase.Writing]: "Writing",
  [UseCase.Data]: "Data",
  [UseCase.Research]: "Research",
  [UseCase.Mixed]: "Mixed",
};

const DEFAULT_FORM_STATE: AuditFormInputState = {
  teamSize: 1,
  primaryUseCase: UseCase.Coding,
  tools: [],
  updatedAtIso: new Date().toISOString(),
};

const clampWholeNumber = (value: number): number => Math.max(0, Math.round(value));

const clampCurrency = (value: number): number => Number(Math.max(0, value).toFixed(2));

const coerceNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const buildDefaultToolEntry = (tool: SupportedTool): ToolSpendInput => {
  const availablePlans = TOOL_PLAN_TIERS[tool];

  return {
    tool,
    plan: availablePlans[0] ?? PlanTier.Pro,
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
    seats: clampWholeNumber(coerceNumber(entry.seats, 1)),
    monthlySpend: clampCurrency(coerceNumber(entry.monthlySpend, 0)),
  };
};

const getToolOptionsForRow = (currentTool: SupportedTool): readonly SupportedTool[] => {
  if (SPEND_TOOL_OPTIONS.includes(currentTool)) {
    return SPEND_TOOL_OPTIONS;
  }

  return [currentTool, ...SPEND_TOOL_OPTIONS];
};

export interface SpendFormProps {
  initialState?: Partial<AuditFormInputState>;
  onSubmit?: (payload: ShareableAuditPayload, state: AuditFormInputState) => void;
  className?: string;
}

const toShareablePayload = (state: AuditFormInputState): ShareableAuditPayload => {
  const toolBreakdown = state.tools.map((tool) => ({
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

  const selectedTools = useMemo(
    () =>
      form.tools.reduce((counts, tool) => {
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

    const nextTool = availableToolSlots[0] ?? SPEND_TOOL_OPTIONS[0];

    setForm((prev) => ({
      ...prev,
      tools: [...prev.tools, buildDefaultToolEntry(nextTool)],
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

        return normalizeToolEntry({
          ...tool,
          ...patch,
          tool: patch.tool ?? tool.tool,
        });
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
    <form
      className={[
        "mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(toShareablePayload(form), form);
      }}
    >
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
              Phase 1 · Step 3
            </p>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Spend input form</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Capture team context and individual tool spend in a single persisted workflow.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-slate-100">
              Saved locally
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-slate-100">
              {form.tools.length} tool rows
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-slate-100">
              ${totalMonthlySpend.toFixed(2)} monthly
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-8">
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Team size
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={form.teamSize}
              onChange={(event) => {
                patchForm({
                  teamSize: Math.max(1, clampWholeNumber(event.currentTarget.valueAsNumber || 0)),
                });
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <label className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Primary use case
            </span>
            <select
              value={form.primaryUseCase}
              onChange={(event) => patchForm({ primaryUseCase: event.currentTarget.value as UseCase })}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {ALL_USE_CASES.map((useCase) => (
                <option key={useCase} value={useCase}>
                  {USE_CASE_LABELS[useCase]}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-700">
                Dynamic tool tracker
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Add one row per tool and keep every edit synced to local storage.
              </p>
            </div>

            <button
              type="button"
              onClick={addToolRow}
              disabled={!canAddAnotherTool}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Add Tool
            </button>
          </div>

          {form.tools.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-base font-medium text-slate-900">No tools added yet.</p>
              <p className="mt-2 text-sm text-slate-500">Start by adding Cursor, Copilot, or another tracked tool.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {form.tools.map((toolConfig, index) => {
                const rowToolOptions = getToolOptionsForRow(toolConfig.tool);
                const rowPlanOptions = TOOL_PLAN_TIERS[toolConfig.tool];

                return (
                  <div
                    key={`${toolConfig.tool}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Tool row {index + 1}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Configure the tool, plan, seat count, and monthly spend.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeToolRow(index)}
                        className="inline-flex w-fit items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr_0.7fr_1fr]">
                      <label className="space-y-2">
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                          Tool ID
                        </span>
                        <select
                          value={toolConfig.tool}
                          onChange={(event) =>
                            updateToolRow(index, { tool: event.currentTarget.value as SupportedTool })
                          }
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        >
                          {rowToolOptions.map((tool) => {
                            const isTakenByAnotherRow =
                              selectedTools.get(tool) !== undefined && tool !== toolConfig.tool;

                            return (
                              <option key={tool} value={tool} disabled={isTakenByAnotherRow}>
                                {TOOL_LABELS[tool]}
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                          Plan type
                        </span>
                        <select
                          value={toolConfig.plan}
                          onChange={(event) =>
                            updateToolRow(index, { plan: event.currentTarget.value as PlanTier })
                          }
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        >
                          {rowPlanOptions.map((plan) => (
                            <option key={plan} value={plan}>
                              {PLAN_LABELS[plan]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                          Seats
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={toolConfig.seats}
                          onChange={(event) =>
                            updateToolRow(index, {
                              seats: clampWholeNumber(event.currentTarget.valueAsNumber || 0),
                            })
                          }
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                          Current monthly spend (USD)
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={toolConfig.monthlySpend}
                          onChange={(event) =>
                            updateToolRow(index, {
                              monthlySpend: clampCurrency(event.currentTarget.valueAsNumber || 0),
                            })
                          }
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!canAddAnotherTool ? (
            <p className="text-sm text-slate-500">
              All supported tools are already in use. Remove a row to add another.
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-600">Current monthly total</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              ${totalMonthlySpend.toFixed(2)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Reset
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Generate shareable audit
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}
