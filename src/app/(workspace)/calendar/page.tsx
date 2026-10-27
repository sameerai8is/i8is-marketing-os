import { ContentPlanner } from "@/components/content-planner";
import { requireMember } from "@/lib/authorization";
import { ContentItem } from "@/lib/models/ContentItem";

export default async function CalendarPage() {
  const actor = await requireMember();
  let items = [], error = "";
  try { items = JSON.parse(JSON.stringify(await ContentItem.find({ tenantId: actor.tenantId }).sort({ updatedAt: -1, _id: -1 }).limit(500).lean())); }
  catch { error = "Posts could not be loaded. Please refresh."; }
  return <ContentPlanner initialItems={items} initialError={error} admin={actor.role === "admin"} />;
}
