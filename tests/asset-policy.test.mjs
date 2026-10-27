import test from 'node:test';
import assert from 'node:assert/strict';
import { assetFields, driveLink, attachmentIds, byteRange } from '../src/lib/asset-policy.ts';

test('asset metadata is bounded and normalized without accepting ownership fields', () => {
  assert.deepEqual(assetFields({ name: ' Logo ', folder: ' Brand ', tags: ['Logo', 'logo', ' I8IS '], altText: ' Our logo ', tenantId: 'other' }), { name: 'Logo', folder: 'Brand', tags: ['logo', 'i8is'], altText: 'Our logo' });
  for (const input of [null, [], {}, { name: ' ' }, { name: 'x', tags: [''] }, { name: 'x', tags: Array(13).fill('x') }, { name: 'x', folder: 'x'.repeat(81) }]) assert.throws(() => assetFields(input));
});
test('Drive references accept file, folder and native document links while removing unrelated parameters', () => {
  const id = '1Abcdefghijklmnopqrstuvwxyz';
  assert.equal(driveLink(`https://drive.google.com/file/d/${id}/view?usp=sharing&resourcekey=key_123`).url, `https://drive.google.com/file/d/${id}/view?resourcekey=key_123`);
  assert.equal(driveLink(`https://drive.google.com/drive/u/0/folders/${id}`).folder, true);
  assert.equal(driveLink(`https://drive.google.com/open?id=${id}`).id, id);
  assert.equal(driveLink(`https://docs.google.com/presentation/d/${id}/edit`).native, true);
  for (const url of ['javascript:alert(1)', 'http://drive.google.com/file/d/'+id, 'https://drive.google.com.evil.test/file/d/'+id, 'https://localhost/file/d/'+id, 'https://user:password@drive.google.com/file/d/'+id, 'https://drive.google.com:444/file/d/'+id, 'https://drive.google.com/file/d/x']) assert.throws(() => driveLink(url));
});
test('attachment IDs cannot duplicate, exceed the limit, or inject a query', () => {
  assert.deepEqual(attachmentIds(undefined), []);
  const id = 'a'.repeat(24); assert.deepEqual(attachmentIds([id]), [id]);
  for (const v of [[id, id], Array(11).fill(id), [{ $ne: null }], ['wrong'], 'string']) assert.throws(() => attachmentIds(v));
});
test('byte ranges support media seeking and reject invalid or multiple ranges', () => {
  assert.equal(byteRange(null, 100), null);
  assert.deepEqual(byteRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(byteRange('bytes=10-', 100), { start: 10, end: 99 });
  assert.deepEqual(byteRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(byteRange('bytes=20-999', 100), { start: 20, end: 99 });
  for (const v of ['bytes=100-110', 'bytes=10-1', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'garbage']) assert.throws(() => byteRange(v, 100));
});
