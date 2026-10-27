import "server-only";

export function appUrl() {
  const url = new URL(process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000");
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid application URL");
  return url.origin;
}

export async function sendAccessEmail(email: string, approved: boolean, key: string): Promise<"accepted" | "failed" | "not_configured"> {
  if (!process.env.RESEND_API_KEY || !process.env.INVITE_FROM_EMAIL) return "not_configured";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `orbit-access-${key}` },
      body: JSON.stringify({ from: process.env.INVITE_FROM_EMAIL, to: [email], subject: approved ? "Your Orbit workspace access is approved" : "You’re invited to Orbit by I8IS", text: `${approved ? "Your access to Orbit has been approved." : "An I8IS administrator has invited you to Orbit. Accept within seven days."}\n\nSign in with this exact Google email address: ${email}\n${appUrl()}/login\n\nIf you were not expecting this, you can ignore this email.` }),
    });
    return response.ok ? "accepted" : "failed";
  } catch { return "failed"; }
}
