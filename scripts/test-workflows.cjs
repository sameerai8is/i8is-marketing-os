/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS CLI for isolated Next.js server fixtures. */
const { MongoClient, ObjectId } = require('mongodb');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let checkCount = 0;
require('@next/env').loadEnvConfig(process.cwd());

(async () => {
  const name = 'i8is_auth_test_' + randomBytes(8).toString('hex');
  assert.match(name, /^i8is_auth_test_[a-f0-9]{16}$/);
  const uri = new URL(process.env.MONGODB_URI);
  uri.pathname = '/' + name;
  const client = new MongoClient(uri.toString(), { serverSelectionTimeoutMS: 10000 });
  let server;
  try {
    await client.connect();
    const db = client.db(name);
    const now = new Date();
    const fixture = (email, subject, role, status = 'active', tenantId = 'i8is') => ({ _id: new ObjectId(), tenantId, email, name: 'Authorization fixture', googleSubject: subject, role, status, createdAt: now, updatedAt: now });
    const owner = fixture('sameera@i8is.com', 'test-owner', 'admin');
    const staff = fixture('staff@i8is.com', 'test-staff', 'member');
    const admin = fixture('admin-test@i8is.com', 'test-admin', 'admin');
    const blocked = fixture('blocked@i8is.com', 'test-blocked', 'member', 'blocked');
    const other = fixture('other@i8is.com', 'test-other', 'admin', 'active', 'other-tenant');
    await db.collection('workspacemembers').insertMany([owner, staff, admin, blocked, other]);
    await db.collection('contentitems').insertOne({ tenantId: 'other-tenant', title: 'Other tenant secret', body: 'Must not appear', platform: 'linkedin', status: 'draft' });

    const secret = randomBytes(48).toString('base64url');
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3101'], {
      cwd: process.cwd(), windowsHide: true, stdio: 'ignore',
      env: { ...process.env, MONGODB_URI: uri.toString(), AUTH_SECRET: secret, AUTH_ADMIN_EMAIL: 'sameera@i8is.com', AUTH_GOOGLE_ID: 'test-only-not-a-real-oauth-client', AUTH_GOOGLE_SECRET: 'test-only-not-a-real-oauth-secret', AUTH_URL: 'http://127.0.0.1:3101', APP_URL: 'http://127.0.0.1:3101', RESEND_API_KEY: '', INVITE_FROM_EMAIL: '' },
    });
    const base = 'http://127.0.0.1:3101';
    let started = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { const r = await fetch(base + '/login'); if (r.status === 200) { started = true; break; } } catch {}
      await delay(250);
    }
    assert.ok(started, 'Isolated authorization server failed to start');
    const { encode } = await import('next-auth/jwt');
    async function cookie(member, subject = member.googleSubject) {
      const jwt = await encode({ secret, salt: 'authjs.session-token', token: { sub: subject, email: member.email, name: member.name, googleSubject: subject }, maxAge: 3600 });
      return 'authjs.session-token=' + jwt;
    }
    const ownerCookie = await cookie(owner);
    const staffCookie = await cookie(staff);
    const adminCookie = await cookie(admin);
    async function check(label, path, expected, options = {}, token) {
      const r = await fetch(base + path, { ...options, redirect: 'manual', headers: { ...(token ? { Cookie: token } : {}), ...options.headers } });
      assert.equal(r.status, expected, label);
      checkCount++; console.log('PASS ' + label + ' HTTP ' + r.status);
      return r;
    }
    const mutation = body => ({ method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const patch = body => ({ ...mutation(body), method: 'PATCH' });
    await check('anonymous API denied', '/api/content', 401);
    await check('anonymous dashboard redirects', '/', 307);
    await check('forged session denied', '/api/content', 401, {}, 'authjs.session-token=forged');
    await check('member cannot read Teams', '/api/team', 403, {}, staffCookie);
    await check('blocked member denied', '/api/content', 403, {}, await cookie(blocked));
    await check('wrong Google subject denied', '/api/content', 403, {}, await cookie(staff, 'wrong-subject'));
    await check('cross-tenant admin denied', '/api/team', 403, {}, await cookie(other));
    const directory = await (await check('admin can read Teams', '/api/team', 200, {}, ownerCookie)).text();
    assert.ok(!directory.includes('googleSubject'));
    assert.ok(!directory.includes('other@i8is.com'));
    await check('missing Origin rejected', '/api/team', 403, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, ownerCookie);
    await check('cross-site mutation rejected', '/api/team', 403, { ...mutation({}), headers: { Origin: 'https://attacker.test', 'Content-Type': 'application/json' } }, ownerCookie);
    const content = await (await check('member can save content', '/api/content', 201, mutation({ tenantId: 'other-tenant', title: 'Test draft', body: 'Test content', platform: 'linkedin' }), staffCookie)).json();
    assert.equal(content.tenantId, 'i8is');
    const listed = await (await check('content query is tenant scoped', '/api/content', 200, {}, staffCookie)).json();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].tenantId, 'i8is');
    await check('member cannot promote themselves', '/api/team/' + staff._id, 403, patch({ action: 'role', role: 'admin' }), staffCookie);
    await check('admin cannot demote themselves', '/api/team/' + owner._id, 403, patch({ action: 'role', role: 'member' }), ownerCookie);
    await check('initial admin is protected', '/api/team/' + owner._id, 403, patch({ action: 'block' }), adminCookie);
    await check('admin approval works', '/api/team', 201, mutation({ email: 'guest@example.com', role: 'member' }), ownerCookie);
    const invite = await db.collection('workspacemembers').findOne({ email: 'guest@example.com', tenantId: 'i8is' });
    assert.equal(invite.status, 'invited');
    assert.ok(invite.inviteExpiresAt > new Date());
    await check('admin can revoke staff', '/api/team/' + staff._id, 200, patch({ action: 'block' }), ownerCookie);
    await check('revocation invalidates existing session', '/api/content', 403, {}, staffCookie);
    await check('admin can restore staff', '/api/team/' + staff._id, 200, patch({ action: 'restore' }), ownerCookie);
    await check('restored member can return', '/api/content', 200, {}, staffCookie);
    await check('admin can promote staff', '/api/team/' + staff._id, 200, patch({ action: 'role', role: 'admin' }), ownerCookie);
    await check('updated role takes effect without new JWT', '/api/team', 200, {}, staffCookie);

    const regular=fixture('regular@i8is.com','regular-sub','member');await db.collection('workspacemembers').insertOne(regular);const regularCookie=await cookie(regular);

    const ts=require('typescript'), modules=new Map();
    process.env.MONGODB_URI=uri.toString();process.env.AUTH_ADMIN_EMAIL='sameera@i8is.com';
    function loadTs(file) {
      const full=path.resolve(file); if(modules.has(full))return modules.get(full).exports;
      const mod={exports:{}};modules.set(full,mod);
      const source=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
      const localRequire=spec=>spec==='server-only'?{}:spec.startsWith('.')?loadTs(path.resolve(path.dirname(full),spec)+'.ts'):require(spec);
      new Function('require','module','exports',source)(localRequire,mod,mod.exports);return mod.exports;
    }
    const {admitGoogleIdentity}=loadTs('src/lib/member-signin.ts');
    const identity=(email,sub,hd)=>({email,sub,hd,email_verified:true,name:'Workflow test'});
    assert.equal(await admitGoogleIdentity(identity('requester@example.com','requester-sub')),true);
    const pending=await db.collection('workspacemembers').findOne({tenantId:'i8is',email:'requester@example.com'});
    assert.equal(pending.status,'pending');assert.equal(pending.role,'member');
    const pendingCookie=await cookie(pending);
    await check('pending user cannot read workspace content','/api/content',403,{},pendingCookie);
    const waiting=await (await check('pending user sees waiting page','/access',200,{},pendingCookie)).text();assert.ok(waiting.includes('Your access request is in.'));
    const queue=await (await check('pending request appears in admin dashboard','/api/team?status=pending',200,{},ownerCookie)).json();assert.equal(queue.pendingCount,1);assert.equal(queue.members[0].email,pending.email);
    await check('member cannot approve a pending visitor','/api/team/'+pending._id,403,patch({action:'approve'}),regularCookie);
    await check('admin approves pending visitor','/api/team/'+pending._id,200,patch({action:'approve'}),ownerCookie);
    await check('approved visitor enters without reauthenticating','/api/content',200,{},pendingCookie);
    await check('approved waiting page redirects to workspace','/access',307,{},pendingCookie);
    await check('admin revokes newly approved visitor','/api/team/'+pending._id,200,patch({action:'block'}),ownerCookie);
    await check('revoked visitor immediately loses content access','/api/content',403,{},pendingCookie);
    assert.equal(await admitGoogleIdentity(identity(pending.email,pending.googleSubject)),false);
    assert.equal(await admitGoogleIdentity(identity('staff-auto@i8is.com','auto-sub','i8is.com')),true);
    const joined=await db.collection('workspacemembers').findOne({email:'staff-auto@i8is.com'});assert.equal(joined.role,'member');assert.equal(joined.status,'active');
    assert.equal(await admitGoogleIdentity({...identity('unverified@example.com','unverified'),email_verified:false}),false);
    assert.equal(await admitGoogleIdentity(identity('guest@example.com','accepted-guest')),true);
    assert.equal((await db.collection('workspacemembers').findOne({email:'guest@example.com'})).status,'active');
    assert.equal(await admitGoogleIdentity(identity('guest@example.com','wrong-subject')),false);
    await check('admin invites an expiring account','/api/team',201,mutation({email:'expired@example.com',role:'member'}),ownerCookie);
    await db.collection('workspacemembers').updateOne({email:'expired@example.com'},{$set:{inviteExpiresAt:new Date(Date.now()-1000)}});
    assert.equal(await admitGoogleIdentity(identity('expired@example.com','expired-sub')),true);
    assert.equal((await db.collection('workspacemembers').findOne({email:'expired@example.com'})).status,'pending');
    checkCount+=11;console.log('PASS identity admission, invitation acceptance, expiry, and pending membership assertions');
    const directory2=await (await check('admin access audit trail and mail status available','/api/team',200,{},ownerCookie)).json();
    assert.ok(directory2.events.some(e=>e.action==='member.approve'));
    assert.equal(directory2.emailConfigured,false);assert.equal(directory2.loginUrl,base+'/login');
    assert.ok(directory2.members.every(m=>!Object.hasOwn(m,'googleSubject')));
    await check('search is escaped rather than interpreted as regex','/api/team?q='+encodeURIComponent('.*'),200,{},ownerCookie);
    await check('member cannot fabricate published status','/api/content',400,mutation({title:'Not delivered',body:'No delivery',platform:'linkedin',status:'published'}),staffCookie);
    await check('admin cannot fabricate scheduled status on create','/api/content',400,mutation({title:'Not approved',body:'No approval',platform:'linkedin',status:'scheduled'}),ownerCookie);
    const all=await (await check('content reads saved draft','/api/content',200,{},staffCookie)).json();let post=all[0];
    const planner=await (await check('calendar renders actual saved title','/calendar',200,{},staffCookie)).text();assert.ok(planner.includes('Test draft'));
    const otherContent=await db.collection('contentitems').findOne({tenantId:'other-tenant'});
    await check('cross-tenant content edit denied','/api/content/'+otherContent._id,404,patch({action:'save',updatedAt:new Date().toISOString(),title:'Attack',body:'No',platform:'linkedin'}),staffCookie);
    await check('regular member cannot approve content','/api/content/'+post._id,403,patch({action:'approve',updatedAt:post.updatedAt}),regularCookie);
    const staleVersion=post.updatedAt;
    post=await (await check('member submits draft for approval','/api/content/'+post._id,200,patch({action:'submit',updatedAt:post.updatedAt}),regularCookie)).json();assert.equal(post.status,'pending_approval');
    await check('stale content update rejected','/api/content/'+post._id,409,patch({action:'save',updatedAt:staleVersion,title:'Overwritten',body:'Lost update',platform:'linkedin'}),regularCookie);
    await check('member cannot delete pending approval content','/api/content/'+post._id,403,{...patch({updatedAt:post.updatedAt}),method:'DELETE'},regularCookie);
    post=await (await check('admin approves submitted content','/api/content/'+post._id,200,patch({action:'approve',updatedAt:post.updatedAt}),ownerCookie)).json();assert.equal(post.status,'approved');
    await check('schedule requires timestamp','/api/content/'+post._id,400,patch({action:'schedule',updatedAt:post.updatedAt}),ownerCookie);
    await check('past schedule rejected','/api/content/'+post._id,400,patch({action:'schedule',updatedAt:post.updatedAt,scheduledAt:new Date(Date.now()-60000).toISOString()}),ownerCookie);
    const future=new Date(Date.now()+86400000).toISOString();
    post=await (await check('approved content can be scheduled in simulation','/api/content/'+post._id,200,patch({action:'schedule',updatedAt:post.updatedAt,scheduledAt:future}),ownerCookie)).json();assert.equal(post.scheduledAt,future);
    post=await (await check('editing scheduled content returns it to draft','/api/content/'+post._id,200,patch({action:'save',updatedAt:post.updatedAt,title:'Revised draft',body:'Changed text',platform:'linkedin'}),regularCookie)).json();assert.equal(post.status,'draft');assert.equal(post.scheduledAt,undefined);
    await check('member deletes draft','/api/content/'+post._id,200,{...patch({updatedAt:post.updatedAt}),method:'DELETE'},regularCookie);
    const initialSettings=await (await check('workspace has safe empty defaults','/api/workspace',200,{},regularCookie)).json();assert.deepEqual(initialSettings.settings.facts,[]);
    await check('AI generation refuses missing reviewed knowledge','/api/content/generate',409,mutation({prompt:'Introduce the company',platform:'linkedin'}),regularCookie);
    const knowledge={action:'knowledge',companyName:'Workflow test company',tone:'Clear',audience:'Test audience',facts:[{text:'Workflow test company builds software.',source:'Test fixture brief'}],confirmVerified:true};
    await check('regular member cannot verify company facts','/api/workspace',403,patch(knowledge),regularCookie);
    await check('unconfirmed facts rejected','/api/workspace',400,patch({...knowledge,confirmVerified:false}),ownerCookie);
    let settings=await (await check('admin saves verified facts','/api/workspace',200,patch(knowledge),ownerCookie)).json();settings=settings.settings;assert.equal(settings.facts[0].verifiedBy,owner.email);
    await check('stale workspace update rejected','/api/workspace',409,patch({action:'autonomy',autonomy:'managed'}),ownerCookie);
    settings=await (await check('member goal persists in workspace','/api/workspace',200,patch({action:'goal',marketingGoal:'A real shared goal',updatedAt:settings.updatedAt}),regularCookie)).json();settings=settings.settings;
    settings=await (await check('admin autonomy choice persists','/api/workspace',200,patch({action:'autonomy',autonomy:'managed',updatedAt:settings.updatedAt}),ownerCookie)).json();assert.equal(settings.settings.autonomy,'managed');
    const shared=await (await check('another member reads persisted shared goal','/api/workspace',200,{},staffCookie)).json();assert.equal(shared.settings.marketingGoal,'A real shared goal');
    await require('./asset-workflow-checks.cjs')({ check, db, base, ownerCookie, regularCookie, mutation, patch, fixture, cookie });
    if (process.env.TEST_LIVE_AI === '1') {
      const generated=await (await check('live AI saves a source-referenced draft','/api/content/generate',201,mutation({prompt:'Introduce what this test company does. Avoid any extra claims.',platform:'linkedin'}),regularCookie)).json();
      assert.equal(generated.status,'draft');assert.ok(generated.sourceFacts.length);console.log('PASS generated output is draft-only with references');
    }
    // Sign-out clears the session cookie; OAuth redirects and CSRF are exercised
    // by Auth.js, while fixture cookies avoid automating a human Google account.
    const csrf=await fetch(base+'/api/auth/csrf');const csrfBody=await csrf.json();
    const csrfCookie=csrf.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
    const signedOut=await check('sign out clears the application session','/api/auth/signout',302,{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded',Cookie:regularCookie+'; '+csrfCookie},body:new URLSearchParams({csrfToken:csrfBody.csrfToken,callbackUrl:base+'/login'})});
    assert.ok(signedOut.headers.getSetCookie().some(c=>c.startsWith('authjs.session-token=;')));
    const limiter=fixture('limit@i8is.com','limit-sub','admin');await db.collection('workspacemembers').insertOne(limiter);const limitCookie=await cookie(limiter);
    for(let i=0;i<10;i++)await check('invite abuse budget attempt '+(i+1),'/api/team',400,mutation({email:'invalid',role:'member'}),limitCookie);
    await check('invite rate limit enforced across requests','/api/team',429,mutation({email:'invalid',role:'member'}),limitCookie);
    await require('mongoose').disconnect();
    console.log('PASS '+checkCount+' workflow assertions. Real Google consent and actual email delivery require a human/provider check. No email was sent and no social publishing mutation was called.');

  } finally {
    if (server) { server.kill(); await delay(300); }
    await require('mongoose').disconnect();
    // Drop only the exact, randomly named disposable database created above.
    assert.match(name, /^i8is_auth_test_[a-f0-9]{16}$/);
    await client.db(name).dropDatabase();
    await client.close();
    console.log('Removed isolated authorization test database.');
  }
})().catch(error => { console.log('Authorization verification failed:', error.name, error.code || '', error instanceof assert.AssertionError ? error.message : 'No credential or database details shown.'); process.exitCode = 1; });
