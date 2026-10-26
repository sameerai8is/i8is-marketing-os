import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { admitGoogleIdentity } from "@/lib/member-signin";

export function authConfigured() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_ADMIN_EMAIL);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google({ authorization: { params: { scope: "openid email profile", prompt: "select_account" } }, checks: ["pkce", "state", "nonce"] })],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      if (!authConfigured() || account?.provider !== "google" || !profile) return false;
      try { return await admitGoogleIdentity(profile); }
      catch { return "/login?error=StorageUnavailable"; }
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.email_verified === true) token.googleSubject = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.googleSubject === "string") session.user.id = token.googleSubject;
      return session;
    },
  },
  logger: {
    error() { console.error("auth.failure: sign-in could not be completed"); },
    warn(code) { console.warn("auth.warning", code); },
  },
});
