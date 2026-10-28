import { platforms } from "./content-policy";

export const strategyGoals = [
  { value: "leads", label: "Generate qualified leads", metric: "Qualified inquiries" },
  { value: "awareness", label: "Build brand awareness", metric: "Reach and relevant engagement" },
  { value: "traffic", label: "Drive website traffic", metric: "Visits from campaign links" },
  { value: "promotion", label: "Promote a product or service", metric: "Offer inquiries or conversions" },
  { value: "recruitment", label: "Attract candidates", metric: "Qualified applications" },
  { value: "engagement", label: "Grow community engagement", metric: "Meaningful comments and conversations" },
  { value: "custom", label: "Custom goal", metric: "Your chosen measure" },
] as const;
export type StrategyGoal = typeof strategyGoals[number]["value"];
export type StrategyStatus = "draft" | "pending_approval" | "changes_requested" | "approved";
export class StrategyError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export interface StrategyBrief {
  title: string; goal: StrategyGoal; secondaryGoals: StrategyGoal[]; objective: string; offering: string;
  audience: string; geography: string; channels: string[]; durationDays: number; startDate: string;
}
export interface StrategyPlan {
  positioning: string;
  pillars: { name: string; rationale: string; angles: string[] }[];
  channels: { platform: string; rationale: string; postsPerWeek: number }[];
  campaigns: { name: string; brief: string; platform: string; format: string; cta: string; assets: string; day: number; factIds: number[] }[];
  measures: { name: string; target: string; method: string }[];
  assumptions: string[]; gaps: string[];
}
function text(value: unknown, name: string, max: number, required = true) {
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new StrategyError(`${name} ${required ? "is required and" : ""} allows up to ${max} characters.`);
  return value.trim();
}
function list(value: unknown, name: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new StrategyError(`${name} needs ${min}-${max} entries.`);
  return value;
}
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new StrategyError("Check the strategy fields."); return value as Record<string, unknown>; }
export function strategyBrief(value: unknown): StrategyBrief {
  const b = record(value);
  if (!strategyGoals.some(g => g.value === b.goal)) throw new StrategyError("Choose a strategy goal.");
  const secondary = list(b.secondaryGoals || [], "Secondary goals", 0, 3);
  if (secondary.some(g => !strategyGoals.some(x => x.value === g) || g === b.goal) || new Set(secondary).size !== secondary.length) throw new StrategyError("Choose up to three different secondary goals.");
  const channels = list(b.channels, "Channels", 1, 4);
  if (channels.some(p => !platforms.includes(p as typeof platforms[number])) || new Set(channels).size !== channels.length) throw new StrategyError("Choose supported, distinct channels.");
  if (![7, 30, 90].includes(Number(b.durationDays))) throw new StrategyError("Choose a 7, 30 or 90 day plan.");
  if (typeof b.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.startDate) || !Number.isFinite(Date.parse(b.startDate)) || new Date(b.startDate).toISOString().slice(0, 10) !== b.startDate) throw new StrategyError("Choose a valid start date.");
  return { title: text(b.title, "Title", 200), goal: b.goal as StrategyGoal, secondaryGoals: secondary as StrategyGoal[], objective: text(b.objective, "Objective", 1000), offering: text(b.offering, "Offering", 1000), audience: text(b.audience, "Audience", 1500), geography: text(b.geography || "", "Geography", 500, false), channels: channels as string[], durationDays: Number(b.durationDays), startDate: b.startDate };
}
export function strategyPlan(value: unknown, brief: StrategyBrief, factCount: number): StrategyPlan {
  const p = record(value);
  const strs = (v: unknown, name: string, min: number, max: number, chars = 600) => list(v, name, min, max).map(x => text(x, name, chars));
  return {
    positioning: text(p.positioning, "Positioning", 2000),
    pillars: list(p.pillars, "Content themes", 1, 6).map(v => { const x = record(v); return { name: text(x.name, "Theme", 150), rationale: text(x.rationale, "Theme rationale", 1000), angles: strs(x.angles, "Content angles", 1, 5) }; }),
    channels: list(p.channels, "Channel plan", 1, 4).map(v => { const x = record(v); if (!brief.channels.includes(String(x.platform)) || !Number.isInteger(x.postsPerWeek) || Number(x.postsPerWeek) < 1 || Number(x.postsPerWeek) > 14) throw new StrategyError("Channel cadence must use your selected channels and 1-14 posts per week."); return { platform: String(x.platform), rationale: text(x.rationale, "Channel rationale", 1000), postsPerWeek: Number(x.postsPerWeek) }; }),
    campaigns: list(p.campaigns, "Campaign ideas", 1, 12).map(v => { const x = record(v); if (!brief.channels.includes(String(x.platform)) || !Number.isInteger(x.day) || Number(x.day) < 1 || Number(x.day) > brief.durationDays) throw new StrategyError("Campaign ideas must use selected channels and dates inside the plan."); const ids = list(x.factIds, "Fact references", 1, 20); if (ids.some(n => !Number.isInteger(n) || Number(n) < 0 || Number(n) >= factCount)) throw new StrategyError("Each campaign needs valid reviewed fact references."); return { name: text(x.name, "Campaign name", 200), brief: text(x.brief, "Campaign brief", 1500), platform: String(x.platform), format: text(x.format, "Format", 150), cta: text(x.cta, "Call to action", 500), assets: text(x.assets, "Asset requirements", 800), day: Number(x.day), factIds: [...new Set(ids as number[])] }; }),
    measures: list(p.measures, "Success measures", 1, 6).map(v => { const x = record(v); return { name: text(x.name, "Measure", 150), target: text(x.target, "Proposed target", 500), method: text(x.method, "Measurement method", 800) }; }),
    assumptions: strs(p.assumptions, "Assumptions", 0, 10, 1000), gaps: strs(p.gaps, "Information gaps", 0, 10, 1000),
  };
}
export function strategyTransition(status: string, action: string, admin: boolean) {
  if (action === "submit" && ["draft", "changes_requested"].includes(status)) return "pending_approval" as const;
  if (!admin) throw new StrategyError("An administrator must review strategies.", 403);
  if (action === "approve" && status === "pending_approval") return "approved" as const;
  if (action === "reject" && status === "pending_approval") return "changes_requested" as const;
  throw new StrategyError("This action is unavailable for the current strategy status.", 409);
}
