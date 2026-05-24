"use client";

import { useMemo, useState } from "react";
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
  const [auditResults, setAuditResults] = useState<null | any>(null);

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
    <>
      <form
      className={[
        "audit-form",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(toShareablePayload(form), form);
        try {
          // dynamic import of engine to keep bundle small in some contexts
          // but here import synchronously
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { calculateAudit } = require("../lib/auditEngine");
          const engineOutput = calculateAudit(form);

          const tools = form.tools.map((t) => {
            const entry = engineOutput.breakdown.find((b: any) => String(b.toolId) === String(t.tool));
            return {
              tool: String(t.tool),
              label: TOOL_LABELS[t.tool as SupportedTool] ?? String(t.tool),
              plan: String(t.plan),
              currentMonthly: Number(t.monthlySpend ?? 0),
              recommendedMonthly: entry ? Number(entry.recommendedSpend ?? 0) : Number(t.monthlySpend ?? 0),
              savings: entry ? Number(entry.savings ?? 0) : 0,
              reason: entry ? String(entry.reasoning ?? "") : "",
            };
          });

          const totalMonthlySavings = engineOutput.totalMonthlySavings ?? tools.reduce((s: number, x: any) => s + (x.savings ?? 0), 0);

          const aiSummary = `Deterministic audit: estimated monthly savings $${totalMonthlySavings.toFixed(2)} (${(
            (totalMonthlySavings / Math.max(1, toShareablePayload(form).totalMonthlySpend)) * 100
          ).toFixed(1)}% of current spend).`;

          setAuditResults({
            tools,
            totalMonthlySavings,
            totalMonthlySpend: toShareablePayload(form).totalMonthlySpend,
            totalAnnualSavings: (engineOutput.totalAnnualSavings ?? totalMonthlySavings * 12),
            aiSummary,
          });
        } catch (err) {
          // swallow — keep behavior predictable
          console.error(err);
        }
      }}
    >
      <div className="audit-form__hero">
        <div className="audit-form__hero-grid">
          <div className="audit-form__hero-copy">
            <p className="eyebrow eyebrow--soft">Phase 1 · Step 3</p>
            <h2 className="audit-form__title">Shape the spend model</h2>
            <p className="audit-form__lede">
              Capture team context and individual tool spend in a single persisted workflow.
            </p>

            <div className="chip-row">
              <span className="chip">Saved locally</span>
              <span className="chip">{form.tools.length} tool rows</span>
              <span className="chip">${totalMonthlySpend.toFixed(2)} monthly</span>
            </div>
          </div>

          <div className="audit-form__summary-grid">
            <article className="metric-card">
              <p className="metric-card__eyebrow">Monthly</p>
              <p className="metric-card__value">${totalMonthlySpend.toFixed(2)}</p>
              <p className="metric-card__text">Combined current spend across all tracked tools.</p>
            </article>

            <article className="metric-card">
              <p className="metric-card__eyebrow">Rows</p>
              <p className="metric-card__value">{form.tools.length}</p>
              <p className="metric-card__text">Add one row per tool to keep the audit readable.</p>
            </article>

            <article className="metric-card">
              <p className="metric-card__eyebrow">State</p>
              <p className="metric-card__value">Auto-saved</p>
              <p className="metric-card__text">Edits are preserved in browser storage while you work.</p>
            </article>
          </div>
        </div>
      </div>

      <div className="audit-form__body">
        <div className="audit-form__main">
          <section className="panel panel--soft">
            <div className="panel__inner">
              <div className="field-grid field-grid--two">
                <label className="field">
                  <span className="field__label">Team size</span>
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
              </div>
            </div>
          </section>

          <section className="panel panel--surface tool-section">
            <div className="panel__inner">
              <div className="tool-section__header">
                <div>
                  <p className="panel__title">Dynamic tool tracker</p>
                  <p className="panel__text">Add one row per tool and keep every edit synced to local storage.</p>
                </div>

                <button type="button" onClick={addToolRow} disabled={!canAddAnotherTool} className="btn btn--primary">
                  Add Tool
                </button>
              </div>

              {form.tools.length === 0 ? (
                <div className="panel panel--soft">
                  <div className="panel__inner">
                    <p className="tool-card__title">No tools added yet.</p>
                    <p className="tool-card__text">Start by adding Cursor, Copilot, or another tracked tool.</p>
                  </div>
                </div>
              ) : (
                <div className="tool-stack">
                  {form.tools.map((toolConfig, index) => {
                    const rowToolOptions = getToolOptionsForRow(toolConfig.tool);
                    const rowPlanOptions = TOOL_PLAN_TIERS[toolConfig.tool];

                    return (
                      <article key={`${toolConfig.tool}-${index}`} className="tool-card">
                        <div className="tool-card__header">
                          <div>
                            <p className="tool-card__title">Tool row {index + 1}</p>
                            <p className="tool-card__text">Configure the tool, plan, seat count, and monthly spend.</p>
                          </div>

                          <button type="button" onClick={() => removeToolRow(index)} className="btn btn--danger">
                            Delete
                          </button>
                        </div>

                        <div className="tool-card__grid field-grid--tool">
                          <label className="field">
                            <span className="field__label">Tool ID</span>
                            <select
                              value={toolConfig.tool}
                              onChange={(event) =>
                                updateToolRow(index, { tool: event.currentTarget.value as SupportedTool })
                              }
                              className="field__control field__control--soft"
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

                          <label className="field">
                            <span className="field__label">Plan type</span>
                            <select
                              value={toolConfig.plan}
                              onChange={(event) =>
                                updateToolRow(index, { plan: event.currentTarget.value as PlanTier })
                              }
                              className="field__control field__control--soft"
                            >
                              {rowPlanOptions.map((plan) => (
                                <option key={plan} value={plan}>
                                  {PLAN_LABELS[plan]}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field">
                            <span className="field__label">Seats</span>
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
                              className="field__control field__control--soft"
                            />
                          </label>

                          <label className="field">
                            <span className="field__label">Current monthly spend (USD)</span>
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
                              className="field__control field__control--soft"
                            />
                          </label>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {!canAddAnotherTool ? (
                <p className="panel__text spacer-top">All supported tools are already in use. Remove a row to add another.</p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="audit-form__aside">
          <section className="callout callout--dark">
            <p className="callout__eyebrow">Summary</p>
            <p className="callout__value">${totalMonthlySpend.toFixed(2)}</p>
            <p className="callout__text">
              Current monthly total across all tracked tools. This is the number the audit will anchor on.
            </p>

            <dl className="summary-grid">
              <div className="summary-card">
                <dt>Team</dt>
                <dd>{form.teamSize} people</dd>
              </div>
              <div className="summary-card">
                <dt>Use case</dt>
                <dd>{USE_CASE_LABELS[form.primaryUseCase]}</dd>
              </div>
              <div className="summary-card">
                <dt>Tools</dt>
                <dd>{form.tools.length} tracked</dd>
              </div>
            </dl>
          </section>

          <section className="panel panel--surface">
            <div className="panel__inner">
              <p className="panel__title">What happens next</p>
              <ul className="callout-list">
                <li className="callout-list__item">Review the spend total and team context before exporting.</li>
                <li className="callout-list__item">Reset the workspace if you need to start a fresh audit.</li>
                <li className="callout-list__item">Generate a shareable payload when the data is ready.</li>
              </ul>
            </div>
          </section>

          <section className="panel panel--surface">
            <div className="panel__inner">
              <div>
                <p className="panel__kicker">Current monthly total</p>
                <p className="form-footer__value">${totalMonthlySpend.toFixed(2)}</p>
                <p className="form-footer__note">Use this to confirm the audit is ready before exporting.</p>
              </div>

              <div className="action-row">
                <button type="button" onClick={resetForm} className="btn btn--secondary">
                  Reset
                </button>
                <button type="submit" className="btn btn--primary">
                  Generate shareable audit
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
      </form>

      {auditResults ? (
        <div className="mt-10">
          {/* Lazy-render AuditResults to show computed recommendations */}
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
