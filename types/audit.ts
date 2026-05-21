export enum UseCase {
  Coding = "coding",
  Writing = "writing",
  Data = "data",
  Research = "research",
  Mixed = "mixed",
}

export enum SupportedTool {
  Cursor = "cursor",
  GitHubCopilot = "github_copilot",
  Claude = "claude",
  ChatGPT = "chatgpt",
  AnthropicApi = "anthropic_api",
  OpenAiApi = "openai_api",
  Gemini = "gemini",
  Windsurf = "windsurf",
  V0 = "v0",
}

export enum PlanTier {
  Hobby = "hobby",
  Pro = "pro",
  Business = "business",
  Enterprise = "enterprise",
  Team = "team",
  Individual = "individual",
  Max = "max",
  Ultra = "ultra",
  ApiDirect = "api_direct",
}

export const ALL_USE_CASES: readonly UseCase[] = [
  UseCase.Coding,
  UseCase.Writing,
  UseCase.Data,
  UseCase.Research,
  UseCase.Mixed,
] as const;

export const ALL_SUPPORTED_TOOLS: readonly SupportedTool[] = [
  SupportedTool.Cursor,
  SupportedTool.GitHubCopilot,
  SupportedTool.Claude,
  SupportedTool.ChatGPT,
  SupportedTool.AnthropicApi,
  SupportedTool.OpenAiApi,
  SupportedTool.Gemini,
  SupportedTool.Windsurf,
  SupportedTool.V0,
] as const;

export const TOOL_PLAN_TIERS: Readonly<Record<SupportedTool, readonly PlanTier[]>> = {
  [SupportedTool.Cursor]: [PlanTier.Hobby, PlanTier.Pro, PlanTier.Business, PlanTier.Enterprise],
  [SupportedTool.GitHubCopilot]: [
    PlanTier.Individual,
    PlanTier.Business,
    PlanTier.Enterprise,
    PlanTier.Team,
  ],
  [SupportedTool.Claude]: [PlanTier.Pro, PlanTier.Max, PlanTier.Team, PlanTier.Enterprise],
  [SupportedTool.ChatGPT]: [PlanTier.Individual, PlanTier.Pro, PlanTier.Team, PlanTier.Enterprise],
  [SupportedTool.AnthropicApi]: [PlanTier.ApiDirect],
  [SupportedTool.OpenAiApi]: [PlanTier.ApiDirect],
  [SupportedTool.Gemini]: [PlanTier.Individual, PlanTier.Pro, PlanTier.Business, PlanTier.Enterprise],
  [SupportedTool.Windsurf]: [PlanTier.Hobby, PlanTier.Pro, PlanTier.Team, PlanTier.Business],
  [SupportedTool.V0]: [PlanTier.Hobby, PlanTier.Pro, PlanTier.Team, PlanTier.Business],
} as const;

export interface ToolSpendInput {
  tool: SupportedTool;
  plan: PlanTier;
  seats: number;
  monthlySpend: number;
}

export interface AuditFormInputState {
  teamSize: number;
  primaryUseCase: UseCase;
  tools: ToolSpendInput[];
  updatedAtIso: string;
}

export interface PublicToolSpend {
  tool: SupportedTool;
  plan: PlanTier;
  seats: number;
  monthlySpend: number;
  annualSpend: number;
}

export interface ShareableAuditPayload {
  schemaVersion: 1;
  generatedAtIso: string;
  teamSize: number;
  primaryUseCase: UseCase;
  totalMonthlySpend: number;
  totalAnnualSpend: number;
  toolBreakdown: PublicToolSpend[];
}

export type AuditFormPatch = Partial<Omit<AuditFormInputState, "tools">> & {
  tools?: ToolSpendInput[];
};
