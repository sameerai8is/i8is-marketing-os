/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS integration checks against the isolated Next.js server. */
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { ObjectId } = require('mongodb');
const sharp = require('sharp');
const MB = 1024 * 1024;

module.exports = async function assetChecks({ check, db, base, ownerCookie, regularCookie, mutation, patch, fixture, cookie }) {
  const other = fixture('asset-other@i8is.com', 'asset-other-sub', 'member');
  await db.collection('workspacemembers').insertOne(other);
  const otherCookie = await cookie(other);
  const blocked = fixture('asset-blocked@i8is.com', 'asset-blocked-sub', 'member', 'blocked');
  await db.collection('workspacemembers').insertOne(blocked);
  const foreignId = new ObjectId();
  await db.collection('assets').insertOne({ _id: foreignId, tenantId: 'other-tenant', status: 'ready', kind: 'image', name: 'Foreign secret', size: 1, approval: 'approved' });
  const request = (method, body) => ({ ...mutation(body), method });
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  async function start(name, size, token = regularCookie, expected = 201) {
    return (await check('reserve ' + name, '/api/assets', expected, mutation({ action: 'upload', name, filename: name, size, folder: 'Brand', tags: ['test'] }), token)).json();
  }
  async function chunk(item, n, bytes, expected = 200, token = regularCookie) {
    return check('upload ' + item.name + ' chunk ' + n, '/api/assets/' + item.id + '/upload?part=' + n, expected, { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/octet-stream' }, body: bytes }, token);
  }
  async function finish(item, expected = 200, token = regularCookie) {
    return (await check('complete ' + item.name, '/api/assets/' + item.id + '/upload', expected, mutation({}), token)).json();
  }
  async function upload(name, bytes) {
    const item = await start(name, bytes.length);
    for (let n = 0; n < item.chunks; n++) await chunk(item, n, bytes.subarray(n * item.chunkSize, (n + 1) * item.chunkSize));
    return finish(item);
  }
  async function remove(item, token = regularCookie, expected = 200) {
    return check('remove ' + item.name, '/api/assets/' + item.id, expected, request('DELETE', { updatedAt: item.updatedAt }), token);
  }
  async function change(item, action, token = ownerCookie, expected = 200, extra = {}) {
    return (await check('asset ' + action, '/api/assets/' + item.id, expected, patch({ action, updatedAt: item.updatedAt, ...extra }), token)).json();
  }

  await check('asset library requires sign-in', '/assets', 307);
  await check('asset API requires sign-in', '/api/assets', 401);
  await check('blocked member cannot list assets', '/api/assets', 403, {}, await cookie(blocked));
  await check('cross-tenant asset hidden', '/api/assets/' + foreignId, 404, {}, regularCookie);
  await check('cross-tenant file hidden', '/api/assets/' + foreignId + '/file', 404, {}, regularCookie);
  await check('cross-tenant preview hidden', '/api/assets/' + foreignId + '/preview', 404, {}, regularCookie);
  await check('asset creation requires Origin', '/api/assets', 403, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, regularCookie);
  await check('oversized file rejected before storage', '/api/assets', 400, mutation({ action: 'upload', name: 'large.png', filename: 'large.png', size: 25 * MB + 1 }), regularCookie);

  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#a8ce61' } }).png().toBuffer();
  const session = await start('logo.png', png.length);
  await finish(session, 409);
  await chunk(session, 1, png, 400);
  await chunk(session, 0, png, 404, otherCookie);
  await chunk(session, 0, png);
  await chunk(session, 0, png); // An interrupted request can safely retry the same chunk.
  let image = await finish(session);
  assert.equal(image.kind, 'image'); assert.equal(image.mime, 'image/png'); assert.equal(image.width, 64); assert.equal(image.height, 48); assert.equal(image.approval, 'pending');
  assert.equal(image.storageId, undefined); assert.equal(image.preview, undefined);
  assert.equal(await db.collection('assetparts').countDocuments({ assetId: new ObjectId(image.id) }), 0);
  const bytes = Buffer.from(await (await check('original file round trips exactly', image.fileUrl, 200, {}, regularCookie)).arrayBuffer()); assert.equal(hash(bytes), hash(png));
  const preview = await check('generated private preview is WebP', image.previewUrl, 200, {}, regularCookie); assert.equal(preview.headers.get('content-type'), 'image/webp'); assert.match(preview.headers.get('cache-control'), /no-store/);
  const partial = await check('file supports HTTP byte range', image.fileUrl, 206, { headers: { Range: 'bytes=0-15' } }, regularCookie); assert.equal(partial.headers.get('content-range'), 'bytes 0-15/' + png.length); assert.deepEqual(Buffer.from(await partial.arrayBuffer()), png.subarray(0, 16));
  await check('invalid byte range refused', image.fileUrl, 416, { headers: { Range: 'bytes=9999999-' } }, regularCookie);
  await change(image, 'approve', regularCookie, 403);
  await change(image, 'metadata', otherCookie, 403, { name: 'Not yours' });
  image = await change(image, 'metadata', regularCookie, 200, { name: 'I8IS logo', folder: 'Brand', tags: ['Logo', 'Logo'], altText: 'Test brand mark' }); assert.deepEqual(image.tags, ['logo']);
  const listing = await (await check('search and tags find uploaded image', '/api/assets?q=logo&folder=Brand&kind=image&source=upload&approval=pending', 200, {}, regularCookie)).json(); assert.equal(listing.total, 1); assert.equal(listing.items[0].id, image.id);
  const literal = await (await check('asset search escapes regex', '/api/assets?q=' + encodeURIComponent('.*'), 200, {}, regularCookie)).json(); assert.equal(literal.total, 0);
  const page = await (await check('asset page renders for active member', '/assets', 200, {}, regularCookie)).text(); assert.match(page, /Your brand, in one library/);

  const draftBody = { title: 'Brand launch', body: 'Reviewed company caption.', platform: 'linkedin', assetIds: [image.id] };
  await check('foreign asset cannot attach', '/api/content', 400, mutation({ ...draftBody, assetIds: [String(foreignId)] }), regularCookie);
  await check('duplicate attachment IDs refused', '/api/content', 400, mutation({ ...draftBody, assetIds: [image.id, image.id] }), regularCookie);
  await check('unapproved asset cannot create submitted post', '/api/content', 400, mutation({ ...draftBody, status: 'pending_approval' }), regularCookie);
  let post = await (await check('draft may hold pending asset', '/api/content', 201, mutation(draftBody), regularCookie)).json(); assert.equal(post.attachments[0].id, image.id);
  await check('unapproved attachment blocks submission', '/api/content/' + post._id, 400, patch({ action: 'submit', updatedAt: post.updatedAt }), regularCookie);
  await remove(image, regularCookie, 409);
  image = await change(image, 'approve');
  post = await (await check('approved attachment allows submission', '/api/content/' + post._id, 200, patch({ action: 'submit', updatedAt: post.updatedAt }), regularCookie)).json();
  await change(image, 'unapprove', ownerCookie, 409);
  post = await (await check('admin approves post with approved asset', '/api/content/' + post._id, 200, patch({ action: 'approve', updatedAt: post.updatedAt }), ownerCookie)).json();
  post = await (await check('editing attached post resets approval', '/api/content/' + post._id, 200, patch({ ...draftBody, action: 'save', updatedAt: post.updatedAt }), regularCookie)).json(); assert.equal(post.status, 'draft');
  image = await change(image, 'unapprove');
  await check('resubmission rechecks asset approval', '/api/content/' + post._id, 400, patch({ action: 'submit', updatedAt: post.updatedAt }), regularCookie);
  post = await (await check('attachment can be removed from draft', '/api/content/' + post._id, 200, patch({ ...draftBody, action: 'save', updatedAt: post.updatedAt, assetIds: [] }), regularCookie)).json(); assert.equal(post.attachments.length, 0);
  await remove(image);
  await check('deleted original inaccessible', image.fileUrl, 404, {}, regularCookie);
  assert.equal(await db.collection('assetfiles.files').countDocuments({ 'metadata.assetId': new ObjectId(image.id) }), 0);

  const fake = await start('fake.jpg', 32); await chunk(fake, 0, Buffer.from('<html>not an image</html>'.padEnd(32))); await finish(fake, 400); await remove(fake);
  const pdf = await upload('brief.pdf', Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF')); assert.equal(pdf.kind, 'document');
  const pdfFile = await check('PDF is served as download', pdf.fileUrl, 200, {}, regularCookie); assert.match(pdfFile.headers.get('content-disposition'), /^attachment/); await pdfFile.arrayBuffer();
  const svg = await upload('source.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')); assert.equal(svg.kind, 'source'); assert.equal(svg.previewUrl, undefined);
  const source = await check('SVG source cannot run inline', svg.fileUrl, 200, {}, regularCookie); assert.equal(source.headers.get('content-type'), 'application/octet-stream'); assert.match(source.headers.get('content-disposition'), /^attachment/); await source.arrayBuffer();
  await check('source files cannot attach to posts', '/api/content', 400, mutation({ ...draftBody, assetIds: [svg.id] }), regularCookie);

  const driveBody = { action: 'drive', name: 'Private brand folder', url: 'https://drive.google.com/drive/folders/ABCDEFGHIJ12345?usp=sharing', folder: 'Sources', tags: ['brand'] };
  const folder = await (await check('Drive folder saved as reference', '/api/assets', 201, mutation(driveBody), ownerCookie)).json(); assert.equal(folder.driveFolder, true); assert.equal(folder.kind, 'link'); assert.equal(folder.size, 0); assert.ok(!folder.sourceUrl.includes('usp='));
  await check('folder reference cannot pretend to import contents', '/api/assets/' + folder.id + '/import', 400, mutation({}), ownerCookie);
  const doc = await (await check('Google native document saved', '/api/assets', 201, mutation({ ...driveBody, name: 'Brand guide', url: 'https://docs.google.com/presentation/d/ABCDEFGHIJ54321/edit' }), ownerCookie)).json(); assert.equal(doc.driveNative, true);
  await check('native Docs import requires explicit export', '/api/assets/' + doc.id + '/import', 400, mutation({}), ownerCookie);
  const link = await (await check('Drive file reference saved without altering permissions', '/api/assets', 201, mutation({ ...driveBody, name: 'Drive photo', url: 'https://drive.google.com/file/d/ABCDEFGHIJ67890/view' }), ownerCookie)).json(); assert.equal(link.kind, 'link'); assert.equal(link.fileUrl, undefined);
  await check('Drive host lookalikes rejected', '/api/assets', 400, mutation({ ...driveBody, url: 'https://drive.google.com.evil.test/file/d/ABCDEFGHIJ67890/view' }), ownerCookie);
  await check('unimported Drive reference cannot attach', '/api/content', 400, mutation({ ...draftBody, assetIds: [link.id] }), regularCookie);
  await remove(link, ownerCookie); await remove(doc, ownerCookie); await remove(folder, ownerCookie);

  const largeBytes = await sharp(randomBytes(1500 * 1500 * 3), { raw: { width: 1500, height: 1500, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer(); assert.ok(largeBytes.length > 4.5 * MB);
  const large = await upload('large-test.png', largeBytes);
  const roundTrip = Buffer.from(await (await check('file above Vercel request limit downloads as stream', large.fileUrl, 200, {}, regularCookie)).arrayBuffer()); assert.equal(hash(roundTrip), hash(largeBytes));
  const reservations = [];
  for (let n = 0; n < 3; n++) reservations.push(await start('reserved-' + n + '.zip', 25 * MB, ownerCookie));
  await start('over-quota.zip', 25 * MB, ownerCookie, 413);
  for (const reserved of reservations) await remove(reserved, ownerCookie);
  const expired = await start('abandoned.zip', 25 * MB, ownerCookie);
  await db.collection('assets').updateOne({ _id: new ObjectId(expired.id) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const next = await start('cleanup.zip', 1, ownerCookie);
  assert.equal(await db.collection('assets').countDocuments({ _id: new ObjectId(expired.id) }), 0);
  await remove(next, ownerCookie);
  await remove(large); await remove(pdf); await remove(svg);
  const empty = await (await check('deletion releases workspace file allowance', '/api/assets', 200, {}, regularCookie)).json(); assert.equal(empty.usedBytes, 0); assert.equal(empty.total, 0);
  assert.equal(await db.collection('assetparts').countDocuments({ tenantId: 'i8is' }), 0);
  assert.equal(await db.collection('assetfiles.files').countDocuments({ 'metadata.tenantId': 'i8is' }), 0);
  assert.equal(await db.collection('assetfiles.chunks').countDocuments({}), 0);
  console.log('PASS asset byte integrity, approval, tenant isolation, quota and cleanup assertions.');
};
