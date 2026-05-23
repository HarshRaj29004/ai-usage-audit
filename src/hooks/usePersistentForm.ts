"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AuditFormInputState,
  type AuditFormPatch,
  type ToolSpendInput,
  PlanTier,
  SupportedTool,
  UseCase,
} from "../types/audit";

const DEFAULT_STORAGE_KEY = "ai-spend-audit:form";

const DEFAULT_FORM_STATE: AuditFormInputState = {
  teamSize: 1,
  primaryUseCase: UseCase.Coding,
  tools: [],
  updatedAtIso: new Date().toISOString(),
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampNonNegative = (value: number): number => Math.max(0, value);

const isSupportedTool = (value: unknown): value is SupportedTool =>
  typeof value === "string" && Object.values(SupportedTool).includes(value as SupportedTool);

const isPlanTier = (value: unknown): value is PlanTier =>
  typeof value === "string" && Object.values(PlanTier).includes(value as PlanTier);

const isUseCase = (value: unknown): value is UseCase =>
  typeof value === "string" && Object.values(UseCase).includes(value as UseCase);

const sanitizeToolEntry = (entry: unknown): ToolSpendInput | null => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const raw = entry as Partial<ToolSpendInput>;
  if (!isSupportedTool(raw.tool) || !isPlanTier(raw.plan)) {
    return null;
  }

  if (!isFiniteNumber(raw.seats) || !isFiniteNumber(raw.monthlySpend)) {
    return null;
  }

  return {
    tool: raw.tool,
    plan: raw.plan,
    seats: clampNonNegative(raw.seats),
    monthlySpend: clampNonNegative(raw.monthlySpend),
  };
};

const sanitizeState = (
  incoming: unknown,
  fallback: AuditFormInputState,
): AuditFormInputState => {
  if (!incoming || typeof incoming !== "object") {
    return fallback;
  }

  const raw = incoming as Partial<AuditFormInputState>;
  const sanitizedTools = Array.isArray(raw.tools)
    ? raw.tools.map(sanitizeToolEntry).filter((tool): tool is ToolSpendInput => tool !== null)
    : fallback.tools;

  return {
    teamSize: isFiniteNumber(raw.teamSize) ? clampNonNegative(raw.teamSize) : fallback.teamSize,
    primaryUseCase: isUseCase(raw.primaryUseCase) ? raw.primaryUseCase : fallback.primaryUseCase,
    tools: sanitizedTools,
    updatedAtIso: typeof raw.updatedAtIso === "string" ? raw.updatedAtIso : new Date().toISOString(),
  };
};

export interface UsePersistentFormResult {
  form: AuditFormInputState;
  setForm: React.Dispatch<React.SetStateAction<AuditFormInputState>>;
  patchForm: (patch: AuditFormPatch) => void;
  upsertTool: (entry: ToolSpendInput) => void;
  removeTool: (tool: SupportedTool) => void;
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
    if (rawStored) {
      try {
        const parsed = JSON.parse(rawStored) as unknown;
        setForm(sanitizeState(parsed, resolvedInitialState));
      } catch {
        setForm(resolvedInitialState);
      }
    } else {
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

  const upsertTool = useCallback((entry: ToolSpendInput) => {
    setForm((prev) => {
      const nextTools = prev.tools.some((tool) => tool.tool === entry.tool)
        ? prev.tools.map((tool) => (tool.tool === entry.tool ? sanitizeToolEntry(entry) ?? tool : tool))
        : [...prev.tools, sanitizeToolEntry(entry) ?? entry];

      return {
        ...prev,
        tools: nextTools,
        updatedAtIso: new Date().toISOString(),
      };
    });
  }, []);

  const removeTool = useCallback((toolToRemove: SupportedTool) => {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.filter((tool) => tool.tool !== toolToRemove),
      updatedAtIso: new Date().toISOString(),
    }));
  }, []);

  const resetForm = useCallback(() => {
    setForm({ ...resolvedInitialState, updatedAtIso: new Date().toISOString() });
  }, [resolvedInitialState]);

  const totalMonthlySpend = useMemo(
    () => form.tools.reduce((sum, tool) => sum + tool.monthlySpend, 0),
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
