"use client";

import { useMemo } from "react";
import { usePersistentForm } from "../src/hooks/usePersistentForm";
import {
  ALL_SUPPORTED_TOOLS,
  ALL_USE_CASES,
  type AuditFormInputState,
  PlanTier,
  type ShareableAuditPayload,
  SupportedTool,
  TOOL_PLAN_TIERS,
  UseCase,
} from "../src/types/audit";

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
  const { form, patchForm, upsertTool, removeTool, totalMonthlySpend, resetForm } = usePersistentForm(
    initialState ?? DEFAULT_FORM_STATE,
  );

  const selectedTools = useMemo(
    () => new Set(form.tools.map((tool) => tool.tool)),
    [form.tools],
  );

  const toolById = useMemo(() => {
    return form.tools.reduce<Partial<Record<SupportedTool, AuditFormInputState["tools"][number]>>>(
      (acc, tool) => {
        acc[tool.tool] = tool;
        return acc;
      },
      {},
    );
  }, [form.tools]);

  return (
    <form
      className={[
        "mx-auto w-full max-w-5xl space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(toShareablePayload(form), form);
      }}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-slate-800">Team size</span>
          <input
            type="number"
            min={1}
            step={1}
            value={form.teamSize}
            onChange={(event) =>
              patchForm({
                teamSize: Number.isFinite(event.currentTarget.valueAsNumber)
                  ? Math.max(0, event.currentTarget.valueAsNumber)
                  : 0,
              })
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-500"
          />
        </label>

        <label className="space-y-2">
          <span className="block text-sm font-semibold text-slate-800">Primary use case</span>
          <select
            value={form.primaryUseCase}
            onChange={(event) => patchForm({ primaryUseCase: event.currentTarget.value as UseCase })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-500"
          >
            {ALL_USE_CASES.map((useCase) => (
              <option key={useCase} value={useCase}>
                {USE_CASE_LABELS[useCase]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Tool spend inputs</h2>
        <div className="space-y-3">
          {ALL_SUPPORTED_TOOLS.map((tool) => {
            const selected = selectedTools.has(tool);
            const toolConfig = toolById[tool];
            const availablePlans = TOOL_PLAN_TIERS[tool];
            const defaultPlan = availablePlans[0];

            return (
              <div
                key={tool}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300"
              >
                <div className="flex items-center justify-between gap-4">
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-900">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        if (event.currentTarget.checked) {
                          upsertTool({
                            tool,
                            plan: defaultPlan,
                            seats: 1,
                            monthlySpend: 0,
                          });
                          return;
                        }

                        removeTool(tool);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    {TOOL_LABELS[tool]}
                  </label>
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {selected ? "Enabled" : "Disabled"}
                  </span>
                </div>

                {selected && toolConfig ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="space-y-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Plan</span>
                      <select
                        value={toolConfig.plan}
                        onChange={(event) =>
                          upsertTool({
                            ...toolConfig,
                            plan: event.currentTarget.value as PlanTier,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      >
                        {availablePlans.map((plan) => (
                          <option key={plan} value={plan}>
                            {PLAN_LABELS[plan]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Seats</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={toolConfig.seats}
                        onChange={(event) =>
                          upsertTool({
                            ...toolConfig,
                            seats: Number.isFinite(event.currentTarget.valueAsNumber)
                              ? Math.max(0, event.currentTarget.valueAsNumber)
                              : 0,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Monthly spend (USD)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={toolConfig.monthlySpend}
                        onChange={(event) =>
                          upsertTool({
                            ...toolConfig,
                            monthlySpend: Number.isFinite(event.currentTarget.valueAsNumber)
                              ? Math.max(0, event.currentTarget.valueAsNumber)
                              : 0,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-600">Current monthly total</p>
          <p className="text-2xl font-semibold text-slate-900">${totalMonthlySpend.toFixed(2)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Reset
          </button>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Generate shareable audit
          </button>
        </div>
      </section>
    </form>
  );
}
