# Orbit by I8IS

Internal marketing workspace built with Next.js 15, React 19, TypeScript, Tailwind and MongoDB/Mongoose. I8IS is the first and only onboarded tenant. The product direction is a coordinated multi-agent marketing department; autonomous orchestration is not implemented in this release.

## Available workflows

- Google Workspace sign-in: verified `i8is.com` staff join as members; the explicitly configured initial admin is bootstrapped on first sign-in.
- Verified external Google users create pending access requests. They receive a restricted session and a waiting page, with no workspace data until approved.
- Teams: search/filter/paginate people, approve/decline requests, invite people, renew invitations, change roles, revoke/restore access, copy the login link, and view recent access changes.
- Invitations are bound to the approved Google email, expire after seven days until accepted, and use optional Resend email. The shared login URL is not a bearer credential. Delivery is reported as provider accepted, failed, or not configured; acceptance by the email API is not proof of delivery.
- Planner: saved drafts, channel/status filtering, working month/week navigation, editing, deletion, previews, review submission, administrator approval, and simulated scheduling with future-date validation.
- Company DNA: administrator-reviewed factual claims and references, audience and brand tone. References record administrator review, not automated source verification.
- Text generation: server-side OpenAI Responses API, reviewed facts required, source references attached to a draft, and human approval required. No autonomous publishing or factual guarantee from the model.
- Shared goals and review preferences persist in MongoDB. Analytics shows saved-content counts; social engagement metrics are not connected.
- Buffer: read-only profile discovery behind a provider gateway. No provider publishing mutation exists.

Campaign orchestration, image/carousel generation, assets, social inbox, automated analytics, durable publishing workers and additional SSO providers remain planned. These screens show their actual availability rather than fabricated sample results.

## Local setup

Requires Node.js 22.x. Use `npm.cmd`/`npx.cmd` on PowerShell if script execution policy blocks npm.ps1.

```sh
npm ci
npm run dev
```

Configure ignored `.env.local` using `.env.example` as a placeholder-only reference. Never put real values in tracked files or `NEXT_PUBLIC_` variables.

Required for application access:

- `MONGODB_URI`: reachable MongoDB/Atlas database.
- `AUTH_SECRET`: cryptographically random session secret, at least 32 bytes.
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`: Google OAuth Web application credentials.
- `AUTH_ADMIN_EMAIL`: explicitly authorized initial administrator, currently `sameera@i8is.com`.
- Local `AUTH_URL=http://localhost:3000`; production `AUTH_URL` and `APP_URL` must equal the stable HTTPS application origin.

Optional integrations:

- `BUFFER_API_KEY`, `BUFFER_ORGANIZATION_ID`: profile discovery.
- `OPENAI_API_KEY`: server-owned text generation; `OPENAI_MODEL` defaults to `gpt-4.1-mini`.
- `RESEND_API_KEY`, `INVITE_FROM_EMAIL`: invitation/approval emails. Sender must be verified in Resend. Without these, admins share the copyable login link.

Google OAuth JavaScript origins (no path/trailing slash):

```text
http://localhost:3000
https://i8is-marketing-os-f7ci.vercel.app
```

Google authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://i8is-marketing-os-f7ci.vercel.app/api/auth/callback/google
```

The Google OAuth audience must allow external identities if inviting people outside I8IS. Orbit still requires membership approval. Google sign-in already provides Workspace SSO; Microsoft/SAML are not configured.

## Verification

```sh
npm test
npm run check
npm run test:integration
```

`check` runs lint, TypeScript and a production build. Integration tests require a completed build plus a MongoDB credential that can create/drop a randomly named disposable test database. They start an isolated server on port 3101, use test-only fixture sessions, and remove the test database in a finally block. They never write live workspace data or send invitation emails/social posts. Set `TEST_LIVE_AI=1` to opt into one paid AI draft generation inside the disposable database. Real Google consent and external email delivery require separate provider/browser checks.

## Production deployment

Import `sameerai8is/i8is-marketing-os` into Vercel, use Node 22 and the default Next.js output. Set server environment variables before deployment, with production URLs as above, and redeploy after env changes. MongoDB Atlas must permit the deployment's connection; working local connectivity does not prove cloud connectivity.

Release checks: anonymous dashboard requests redirect to login; anonymous data APIs return 401; pending/blocked users cannot read data; admin Teams loads; a real second Google account can request access and be approved; approved posts can be scheduled only in simulation; Buffer metadata is not public.

Member, content, settings, audit and rate-limit operations are workspace-scoped. The I8IS workspace, company domain and Buffer credentials are fixed server bindings. All models include tenant ownership, but additional organizations still require an onboarding/credential design. Legacy content without a tenant is excluded; no automatic migration occurs.

Security properties: live role/status and Google subject checks on protected requests; PKCE/state/nonce through Auth.js; same-origin mutations; input whitelists; shared database-backed mutation limits; optimistic update conflicts; protected bootstrap administrator. Published/failed statuses cannot be assigned through composer APIs. Editing an approved/scheduled post invalidates approval and removes its schedule. Known limitations: provider access changes are checked at next Google sign-in; existing sessions expire after eight hours unless revoked in Orbit; AI requires human claim review; email delivery webhooks and enterprise SAML are not implemented.
