import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AccessError, requireMember } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  let member;
  try { member = await requireMember(); }
  catch (error) {
    if (error instanceof AccessError) redirect(error.status === 403 ? "/access" : `/login?error=${error.code}`);
    throw error;
  }
  return <AppShell member={member}>{children}</AppShell>;
}
