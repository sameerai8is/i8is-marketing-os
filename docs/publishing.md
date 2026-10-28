# Buffer publishing and monitoring

## Send an approved post

1. Save a post in **Planner**, attach approved assets if needed, submit it for review and obtain administrator approval.
2. An administrator opens the saved post and chooses **Choose connected profile**. Select the exact Buffer profile matching the post's platform.
3. Choose **Publish now** or a specific local time between two minutes and 90 days away. Review the named destination, then confirm the live request.
4. Open **Publishing** to inspect the result. **Accepted by Buffer** means queued/sending, not published. **Published** is set only after Buffer returns `sent`.

Text posts work on LinkedIn, Facebook and X/Twitter. Instagram requires images. This release supports ordered JPG/PNG images, with alt text when supplied, up to 8 MiB each: four on X, nine on LinkedIn, ten on Facebook/Instagram. Instagram images must be between 4:5 and 1.91:1. Buffer and the social platform apply additional limits and may reject content. Videos, PDFs, WebP/GIF/AVIF, reels and stories can remain in drafts but are not submitted by this adapter.

The previous planner-only scheduling API remains for compatibility. Such records are labelled **Planned · not submitted** and are never automatically sent. Users must explicitly confirm a live request. Proposed campaign dates also do not authorize publishing.

## Monitor and recover

All active members can view workspace publishing history. Only active administrators can submit, retry, cancel, reconcile or check Buffer. Membership, origin, tenant, approved content, profile availability and asset readiness are checked on the server. Content stays locked once a request is reserved. A database uniqueness constraint plus a compare-and-set send lease prevent concurrent duplicate submissions across Vercel instances.

- **Rejected before creation**: Buffer definitively rejected the creation operation. Up to three explicit attempts are allowed with cooldowns (15 minutes for rate limiting, one minute otherwise). Return to draft to fix content, change timing or obtain fresh approval. There are no automatic creation retries.
- **Send unconfirmed**: a network timeout, unreadable response, server error or interrupted invocation might follow a successful creation. Another send is blocked. Find the existing post in Buffer and link its ID. Orbit verifies the bound organization/profile, exact text, creation time within five minutes and attachment count. An absent search result is not treated as proof that nothing was created. Unresolved cases require investigation in Buffer.
- **Delivery failed in Buffer**: fix or retry the existing post in Buffer, then check its status in Orbit. Orbit does not create another copy of a known remote post.
- **Cancel in Buffer**: available for confirmed scheduled posts more than five minutes from delivery. Orbit first checks the existing provider post, then requests deletion. A confirmed cancellation unlocks the approved local post. Unconfirmed cancellation remains locked and requires investigation in Buffer. Posts already sending/published cannot be cancelled here. Cancellation cannot recall a post the platform has already delivered.
- **Sync saved post** repairs the local status after a previously confirmed publication/cancellation if a database write was interrupted. It does not send content.

History records who requested and acted on publishing. Buffer post IDs and confirmed external links are retained. Raw upstream error bodies and credentials are never returned to users. Monitoring failures retain the last confirmed state and show an unavailable check; they do not fabricate successful delivery.

## Vercel configuration

Reuse the existing server-side `BUFFER_API_KEY` and `BUFFER_ORGANIZATION_ID`. Configure:

- `PUBLISHING_MEDIA_ORIGIN`: Orbit's public production HTTPS origin. Buffer must be able to fetch this endpoint without Vercel deployment protection or an interactive login.
- `CRON_SECRET`: a random server secret used by Vercel's authenticated cron request. Keep it in local/private environment settings, never source control.

`vercel.json` schedules a daily status check at 06:00 UTC, compatible with Vercel Hobby's daily cron cadence. It checks up to 20 due requests per run, with an invocation lease to avoid overlapping runs. Buffer executes the actual schedule; Orbit's cron only reads status. Administrators can check an individual post at any time. There is no claim of real-time webhook delivery tracking. Cron runs only on production deployments. Increase monitoring capacity/frequency with appropriate plan and Buffer quota before expanding usage.

Images remain private in the Asset Library. Publishing creates an HMAC-signed, per-request/per-asset download URL expiring seven days after the requested delivery time. Only the request's approved stored images are served; unsigned, expired, other-asset and cancelled-request URLs are rejected. Buffer receives this time-limited URL to fetch the actual bytes. Normal downloads still require membership. Signed URLs are bearer access and should not be shared. Rotating `AUTH_SECRET` invalidates outstanding media URLs; resolve scheduled image posts before rotation. Local image publishing requires the same database and signing secret as the public media deployment. Localhost URLs cannot be fetched by Buffer.

## Verification and limitations

`npm test` exercises provider payloads, status interpretation, redaction, uncertainty handling, dates and media constraints. `npm run test:integration` uses an isolated database and an injected fake provider to verify approval gates, concurrent submissions, locks, media bytes/ranges, cancellation, reconciliation, retries and tenant isolation. No live social mutation or invitation email is sent by these checks. A deliberate user-approved real post is still required to verify end-to-end delivery to each connected social platform.

This is an I8IS-bound provider gateway. It is not multi-customer Buffer OAuth onboarding, autonomous campaign execution, analytics collection, a durable content generation worker, or a social inbox.
