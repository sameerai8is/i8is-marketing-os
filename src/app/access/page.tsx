import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import dbConnect from "@/lib/mongodb";
import { WorkspaceMember } from "@/lib/models/WorkspaceMember";
import { normalizeEmail, WORKSPACE_ID } from "@/lib/access-policy";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !session?.user?.id) redirect("/login");
  let status = "unavailable";
  try {
    await dbConnect();
    const member = await WorkspaceMember.findOne({ tenantId: WORKSPACE_ID, email, googleSubject: session.user.id });
    status = member?.status || "unavailable";
  } catch { /* Never show workspace data when storage is unavailable. */ }
  if (status === "active") redirect("/");
  return <main className="orbit-login"><section className="orbit-login-card">
    <div className="orbit-login-brand"><strong>orbit</strong><small>by I8IS</small></div>
    <h1>{status === "pending" ? "Your access request is in." : status === "blocked" ? "Access is unavailable." : "We couldn’t check your access."}</h1>
    <p>{status === "pending" ? "An I8IS administrator can now see your request in Teams. You can enter the workspace after they approve it." : status === "blocked" ? "An administrator has declined or revoked your access. Contact your I8IS contact if you need help." : "Please try again shortly. Your workspace remains protected."}</p>
    <p className="orbit-login-alert">Signed in as {email}</p>
    <Link href="/access" className="orbit-button orbit-button-dark orbit-login-submit">Check approval status</Link>
    <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className="orbit-text-button mt-4">Use a different Google account</button></form>
  </section></main>;
}
