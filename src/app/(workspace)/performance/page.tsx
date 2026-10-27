import Link from "next/link";
import { requireMember } from "@/lib/authorization";
import { ContentItem } from "@/lib/models/ContentItem";
export default async function PerformancePage() {
  const actor = await requireMember();
  const counts = await ContentItem.aggregate<{ _id: string; count: number }>([{ $match: { tenantId: actor.tenantId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  const count = (status: string) => counts.find(c => c._id === status)?.count || 0;
  return <div className="orbit-team"><div className="mission-header"><div><h1>Performance Intelligence</h1><p>Your workspace content activity, drawn from saved records.</p></div></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">{[["Drafts", count("draft")], ["Awaiting approval", count("pending_approval")], ["Approved", count("approved")], ["Simulated schedules", count("scheduled")]].map(([label, value]) => <section className="orbit-surface p-5" key={label}><p className="orbit-team-note">{label}</p><strong className="text-3xl block mt-2">{value}</strong></section>)}</div><section className="orbit-surface p-6 mt-6"><h2>Social performance is not connected yet.</h2><p className="text-sm text-muted-foreground my-4">Impressions, engagement, attribution, and AI optimization insights will appear after an analytics integration is connected. These counts describe content records; they are not proof of delivery to a social platform.</p><Link href="/calendar" className="orbit-text-button">Review content in the Planner →</Link></section></div>;
}
