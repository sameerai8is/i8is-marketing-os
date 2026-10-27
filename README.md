# Orbit by I8IS

Internal marketing workspace built with Next.js 15, React 19, TypeScript, Tailwind and MongoDB/Mongoose. I8IS is the first and only onboarded tenant. The product direction is a coordinated multi-agent marketing department; autonomous orchestration is not implemented in this release.

Overview lists implemented workflows, not fictional employee personas or simulated business results. Counts come from saved workspace records; failed requests show unavailable values. Configuration badges indicate credential presence only. Buffer connection checks describe connected profiles, while publishing is explicitly simulated and social engagement metrics are unavailable.

## Available workflows

- Google Workspace sign-in: verified `i8is.com` staff join as members; the explicitly configured initial admin is bootstrapped on first sign-in.
- Verified external Google users create pending access requests. They receive a restricted session and a waiting page, with no workspace data until approved.
- Teams: search/filter/paginate people, approve/decline requests, invite people, renew invitations, change roles, revoke/restore access, copy the login link, and view recent access changes.
- Invitations are bound to the approved Google email, expire after seven days until accepted, and use optional Resend email. The shared login URL is not a bearer credential. Delivery is reported as provider accepted, failed, or not configured; acceptance by the email API is not proof of delivery.
- Planner: saved drafts, channel/status filtering, working month/week navigation, editing, deletion, previews, review submission, administrator approval, and simulated scheduling with future-date validation.
- Responsive workspace: phone agenda for scheduled posts, fluid tablet/desktop calendar, stacked member details on phones, tablet navigation drawer, and scrollable composers/asset pickers with touch-sized controls. Desktop table/calendar views retain their full layout.
- Company DNA: administrator-reviewed factual claims and references, audience and brand tone. References record administrator review, not automated source verification.
- Text generation: server-side OpenAI Responses API, reviewed facts required, source references attached to a draft, and human approval required. No autonomous publishing or factual guarantee from the model.
- Shared goals and review preferences persist in MongoDB. Analytics shows saved-content counts; social engagement metrics are not connected.
- Buffer: read-only profile discovery behind a provider gateway. No provider publishing mutation exists.
- Discover: administrator-started website and competitor research through OpenAI web search, with shared source links, candidate competitors, suggested marketing experiments, and individually reviewed company claims. Approved claims are appended to Company DNA; experiments open as Planner briefs. Research never automatically changes verified facts or publishes posts.
- Asset Library: authenticated file uploads, private previews/downloads, folders/tags/search, alt text, approval, and Google Drive file/folder references. Attach up to ten images, videos or PDFs to a draft, order them, preview them and see thumbnails in the planner. Assets must be approved before post review/scheduling.

Campaign orchestration, AI image/carousel generation, social inbox, automated analytics, durable publishing workers and additional SSO providers remain planned. These screens show their actual availability rather than fabricated sample results.

## Working with brand assets

Open **Assets** in the sidebar. Upload files or save a Google Drive file/folder link. Use **Use in a post** to start a draft, or **Choose / upload assets** inside the post composer. Administrators approve assets; any active workspace member can upload and use them. Owners/admins can change metadata or delete unused assets. Files referenced by posts cannot be deleted.

Files are stored in MongoDB GridFS, with 1 MiB upload chunks and streamed downloads, so no additional storage credential is needed. Current prototype limits: 25 MiB per file, 100 MiB reserved/uploaded files per workspace, 1,000 entries, and images up to 40 megapixels. Supported media: PNG, JPEG, WebP, GIF, AVIF, MP4/WebM and PDF. SVG, font and ZIP source files are download-only and cannot be attached to posts. File signatures are checked; image previews are generated server-side. This is not a malware scanning service. Unfinished uploads expire after an hour and their reservation is reclaimed on the next upload/import; temporary chunks also have a database TTL.

Drive links preserve Google's permissions. Individual publicly downloadable files can be imported into Orbit; private files remain references, or users can download them in Drive and upload a copy. No Drive OAuth, automatic folder sync, or permission changes are implemented. Native Docs/Slides/Sheets must be exported to a supported file before attachment. Deleting a reference/import in Orbit never deletes the Google original. Orbit copies are readable by active members of the workspace.

