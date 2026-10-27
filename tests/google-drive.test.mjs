import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as policy from '../src/lib/asset-policy.ts';
import * as drivePolicy from '../src/lib/drive-policy.ts';
import * as vault from '../src/lib/drive-vault.ts';
const secret = 'drive-test-secret-'.repeat(4), actor = { tenantId: 'tenant-a', email: 'person@example.test', id: 'member-a', role: 'member' };
function service() {
  const c = { tenantId: actor.tenantId, email: actor.email, googleSubject: 'subject-a', scope: `${drivePolicy.DRIVE_READ_SCOPE} ${drivePolicy.DRIVE_FILE_SCOPE}`, expiresAt: new Date(Date.now() + 3600000), accessToken: vault.sealDriveToken('fixture-access-token', secret, `${actor.tenantId}:${actor.email}:subject-a`) };
  const compiled = { exports: {} };
  const dependencies = {
    './asset-policy': policy, './drive-policy': drivePolicy, './drive-vault': vault,
    './models/WorkspaceMember': { WorkspaceMember: { findOne: filter => { assert.deepEqual(filter, { tenantId: actor.tenantId, email: actor.email, status: 'active' }); return { select: async () => ({ googleSubject: 'subject-a' }) }; } } },
    './models/DriveConnection': { DriveConnection: { findOne: filter => { assert.deepEqual(filter, { tenantId: actor.tenantId, email: actor.email, googleSubject: 'subject-a' }); return { select: async () => c }; } } },
  };
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/google-drive.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => dependencies[name] || {}, compiled, compiled.exports);
  return compiled.exports;
}
test('Drive private downloads use live identity, fixed host and bounded file metadata', async () => {
  const oldFetch = globalThis.fetch, oldSecret = process.env.AUTH_SECRET; process.env.AUTH_SECRET = secret;
  try {
    const calls = []; globalThis.fetch = async (url, options) => {
      calls.push(url); assert.equal(new URL(url).origin, 'https://www.googleapis.com'); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer fixture-access-token');
      return calls.length === 1 ? Response.json({ name: 'Private brand.png', mimeType: 'image/png', size: '3', capabilities: { canDownload: true } }) : new Response(new Uint8Array([1, 2, 3]));
    };
    const result = await service().downloadConnectedDriveFile(actor, 'abcdefghijklmno'); assert.equal(result.filename, 'Private brand.png'); assert.equal(result.data.length, 3); assert.equal(calls.length, 2);
    await assert.rejects(service().downloadConnectedDriveFile(actor, 'https://attacker.test')); assert.equal(calls.length, 2);
  } finally { globalThis.fetch = oldFetch; if (oldSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = oldSecret; }
});
test('Drive native documents export as PDF; download restrictions are respected', async () => {
  const oldFetch = globalThis.fetch, oldSecret = process.env.AUTH_SECRET; process.env.AUTH_SECRET = secret;
  try {
    let calls = 0; globalThis.fetch = async url => { calls++; if (calls === 1) return Response.json({ name: 'Brand guidelines', mimeType: 'application/vnd.google-apps.document', capabilities: { canDownload: true } }); assert.ok(url.endsWith('/export?mimeType=application%2Fpdf')); return new Response('%PDF'); };
    const result = await service().downloadConnectedDriveFile(actor, 'abcdefghijklmno'); assert.equal(result.filename, 'Brand guidelines.pdf');
    globalThis.fetch = async () => Response.json({ name: 'Blocked.pdf', mimeType: 'application/pdf', capabilities: { canDownload: false } });
    await assert.rejects(service().downloadConnectedDriveFile(actor, 'abcdefghijklmno'), /allowed to download/);
  } finally { globalThis.fetch = oldFetch; if (oldSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = oldSecret; }
});
test('Drive uploads never forward credentials to an unexpected resumable endpoint', async () => {
  const oldFetch = globalThis.fetch, oldSecret = process.env.AUTH_SECRET; process.env.AUTH_SECRET = secret;
  try {
    let calls = 0; globalThis.fetch = async () => { calls++; return new Response(null, { headers: { Location: 'https://attacker.test/upload' } }); };
    await assert.rejects(service().copyFileToDrive(actor, { name: 'New.png', mime: 'image/png', data: Buffer.from('fixture'), assetId: 'asset-a' }), /unsupported upload endpoint/); assert.equal(calls, 1);
  } finally { globalThis.fetch = oldFetch; if (oldSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = oldSecret; }
});
