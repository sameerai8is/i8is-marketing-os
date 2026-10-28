import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as content from '../src/lib/content-policy.ts';
function compile(file, dependencies) { const compiled = {exports:{}}; const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText; new Function('require','module','exports',code)(name=>dependencies[name]||{},compiled,compiled.exports); return compiled.exports; }
const policy = compile('../src/lib/strategy-policy.ts', {'./content-policy':content});
const {generateStrategy} = compile('../src/lib/strategy-ai.ts', {'./strategy-policy':policy});
const brief = {title:'Test plan',goal:'leads',secondaryGoals:['awareness'],objective:'Create qualified conversations',offering:'Reviewed software services',audience:'Software team leaders',geography:'',channels:['linkedin'],durationDays:30,startDate:'2026-11-01'};
const plan = {positioning:'Proposed educational positioning',pillars:[{name:'Education',rationale:'Test audience needs',angles:['Explain the reviewed service']}],channels:[{platform:'linkedin',rationale:'Test this channel',postsPerWeek:2}],campaigns:[{name:'Service introduction',brief:'Introduce the reviewed service',platform:'linkedin',format:'Text post',cta:'Start a conversation',assets:'Optional brand graphic',day:1,factIds:[0]}],measures:[{name:'Inquiries',target:'Establish a baseline first',method:'Manually track qualified inquiries'}],assumptions:[],gaps:['Audience priorities need testing']};
const context = {companyName:'Fixture',tone:'Clear',facts:[{text:'Fixture builds software.',source:'Reviewed fixture brief'}],researchNotes:['Unreviewed competitor hypothesis']};
test('all goal templates work while client tenant/status/approval fields are ignored',()=>{
 for(const goal of policy.strategyGoals.map(g=>g.value)){const value=policy.strategyBrief({...brief,goal,secondaryGoals:[],tenantId:'other',status:'approved',approvedBy:'attacker'});assert.equal(value.goal,goal);assert.equal(value.tenantId,undefined);assert.equal(value.status,undefined);}
});
test('strategy briefs reject invalid goals, dates, unsupported channels and duplicate selections',()=>{
 for(const values of [{goal:'made_up'},{startDate:'2026-02-30'},{channels:['mastodon']},{channels:[]},{channels:['linkedin','linkedin']},{secondaryGoals:['leads']},{durationDays:365},{offering:''}])assert.throws(()=>policy.strategyBrief({...brief,...values}));
});
test('strategy plans reject unsupported facts, platforms, timing and empty campaign sets',()=>{
 assert.deepEqual(policy.strategyPlan(plan,brief,1),plan);
 for(const values of [{campaigns:[]},{campaigns:[{...plan.campaigns[0],factIds:[9]}]},{campaigns:[{...plan.campaigns[0],platform:'instagram'}]},{campaigns:[{...plan.campaigns[0],day:31}]},{channels:[{...plan.channels[0],postsPerWeek:0}]}])assert.throws(()=>policy.strategyPlan({...plan,...values},brief,1));
});
test('strategy transitions require a submitted plan and administrator review',()=>{
 assert.equal(policy.strategyTransition('draft','submit',false),'pending_approval');
 assert.equal(policy.strategyTransition('pending_approval','approve',true),'approved');
 assert.equal(policy.strategyTransition('pending_approval','reject',true),'changes_requested');
 assert.throws(()=>policy.strategyTransition('pending_approval','approve',false));
 assert.throws(()=>policy.strategyTransition('draft','approve',true));
 assert.throws(()=>policy.strategyTransition('approved','submit',false));
});
test('AI strategy never calls the provider without reviewed facts',async()=>{
 await assert.rejects(generateStrategy(brief,{...context,facts:[]},'fixture',()=>{throw new Error('Must not call provider');}),/review.*fact/i);
});
test('AI strategies use strict structured output, separate research hypotheses and validate results',async()=>{
 const result=await generateStrategy(brief,context,'fixture',async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');const payload=JSON.parse(options.body);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.deepEqual(payload.text.format.schema.properties.channels.items.properties.platform.enum,['linkedin']);assert.deepEqual(payload.text.format.schema.properties.campaigns.items.properties.factIds.items.enum,[0]);assert.equal(payload.text.format.schema.properties.campaigns.items.properties.day.enum.length,brief.durationDays);const input=JSON.parse(payload.input);assert.equal(input.reviewedFacts[0].id,0);assert.deepEqual(input.unreviewedResearchNotes,context.researchNotes);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(plan)}]}]});});assert.deepEqual(result,plan);
});
test('AI strategy errors redact provider text and never accept incomplete output',async()=>{
 await assert.rejects(generateStrategy(brief,context,'fixture',async()=>new Response('private upstream details',{status:401})),e=>!e.message.includes('private upstream'));
 for(const payload of [{status:'incomplete'}, {status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]}])await assert.rejects(generateStrategy(brief,context,'fixture',async()=>Response.json(payload)),/incomplete|unsupported/);
});
test('proposed dates remain separate from scheduling and reject invalid dates',()=>{
 assert.equal(content.plannedDate('2026-11-01'),'2026-11-01');assert.equal(content.plannedDate(''),undefined);assert.throws(()=>content.plannedDate('2026-02-30'));assert.throws(()=>content.plannedDate('2026-11-01T10:00:00Z'));
});
