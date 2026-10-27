import test from 'node:test';
import assert from 'node:assert/strict';
import { publicUrl, sourceUrls, validateReport, researchRequest } from '../src/lib/company-research.ts';
test('research URLs exclude credentials, private hosts, ports and active schemes', () => {
  for (const url of ['http://company.com','https://localhost','https://127.0.0.1','https://[::1]','https://a.local','https://user:pass@company.com','https://company.com:8443','javascript:alert(1)']) assert.throws(() => publicUrl(url));
  assert.equal(publicUrl('https://company.com/about#team'), 'https://company.com/about');
});
test('research evidence comes from provider source metadata, not invented report URLs', () => {
  const urls = sourceUrls({ output: [{ action: { sources: [{ url: 'https://company.com/about' }, { url: 'javascript:alert(1)' }] }, content: [{ annotations: [{ url: 'https://rival.com/services' }] }] }] });
  assert.equal(urls.length, 2);
  const report = { summary: 'Analysis', facts: [{ text: 'Builds software', source: urls[0] }, { text: 'Invented', source: 'https://invented.com/' }, { text: 'Competitor fact', source: urls[1] }], competitors: [{ name: 'Rival', website: 'https://rival.com', reason: 'Service overlap', source: urls[1] }, { name: 'Self', website: 'https://company.com', reason: 'Same company', source: urls[0] }, { name: 'Unsourced', website: 'https://fake.com', reason: 'Guess', source: urls[1] }], recommendations: [{ action: 'Try a post', reason: 'Hypothesis' }], unknowns: ['Market share unknown'] };
  const cleaned = validateReport(report, urls, 'https://company.com'); assert.equal(cleaned.facts.length, 1); assert.equal(cleaned.competitors.length, 1);
  assert.throws(() => validateReport({ ...report, facts: [] }, urls, 'https://company.com'), /No usable company/);
});
test('research provider errors never expose credentials or upstream bodies', async () => {
  await assert.rejects(researchRequest('private-key', {}, undefined, async () => new Response('secret provider details', { status: 401 })), e => !e.message.includes('secret') && !e.message.includes('private-key'));
});
test('unsupported summary claims and third-party company profiles cannot appear as supported company evidence', () => {
  const profile = 'https://directory.example.com/companies/rival?utm_source=search';
  const sources = ['https://company.com/about', profile, 'https://rival.com/services'];
  const report = { summary: 'Founded in 1900 with invented customer numbers. Rival is a confirmed competitor.', facts: [{ text: 'Builds software', source: sources[0] }], competitors: [{ name: 'Rival', website: profile, reason: 'Claimed overlap', source: profile }, { name: 'Another rival', website: 'https://rival.com/?utm_source=search', reason: 'Proposed overlap', source: sources[2] }], recommendations: [], unknowns: [] };
  const result = validateReport(report, sources, 'https://company.com/');
  assert.equal(result.summary, 'Builds software'); assert.equal(result.competitors.length, 1); assert.equal(result.competitors[0].name, 'Another rival');
  assert.ok(!result.summary.includes('1900')); assert.ok(!result.summary.includes('confirmed competitor'));
});
