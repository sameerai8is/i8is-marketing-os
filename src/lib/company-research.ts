import { isIP } from "node:net";
export class ResearchError extends Error {}
export function publicUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) throw new ResearchError("Enter the company’s public HTTPS website.");
  let u; try { u = new URL(value); } catch { throw new ResearchError("Enter a complete website URL, starting with https://."); }
  if (u.protocol !== "https:" || u.username || u.password || u.port || isIP(u.hostname.replace(/[\[\]]/g, "")) || !u.hostname.includes(".") || /\.(local|internal|localhost|test|invalid)$/.test(u.hostname) || u.hostname.endsWith(".")) throw new ResearchError("Use a public HTTPS website without credentials or a custom port.");
  u.hash = ""; return u.toString();
}
export const host = (value: string) => new URL(value).hostname.replace(/^www\./, "");
const belongs = (url: string, website: string) => host(url) === host(website) || host(url).endsWith("." + host(website));
export interface ResearchReport { summary: string; facts: { text: string; source: string }[]; competitors: { name: string; website: string; reason: string; source: string }[]; recommendations: { action: string; reason: string }[]; unknowns: string[]; }
export function sourceUrls(payload: { output?: Array<{ type?: string; action?: { sources?: { url?: string }[] }; content?: { annotations?: { url?: string }[] }[] }> }) {
  const urls: string[] = [];
  for (const o of payload.output || []) for (const item of [...(o.action?.sources || []), ...(o.content || []).flatMap(c => c.annotations || [])]) {
    try { const u = publicUrl(item.url); if (!urls.includes(u)) urls.push(u); } catch {}
  }
  return urls.slice(0, 100);
}
export function responseText(payload: { output?: { content?: { type?: string; text?: string }[] }[] }) { return (payload.output || []).flatMap(o => o.content || []).filter(c => c.type === "output_text").map(c => c.text || "").join("\n"); }
const string = { type: "string" };
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const researchSchema = object({ summary: string, facts: { type: "array", items: object({ text: string, source: string }) }, competitors: { type: "array", items: object({ name: string, website: string, reason: string, source: string }) }, recommendations: { type: "array", items: object({ action: string, reason: string }) }, unknowns: { type: "array", items: string } });
export function validateReport(value: unknown, sources: string[], website: string): ResearchReport {
  const v = value as ResearchReport;
  const text = (s: unknown, max = 1500): s is string => typeof s === "string" && !!s.trim() && s.length <= max;
  if (!v || !text(v.summary, 4000) || !Array.isArray(v.facts) || !Array.isArray(v.competitors) || !Array.isArray(v.recommendations) || !Array.isArray(v.unknowns)) throw new ResearchError("Research output was incomplete. Please retry.");
  const known = (u: unknown): u is string => { try { return sources.includes(publicUrl(u)); } catch { return false; } };
  const facts = v.facts.slice(0, 10).filter(f => text(f.text, 1000) && known(f.source) && belongs(f.source, website));
  const seen = new Set<string>();
  const competitors = v.competitors.slice(0, 8).filter(c => { try { const site = new URL(publicUrl(c.website)); if (site.pathname !== "/" || !text(c.name, 200) || !text(c.reason) || !known(c.source) || !belongs(c.source, c.website) || belongs(c.website, website) || seen.has(host(c.website))) return false; seen.add(host(c.website)); return true; } catch { return false; } });
  if (!facts.length) throw new ResearchError("No usable company claims were sourced from this website. Check the URL or add facts manually in Company DNA.");
  // Free-form summaries can reintroduce unsupported claims or competitors that
  // were removed above. Build the overview only from retained company claims.
  return { summary: facts.map(f => f.text).join("\n\n"), facts, competitors, recommendations: v.recommendations.slice(0, 8).filter(r => text(r.action, 500) && text(r.reason)), unknowns: v.unknowns.slice(0, 10).filter(s => text(s, 1000)) };
}
export async function researchRequest(key: string, body?: object, id?: string, request: typeof fetch = fetch) {
  const r = await request("https://api.openai.com/v1/responses" + (id ? "/" + encodeURIComponent(id) : ""), { method: id ? "GET" : "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(id ? 10000 : 35000) }).catch(() => { throw new ResearchError("The research provider could not be reached. Refresh to retry."); });
  if (!r.ok) throw new ResearchError(r.status === 429 ? "Research reached a usage limit. Check OpenAI billing or retry later." : "The research provider rejected the request. Check API access or retry.");
  return r.json();
}
