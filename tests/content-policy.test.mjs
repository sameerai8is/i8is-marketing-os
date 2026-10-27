import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFields, initialStatus, transition } from '../src/lib/content-policy.ts';

test('draft writes whitelist text and platform, never client tenant or delivery fields', () => {
  assert.deepEqual(draftFields({ title: ' Draft ', body: ' Text ', platform: 'linkedin', tenantId: 'attacker', publishedAt: new Date() }), { title: 'Draft', body: 'Text', platform: 'linkedin' });
  for (const v of [{}, [], null, { title: ' ', body: 'x', platform: 'linkedin' }, { title: 'x', body: 'y', platform: 'unknown' }]) assert.throws(() => draftFields(v));
});
test('creation cannot bypass approval or fabricate publication', () => {
  assert.equal(initialStatus(undefined), 'draft');
  assert.equal(initialStatus('pending_approval'), 'pending_approval');
  for (const s of ['approved', 'scheduled', 'published', 'failed']) assert.throws(() => initialStatus(s));
});
test('members submit drafts but cannot approve, reject, or schedule', () => {
  assert.deepEqual(transition('draft', 'submit', false), { status: 'pending_approval' });
  for (const action of ['approve', 'reject', 'schedule', 'unschedule']) assert.throws(() => transition('pending_approval', action, false));
});
test('admin scheduling requires reviewed content and a strictly future time', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  assert.deepEqual(transition('pending_approval', 'approve', true), { status: 'approved' });
  for (const date of [undefined, '', 'invalid', '2026-10-27T11:59:59Z', '2026-10-27T12:00:00Z']) assert.throws(() => transition('approved', 'schedule', true, date, now));
  assert.throws(() => transition('draft', 'schedule', true, '2026-10-28T12:00:00Z', now));
  assert.equal(transition('approved', 'schedule', true, '2026-10-28T12:00:00Z', now).scheduledAt.toISOString(), '2026-10-28T12:00:00.000Z');
  assert.deepEqual(transition('scheduled', 'unschedule', true), { status: 'approved' });
  assert.throws(() => transition('scheduled', 'publish', true));
});
