import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as policy from '../src/lib/content-policy.ts';
const compiledModule = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/ai-draft.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require', 'module', 'exports', code)(() => policy, compiledModule, compiledModule.exports);
const { generateDraft } = compiledModule.exports;
const input = { prompt: 'Introduce the team', platform: 'linkedin', companyName: 'Fixture', audience: 'Test readers', tone: 'Clear', facts: [{ text: 'Fixture builds software', source: 'Fixture brief' }] };
const success = value => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }));

test('AI cannot be called without reviewed company facts', async () => {
  await assert.rejects(generateDraft({ ...input, facts: [] }, 'test-key', () => { throw new Error('Must not call upstream'); }), /reviewed facts/);
});
test('AI draft sends only a generation request and preserves validated references', async () => {
  const draft = await generateDraft(input, 'test-key', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.equal(payload.text.format.type, 'json_schema');
    return success({ title: 'Hello', body: 'We build software.', factIds: [0] });
  });
  assert.equal(draft.platform, 'linkedin');
  assert.deepEqual(draft.sourceFacts, input.facts);
  assert.equal(draft.status, undefined);
});
test('AI rejects unsupported fact references, refusal, and malformed output', async () => {
  for (const ids of [[], [-1], [9], ['0']]) await assert.rejects(generateDraft(input, 'test-key', async () => success({ title: 'x', body: 'y', factIds: ids })), /valid source/);
  await assert.rejects(generateDraft(input, 'test-key', async () => new Response('{}')), /valid source/);
});
test('AI failures redact raw provider errors and credentials', async () => {
  for (const status of [401, 403, 429, 500]) await assert.rejects(generateDraft(input, 'test-key', async () => new Response('sensitive upstream text', { status })), e => !e.message.includes('sensitive') && !e.message.includes('test-key'));
});
