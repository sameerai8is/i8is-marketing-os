/* eslint-disable @typescript-eslint/no-require-imports -- Isolated integration fixtures. */
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
module.exports = async ({ check, db, regularCookie, ownerCookie, mutation, patch }) => {
  await check('anonymous research denied', '/api/research', 401);
  await check('member cannot start paid research', '/api/research', 403, mutation({ action: 'start' }), regularCookie);
  await check('invalid website rejected before provider call', '/api/research', 400, mutation({ action: 'start', website: 'https://127.0.0.1', companyName: 'Test', market: '' }), ownerCookie);
  const id = new ObjectId();
  await db.collection('researchruns').insertOne({ _id: id, tenantId: 'i8is', status: 'ready', website: 'https://example.com/', companyName: 'Test', market: '', sources: ['https://example.com/'], responseId: 'private-provider-reference', report: { summary: 'Test analysis', facts: [{ text: 'Research fixture claim', source: 'https://example.com/' }], competitors: [], recommendations: [], unknowns: [] }, createdAt: new Date(), updatedAt: new Date() });
  const read = await (await check('members can read shared research', '/api/research', 200, {}, regularCookie)).json(); assert.equal(read.run.responseId, undefined);
  const researchVersion = read.run.updatedAt;
  await check('research page renders report shell', '/research', 200, {}, regularCookie);
  await check('member cannot approve researched fact', '/api/research', 403, patch({ runId: String(id), index: 0, confirmVerified: true }), regularCookie);
  const settings = await db.collection('workspacesettings').findOne({ tenantId: 'i8is' });
  await check('research claim requires review confirmation', '/api/research', 400, patch({ runId: String(id), index: 0, updatedAt: settings.updatedAt.toISOString() }), ownerCookie);
  await check('stale fact approval cannot overwrite DNA', '/api/research', 409, patch({ runId: String(id), researchVersion, index: 0, confirmVerified: true }), ownerCookie);
  await check('changed research version requires fresh review', '/api/research', 409, patch({ runId: String(id), researchVersion: 'stale', index: 0, confirmVerified: true, updatedAt: settings.updatedAt.toISOString() }), ownerCookie);
  await check('admin adds reviewed claim without replacing DNA', '/api/research', 200, patch({ runId: String(id), researchVersion, index: 0, confirmVerified: true, updatedAt: settings.updatedAt.toISOString() }), ownerCookie);
  const updated = await db.collection('workspacesettings').findOne({ tenantId: 'i8is' }); assert.equal(updated.facts.length, settings.facts.length + 1); assert.equal(updated.facts.at(-1).verifiedBy, 'sameera@i8is.com');
  await check('invalid research ID rejected', '/api/research', 400, patch({ runId: 'bad', index: 0, confirmVerified: true }), ownerCookie);
  if (process.env.TEST_LIVE_RESEARCH === '1') {
    let live = await (await check('live website research starts', '/api/research', 200, mutation({ action: 'start', companyName: 'I8IS', website: 'https://i8is.com/', market: 'Software development services in North America' }), ownerCookie)).json();
    for (let n = 0; n < 60 && live.run.status === 'running'; n++) { await new Promise(r => setTimeout(r, 4000)); live = await (await check('collect live research ' + n, '/api/research', 200, mutation({ action: 'advance' }), ownerCookie)).json(); }
    assert.equal(live.run.status, 'ready'); assert.ok(live.run.report.facts.length); assert.ok(live.run.sources.length); console.log('PASS live website research with ' + live.run.report.competitors.length + ' competitor candidates and source-validated company facts.');
  }
};
