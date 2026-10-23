import test from "node:test";
import assert from "node:assert/strict";
import { BufferProvider, PublishingError } from "../src/lib/publishing/buffer.ts";

test("profile discovery targets only the bound organization and sends no publishing mutation", async () => {
  const provider = new BufferProvider("test-secret", "i8is-org", async (url, options) => {
    assert.equal(url, "https://api.buffer.com");
    assert.equal(options.headers.Authorization, "Bearer test-secret");
    assert.equal(options.cache, "no-store");
    const body = JSON.parse(options.body);
    assert.deepEqual(body.variables, { input: { organizationId: "i8is-org" } });
    assert.doesNotMatch(body.query, /mutation/);
    return Response.json({ data: { channels: [{
      id: "profile-1", name: "i8is", displayName: "I8IS", service: "linkedin",
      isDisconnected: true, isLocked: true, isQueuePaused: true,
    }] } });
  });
  assert.deepEqual(await provider.listChannels(), [{
    id: "profile-1", name: "I8IS", platform: "linkedin", connected: false, locked: true, queuePaused: true,
  }]);
});

test("an organization without profiles is a valid connection", async () => {
  const provider = new BufferProvider("test-secret", "i8is-org", async () => Response.json({ data: { channels: [] } }));
  assert.deepEqual(await provider.listChannels(), []);
});

for (const [status, code] of [[401, "BUFFER_AUTH"], [403, "BUFFER_AUTH"], [429, "BUFFER_RATE_LIMIT"], [500, "BUFFER_UPSTREAM"]]) {
  test(`HTTP ${status} is handled without leaking the upstream response`, async () => {
    const provider = new BufferProvider("test-secret", "i8is-org", async () => new Response("private-upstream-data", { status }));
    await assert.rejects(provider.listChannels(), error => error instanceof PublishingError && error.code === code && !error.message.includes("private-upstream-data"));
  });
}

test("GraphQL errors discard partial data and redact upstream details", async () => {
  const provider = new BufferProvider("test-secret", "i8is-org", async () => Response.json({ errors: [{ message: "test-secret" }], data: { channels: [] } }));
  await assert.rejects(provider.listChannels(), error => error.code === "BUFFER_QUERY" && !error.message.includes("test-secret"));
});

test("network failures do not expose the API key", async () => {
  const provider = new BufferProvider("test-secret", "i8is-org", async () => { throw new Error("test-secret"); });
  await assert.rejects(provider.listChannels(), error => error.code === "BUFFER_UNAVAILABLE" && !error.message.includes("test-secret"));
});

test("malformed JSON is rejected", async () => {
  const provider = new BufferProvider("test-secret", "i8is-org", async () => new Response("not-json"));
  await assert.rejects(provider.listChannels(), { code: "BUFFER_RESPONSE" });
});

test("incomplete channel status is rejected instead of showing a false connection", async () => {
  const provider = new BufferProvider("test-secret", "i8is-org", async () => Response.json({ data: { channels: [{ id: "profile-1" }] } }));
  await assert.rejects(provider.listChannels(), { code: "BUFFER_RESPONSE" });
});
