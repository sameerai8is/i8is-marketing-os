import test from 'node:test';
import assert from 'node:assert/strict';
import { sealDriveToken, openDriveToken } from '../src/lib/drive-vault.ts';
import { DRIVE_READ_SCOPE, DRIVE_FILE_SCOPE, hasDriveScopes, driveFileId, driveQuery } from '../src/lib/drive-policy.ts';

test('Drive credentials are encrypted and bound to tenant and Google identity', () => {
  const secret = 'a'.repeat(48), other = 'b'.repeat(48), identity = 'tenant:person@example.test:google-sub';
  const sealed = sealDriveToken('sensitive-fixture-token', secret, identity);
  assert.ok(!sealed.includes('sensitive-fixture-token'));
  assert.notEqual(sealed, sealDriveToken('sensitive-fixture-token', secret, identity));
  assert.equal(openDriveToken(sealed, secret, identity), 'sensitive-fixture-token');
  assert.throws(() => openDriveToken(sealed, other, identity));
  assert.throws(() => openDriveToken(sealed, secret, 'other-tenant:person@example.test:google-sub'));
  assert.throws(() => openDriveToken(sealed.slice(0, -4) + 'AAAA', secret, identity));
});
test('Drive requires both explicit permissions and validates file IDs', () => {
  assert.equal(hasDriveScopes(DRIVE_READ_SCOPE), false);
  assert.equal(hasDriveScopes(DRIVE_FILE_SCOPE), false);
  assert.equal(hasDriveScopes(`openid ${DRIVE_READ_SCOPE} ${DRIVE_FILE_SCOPE}`), true);
  assert.equal(driveFileId('1abcdefghijklmno'), '1abcdefghijklmno');
  for (const id of ['https://attacker.test', '../metadata', "abc' or true", null]) assert.throws(() => driveFileId(id));
});
test('Drive file searches escape query syntax and constrain folder listings', () => {
  assert.equal(driveQuery('root', ''), "trashed = false and 'root' in parents");
  assert.equal(driveQuery('root', " team's \\ files "), "trashed = false and name contains 'team\\'s \\\\ files'");
});
