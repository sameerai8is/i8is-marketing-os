/* eslint-disable @typescript-eslint/no-require-imports -- Explicit test-process preload, never imported by application code. */
// Tests launch Node with --require pointing here. No production setting enables
// this provider. Even a missed interception receives only a fake API key.
const assert = require('node:assert/strict');
const original = globalThis.fetch;
const posts = new Map();
let created = 0;
globalThis.fetch = async (url, options) => {
  const target = typeof url === 'string' || url instanceof URL ? String(url) : url.url;
  if (new URL(target).origin !== 'https://api.buffer.com') return original(url, options);
  assert.equal(new Headers(options?.headers || url.headers).get('authorization'), 'Bearer publishing-fixture-not-a-real-key');
  const raw = options?.body ? typeof options.body === 'string' ? options.body : await new Response(options.body).text() : await url.clone().text();
  const body = JSON.parse(raw);
  if (body.query.includes('MarketingChannels')) {
    assert.equal(body.variables.input.organizationId, 'publishing-fixture-org');
    return Response.json({data:{channels:[{id:'fixture-profile',name:'Fixture profile',displayName:'Fixture profile',service:'linkedin',isDisconnected:false,isLocked:false,isQueuePaused:false}]}});
  }
  if (body.query.includes('OrbitPublish')) {
    const i=body.variables.input;
    if(i.text.includes('FIXTURE_REJECT'))return Response.json({data:{createPost:{message:'Rejected fixture'}}});
    if(i.text.includes('FIXTURE_TIMEOUT'))throw new Error('Fixture network timeout');
    const p={id:'fixture-remote-'+(++created),channelId:i.channelId,text:i.text,status:i.mode==='shareNow'?'sent':'scheduled',dueAt:i.dueAt||null,sentAt:i.mode==='shareNow'?new Date().toISOString():null,createdAt:new Date().toISOString(),assets:i.assets.map((_,n)=>({id:'asset-'+n}))};posts.set(p.id,p);
    return Response.json({data:{createPost:{__typename:'PostActionSuccess',post:p}}});
  }
  if(body.query.includes('OrbitPost')){
    const p=posts.get(body.variables.input.id);return p?Response.json({data:{post:p}}):Response.json({errors:[{message:'Fixture post not found'}]});
  }
  if(body.query.includes('OrbitCancel')){posts.delete(body.variables.input.id);return Response.json({data:{deletePost:{id:body.variables.input.id}}});}
  throw new Error('Unexpected Buffer fixture operation');
};
