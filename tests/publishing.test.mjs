import test from "node:test";
import assert from "node:assert/strict";
import { BufferProvider } from "../src/lib/publishing/buffer.ts";
import { publishingOptions, validatePublishable, providerState } from "../src/lib/publishing/policy.ts";

const input = { channelId: "fixture-profile", text: "Reviewed fixture text", mode: "customScheduled", dueAt: "2026-12-01T10:00:00.000Z", assets: [{ image: { url: "https://fixture.invalid/image.png", metadata: { altText: "Fixture" } } }] };
test("Buffer submission sends the explicit profile, content, time and ordered media", async () => {
  const p = new BufferProvider("fixture-secret", "fixture-org", async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.match(body.query, /mutation OrbitPublish/);
    assert.deepEqual(body.variables.input, { ...input, schedulingType: "automatic", needsApproval: false, saveToDraft: false, source: "Orbit by I8IS" });
    return Response.json({ data: { createPost: { post: { id: "remote-1", channelId: input.channelId, text: input.text, status: "scheduled", dueAt: input.dueAt } } } });
  });
  assert.equal((await p.createPost(input)).status, "scheduled");
});
test("Instagram feed metadata and empty text-post assets use the current schema", async () => {
  const p = new BufferProvider("fixture-secret", "fixture-org", async (_url, options) => {
    const b = JSON.parse(options.body).variables.input;
    assert.deepEqual(b.metadata, { instagram: { type: "post", shouldShareToFeed: true } });
    assert.deepEqual(b.assets, []); assert.equal(b.mode, "shareNow");
    return Response.json({ data: { createPost: { post: { id: "remote-1", channelId: input.channelId, text: input.text, status: "sending", externalLink: "javascript:alert(1)" } } } });
  });
  assert.equal((await p.createPost({ ...input, mode: "shareNow", dueAt: undefined, assets: [], instagram: true })).externalLink, undefined);
});
for (const [name, response, uncertain] of [
  ["timeout", () => { throw Error("fixture-secret"); }, true],
  ["server error", () => new Response("fixture-secret", { status: 500 }), true],
  ["malformed success", () => Response.json({ data: { createPost: {} } }), true],
  ["partial GraphQL response", () => Response.json({ errors: [{ message: "fixture-secret" }], data: { createPost: { post: { id: "maybe-created" } } } }), true],
  ["rate limit", () => new Response("fixture-secret", { status: 429 }), false],
  ["denied access", () => new Response("fixture-secret", { status: 403 }), false],
  ["typed rejection", () => Response.json({ data: { createPost: { message: "fixture-secret" } } }), false],
]) test(`A ${name} has correct retry semantics and redacts provider data`, async () => {
  const p = new BufferProvider("fixture-secret", "fixture-org", async () => response());
  await assert.rejects(p.createPost(input), e => e.uncertain === uncertain && !e.message.includes("fixture-secret"));
});
test("post polling and cancellation operate on the existing provider ID", async () => {
  const p = new BufferProvider("fixture-secret", "fixture-org", async (_url, options) => {
    const b = JSON.parse(options.body); assert.deepEqual(b.variables.input, { id: "existing" });
    if (b.query.includes("OrbitCancel")) return Response.json({ data: { deletePost: { id: "existing" } } });
    assert.doesNotMatch(b.query, /mutation/);
    return Response.json({ data: { post: { id: "existing", channelId: input.channelId, text: input.text, status: "sent", sentAt: input.dueAt } } });
  });
  assert.equal((await p.getPost("existing")).status, "sent"); await p.deletePost("existing");
});
test("scheduling requires an explicit profile and time in the allowed window", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  assert.throws(() => publishingOptions({ ...input, dueAt: "2026-11-01T00:01:00Z" }, now));
  assert.throws(() => publishingOptions({ ...input, dueAt: "2027-11-01T00:00:00Z" }, now));
  assert.throws(() => publishingOptions({ ...input, channelId: "" }, now));
  assert.equal(publishingOptions(input, now).mode, "customScheduled");
});
test("unsupported media and platform limits fail before provider creation", () => {
  const p = { platform: "instagram", body: "A caption" };
  const image = { kind: "image", mime: "image/jpeg", size: 100, width: 1080, height: 1080 };
  assert.throws(() => validatePublishable(p, []));
  assert.throws(() => validatePublishable(p, [{ ...image, width: 100 }]));
  assert.throws(() => validatePublishable(p, [{ ...image, mime: "image/webp" }]));
  assert.throws(() => validatePublishable({ platform: "twitter", body: "a".repeat(281) }, []));
  assert.throws(() => validatePublishable({ platform: "linkedin", body: "Caption", imageUrl: "https://legacy.invalid/a" }, []));
  validatePublishable(p, [image]); validatePublishable({ platform: "linkedin", body: "Text post" }, []);
  assert.equal(providerState("scheduled"), "queued"); assert.equal(providerState("sent"), "published"); assert.equal(providerState("error"), "failed"); assert.equal(providerState("draft"), "attention");
});
