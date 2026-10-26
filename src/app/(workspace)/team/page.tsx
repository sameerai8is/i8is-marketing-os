import { TeamManager } from "@/components/team-manager";
import { AccessError, requireMember } from "@/lib/authorization";

export default async function TeamPage() {
  try { await requireMember(true); }
  catch (error) {
    if (error instanceof AccessError && error.status === 403) return <div className="p-8"><h1 className="text-2xl font-semibold">Teams</h1><p className="mt-3 text-muted-foreground">Only administrators can manage workspace access.</p></div>;
    throw error;
  }
  return <TeamManager />;
}