Post previews show media order rather than a guaranteed social-channel rendering. Scheduling remains simulated. Channel-specific media validation and delivery through Buffer require the future publishing adapter; these private file URLs are not publicly accessible delivery URLs. For larger libraries, move bytes to object storage with signed uploads/downloads and retain the asset metadata/reference layer.

## Website and competitor research

Open **Discover**, enter the company's public HTTPS website and optional market/geography, and start research as an administrator. Orbit uses the existing `OPENAI_API_KEY` and hosted web search, with `OPENAI_RESEARCH_MODEL` defaulting to `gpt-4.1-mini`. A run incurs search/model usage. Only public website details and the workspace marketing goal are sent; no browser cookies, private Drive files or application credentials are supplied to research.

Research runs in the provider's background mode with stored responses; the Discover page polls and collects the final result. Keep the page open or return as an admin to resume collection. This is user-triggered research, not a periodic crawler or autonomous background worker. One latest report is retained per workspace. Competing starts are rejected, and abandoned runs can be replaced after 15 minutes. Source URLs must occur in provider search/citation metadata, company claims must cite the company's domain, and competitor evidence must cite its proposed official domain. These checks validate provenance, not whether a claim or competitive relationship is true. Source coverage can be incomplete or pages inaccessible; the report labels analysis, hypotheses and evidence gaps.

Review each company claim and its source before adding it to Company DNA. Approval is administrator-only, version checked and additive. No competitor claims become company facts. Suggested experiments open as editable AI post prompts and still use the existing reviewed-fact generation and human approval workflow. Set `TEST_LIVE_RESEARCH=1` for a paid website/competitor integration run in the disposable test database.

Research overviews are assembled from the retained source-linked company claims so a free-form summary cannot reintroduce unsupported company details or rejected competitors. Proposed competitor websites must be homepage URLs, not directory/profile paths. Supporting links remain unreviewed evidence; a matching hostname does not establish website ownership or a true competitive relationship. AI experiment suggestions are labeled as proposals rather than confirmed company plans.

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

`check` runs lint, TypeScript and a production build. Integration tests require a completed build plus a MongoDB credential that can create/drop a randomly named disposable test database. They start an isolated server on port 3101, use test-only fixture sessions, and remove the test database in a finally block. They exercise asset uploads, byte/range integrity, private downloads, invalid formats, permissions, approvals, post attachments, Drive references and quota cleanup. They never write live workspace data or send invitation emails/social posts. Set `TEST_LIVE_AI=1` to opt into one paid AI draft generation inside the disposable database. Real Google consent, real Drive download permissions and external email delivery require separate provider/browser checks.

## Production deployment

Import `sameerai8is/i8is-marketing-os` into Vercel, use Node 22 and the default Next.js output. Set server environment variables before deployment, with production URLs as above, and redeploy after env changes. MongoDB Atlas must permit the deployment's connection; working local connectivity does not prove cloud connectivity.

Release checks: anonymous dashboard requests redirect to login; anonymous data APIs return 401; pending/blocked users cannot read data; admin Teams loads; a real second Google account can request access and be approved; approved posts can be scheduled only in simulation; Buffer metadata is not public.

Member, content, settings, audit and rate-limit operations are workspace-scoped. The I8IS workspace, company domain and Buffer credentials are fixed server bindings. All models include tenant ownership, but additional organizations still require an onboarding/credential design. Legacy content without a tenant is excluded; no automatic migration occurs.

Security properties: live role/status and Google subject checks on protected requests; PKCE/state/nonce through Auth.js; same-origin mutations; input whitelists; shared database-backed mutation limits; optimistic update conflicts; protected bootstrap administrator. Published/failed statuses cannot be assigned through composer APIs. Editing an approved/scheduled post invalidates approval and removes its schedule. Known limitations: provider access changes are checked at next Google sign-in; existing sessions expire after eight hours unless revoked in Orbit; AI requires human claim review; email delivery webhooks and enterprise SAML are not implemented.

## Google Drive

See [Google Drive setup](docs/google-drive.md) to enable private file browsing/imports and optional copies of new uploads to each user's own My Drive. This uses the existing Google OAuth client with additional consent, not an API key. Imported files are shared workspace copies; Drive originals keep their permissions.
