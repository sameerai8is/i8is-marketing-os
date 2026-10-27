import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as policy from '../src/lib/asset-policy.ts';
const compiledModule = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/drive-import.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require', 'module', 'exports', code)(name => name === './asset-policy' ? policy : {}, compiledModule, compiledModule.exports);
const { downloadDriveFile } = compiledModule.exports;
const url = 'https://drive.google.com/file/d/1Abcdefghijklmnopqrstuvwxyz/view';
test('public Drive downloads use a fixed Google endpoint and no user credentials', async () => {
  const result = await downloadDriveFile(url, async (endpoint, options) => {
    assert.equal(new URL(endpoint).hostname, 'drive.usercontent.google.com');
    assert.equal(options.redirect, 'manual'); assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers.Cookie, undefined);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="test.png"' } });
  });
  assert.equal(result.filename, 'test.png'); assert.deepEqual([...result.data], [1, 2, 3]);
});
test('Drive redirects cannot reach private IPs or attacker-controlled hosts', async () => {
  for (const location of ['http://127.0.0.1/private', 'https://169.254.169.254/latest', 'https://attacker.test/file']) {
    let requests = 0;
    await assert.rejects(downloadDriveFile(url, async () => { requests++; return new Response(null, { status: 302, headers: { Location: location } }); }), /unsupported location/);
    assert.equal(requests, 1);
  }
});
test('private Drive permissions, folders, native docs and oversized imports fail clearly', async () => {
  await assert.rejects(downloadDriveFile(url, async () => new Response('<html>Sign in</html>', { headers: { 'Content-Type': 'text/html' } })), /needs Google access/);
  await assert.rejects(downloadDriveFile(url, async () => new Response('x', { headers: { 'Content-Length': String(26 * 1024 * 1024) } })), /25 MB/);
  const neverFetch = async () => { throw new Error('Must not fetch'); };
  await assert.rejects(downloadDriveFile('https://drive.google.com/drive/folders/1Abcdefghijklmnopqrstuvwxyz', neverFetch), /Folders stay/);
  await assert.rejects(downloadDriveFile('https://docs.google.com/document/d/1Abcdefghijklmnopqrstuvwxyz/edit', neverFetch), /Export this Google document/);
});
