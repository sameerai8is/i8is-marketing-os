# Strategy, campaigns and approvals

## Create a strategy

Open **Strategy → New strategy**. Choose a primary goal (leads, awareness, traffic, product/service promotion, recruitment, engagement or custom), optional secondary goals, an offering, audience, geography, channels and a 7, 30 or 90 day planning period.

Save the brief, then generate a strategy. Generation uses the existing server-side OpenAI configuration and administrator-reviewed Company DNA facts. Competitor research is supplied as unreviewed context; it is not promoted to company evidence. Review positioning, themes, channel cadence, campaign ideas, proposed measures, assumptions and information gaps. Targets are planning proposals, not collected analytics.

Edit the generated plan and save your changes. Submit it for administrator approval. Editing an approved plan creates a draft revision. Changing the brief clears the old generated plan so it can be regenerated for the new inputs. Existing post drafts keep their copy, source references and original strategy revision.

## Review work

**Approvals** has separate post, asset and strategy queues, with awaiting-review, feedback/changes and approved views. Filter by reviews assigned to you. Members can read and comment; administrators assign reviews to active administrators and approve or request changes. An assigned review must be handled by that administrator or reassigned first.

Comments record the saved version they refer to. Their author or an administrator can resolve them. Open comments block approval, including approval attempted from Planner or the asset editor. Requesting strategy or asset changes requires a reason; the central inbox also requires a reason for post changes. The existing Planner's request-changes action remains available. The discussion shows recent decision history, while all review decisions remain in the audit log.

Post approval still requires approved attachments. Changing an approved asset's metadata resets its approval. If it is used by a post outside draft, return the linked posts to draft before changing it.

## Generate campaign drafts

Once the strategy is approved, use **Campaigns** or its strategy detail to generate one draft per starter idea, or generate all of them. Each request uses the current approved strategy revision and still-reviewed source facts. Retrying an existing idea returns the same saved post, preventing duplicate drafts and unnecessary provider calls.

Drafts appear in Planner on **proposed dates**. These dates can be changed or cleared in the post editor. They are separate from publishing schedules. Each generated post remains a draft and needs its own content/asset review before scheduling. Starter ideas do not automatically fill every slot in the recommended cadence. Graphics must be chosen or uploaded through Assets; this feature generates text, not images.

Approved posts can be sent through Buffer with separate administrator confirmation; see [Publishing and monitoring](publishing.md). Strategy approval alone does not send anything. Campaign performance metrics are not collected.

## Verification

`npm test` covers strategy input/output validation, allowed transitions, structured AI responses and proposed-date rules. `npm run test:integration` includes reviewer assignment, feedback resolution, source removal, stale revisions, tenant isolation, duplicate campaign requests, and post/asset approval behavior. Its fixtures live only in an isolated disposable database and do not call the strategy provider.
