import test from "node:test";
import assert from "node:assert/strict";
import { isCompanyIdentity, maySignIn, mayManageMember, normalizeEmail, isSameOrigin } from "../src/lib/access-policy.ts";

test("same-origin checks support local and HTTPS proxy hosts while rejecting cross-site requests", () => {
  assert.equal(isSameOrigin("http://127.0.0.1:3001", "127.0.0.1:3001", "http"), true);
  assert.equal(isSameOrigin("https://i8is-marketing-os-f7ci.vercel.app", "i8is-marketing-os-f7ci.vercel.app", "https"), true);
  assert.equal(isSameOrigin("https://attacker.test", "i8is-marketing-os-f7ci.vercel.app", "https"), false);
  assert.equal(isSameOrigin(null, "localhost:3001", "http"), false);
  assert.equal(isSameOrigin("null", "localhost:3001", "http"), false);
  assert.equal(isSameOrigin("https://safe.test", "attacker.test@safe.test", "https"), false);
});

test("company admission requires a verified Workspace identity and the exact domain", () => {
  assert.equal(isCompanyIdentity({ email: "Staff@I8IS.com", email_verified: true, hd: "i8is.com" }), true);
  for (const profile of [
    { email: "staff@i8is.com", email_verified: false, hd: "i8is.com" },
    { email: "staff@i8is.com", email_verified: true },
    { email: "staff@i8is.com.attacker.test", email_verified: true, hd: "i8is.com" },
    { email: "staff@sub.i8is.com", email_verified: true, hd: "i8is.com" },
    { email: "staff@i8is.com", email_verified: true, hd: "attacker.test" },
  ]) assert.equal(isCompanyIdentity(profile), false);
});

test("unverified identities and revoked company staff cannot sign in", () => {
  assert.equal(maySignIn({ verified: false, companyIdentity: true, status: "active" }), false);
  assert.equal(maySignIn({ verified: true, companyIdentity: true, status: "blocked" }), false);
});

test("new staff join automatically but unknown external accounts are denied", () => {
  assert.equal(maySignIn({ verified: true, companyIdentity: true }), true);
  assert.equal(maySignIn({ verified: true, companyIdentity: false }), false);
});

test("external approval is bounded by its expiry and cannot be bypassed by a company email", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  assert.equal(maySignIn({ verified: true, companyIdentity: false, status: "invited", inviteExpiresAt: new Date(now.getTime() + 1000), now }), true);
  assert.equal(maySignIn({ verified: true, companyIdentity: true, status: "invited", inviteExpiresAt: now, now }), false);
  assert.equal(maySignIn({ verified: true, companyIdentity: true, status: "invited", now }), false);
});

test("active approved identities can return and unknown statuses fail closed", () => {
  assert.equal(maySignIn({ verified: true, companyIdentity: false, status: "active" }), true);
  assert.equal(maySignIn({ verified: true, companyIdentity: true, status: "invalid" }), false);
});

test("admin cannot change their own access or the protected initial admin", () => {
  assert.equal(mayManageMember("one", "one", "staff@i8is.com", "sameera@i8is.com"), false);
  assert.equal(mayManageMember("one", "two", "sameera@i8is.com", "sameera@i8is.com"), false);
  assert.equal(mayManageMember("one", "two", "staff@i8is.com", "sameera@i8is.com"), true);
});

test("email normalization rejects invalid and ambiguous addresses", () => {
  assert.equal(normalizeEmail(" Staff@I8IS.com "), "staff@i8is.com");
  for (const value of [null, {}, "not-an-email", "staff@", "staff@@i8is.com", "staff@i8is.com\nother@i8is.com"]) assert.equal(normalizeEmail(value), null);
});
