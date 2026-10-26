import { auth, authConfigured, signIn, signOut } from "@/auth";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  AccessDenied: "This Google account cannot access the I8IS workspace. Use your company account or ask an administrator to approve your email.",
  ACCESS_DENIED: "Your workspace access is unavailable or has been revoked. Contact an administrator.",
  StorageUnavailable: "Workspace access could not be checked. The database is unavailable; please try again later.",
  STORAGE_UNAVAILABLE: "The workspace database is unavailable. Access remains protected; please try again later.",
  AUTH_NOT_CONFIGURED: "Google sign-in is being configured. Please contact your workspace administrator.",
  Configuration: "Google sign-in is being configured. Please contact your workspace administrator.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = authConfigured();
  const session = configured ? await auth() : null;
  return <main className="orbit-login">
    <section className="orbit-login-card">
      <div className="orbit-login-brand"><span aria-hidden="true">✳</span><strong>orbit</strong><small>by I8IS</small></div>
      <span className="orbit-badge orbit-badge-green">I8IS workspace</span>
      <h1>Your marketing team.<br />One shared workspace.</h1>
      <p>Sign in with your Google Workspace account. Verified <strong>@i8is.com</strong> staff can join automatically.</p>
      {(error && error !== "SIGN_IN_REQUIRED") || !configured ? <p className="orbit-login-alert" role="alert">{!configured ? messages.Configuration : messages[error || ""] || "Sign-in could not be completed. Please try again."}</p> : null}
      <form action={async () => { "use server"; if (authConfigured()) await signIn("google", { redirectTo: "/" }); }}>
        <button disabled={!configured} className="orbit-button orbit-button-dark orbit-login-submit"><span aria-hidden="true">G</span> Continue with Google</button>
      </form>
      {session?.user?.email && <div className="orbit-login-current"><p>Signed in as {session.user.email}</p><form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className="orbit-text-button">Use a different account</button></form></div>}
      <p className="orbit-login-note">Invited accounts must use the exact approved Google email address. Contact an I8IS administrator if you need access.</p>
    </section>
    <p className="orbit-login-footer">Marketing intelligence, built around your business.</p>
  </main>;
}
