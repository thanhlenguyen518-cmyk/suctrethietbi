import {queueActivityNotices} from '../lib/activity-email.ts';
import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {runMaintenance} from '../lib/jobs.ts';import {withLock} from '../lib/locking.ts';import {loadOwner,saveWorkspace} from '../lib/storage.ts';
function db(){const sqlite=new DatabaseSync(':memory:');for(const f of ['drizzle/0000_nebulous_landau.sql','drizzle/0001_outgoing_the_fallen.sql'])sqlite.exec(readFileSync(f,'utf8').replaceAll('--> statement-breakpoint',''));return {prepare(sql:string){return {bind(...args:any[]){const q=sqlite.prepare(sql);return {first:async()=>q.get(...args),all:async()=>({results:q.all(...args)}),run:async()=>({meta:{changes:q.run(...args).changes}})}},all:async()=>({results:sqlite.prepare(sql).all()})}}};}
test('persisted maintenance queues reminders and mail, rechecks returned status before any email retry',async()=>{const DB=db(),env={DB};const {s,version}=await loadOwner(env,'owner-test');s.settings.emailEnabled=true;s.requests=[{id:'MT-JOB',status:'borrowed',name:'Test',contact:'test@example.test',purpose:'Sinh hoạt',start:new Date(Date.now()-7200000).toISOString(),end:new Date(Date.now()-3600000).toISOString(),items:[]}];await saveWorkspace(DB,'owner-test',version,s);const first=await runMaintenance(env);assert.equal(first.ok,true);assert.equal(first.processed,1);let current=await loadOwner(env,'owner-test');assert.equal(current.s.notices.length,1);assert.equal(current.s.notices[0].emailStatus,'retry');assert.ok(current.s.settings.lastJob.at);await runMaintenance(env);current=await loadOwner(env,'owner-test');assert.equal(current.s.notices.length,1);current.s.requests[0].status='closed';await saveWorkspace(DB,'owner-test',current.version,current.s);await runMaintenance(env);current=await loadOwner(env,'owner-test');assert.equal(current.s.notices[0].emailStatus,'cancelled');});
test('atomic lock prevents parallel state changes and releases after error',async()=>{const DB=db();let unblock:any;const gate=new Promise<void>(r=>{unblock=r});let acquired:any;const started=new Promise<void>(r=>{acquired=r});const job=withLock(DB,'owner',async()=>{acquired();await gate});await started;await assert.rejects(withLock(DB,'owner',async()=>1),/đang xử lý/);unblock();await job;await assert.rejects(withLock(DB,'owner',async()=>{throw new Error('test error')}));assert.equal(await withLock(DB,'owner',async()=>7),7);});
test('optimistic save rejects stale source state',async()=>{const DB=db();const env={DB};const a=await loadOwner(env,'owner');const b=await loadOwner(env,'owner');await saveWorkspace(DB,'owner',a.version,a.s);await assert.rejects(saveWorkspace(DB,'owner',b.version,b.s),/vừa thay đổi/);});

test('A new workflow event enters outbox, gets accepted by Gmail and is not resent',async()=>{
 const DB=db(),owner='club:notify-test',env:any={DB,GMAIL_SCRIPT_URL:'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec',GMAIL_SCRIPT_SECRET:'a'.repeat(48),EMAIL_PROVIDER:'gmail_script'};
 const record=await loadOwner(env,owner);
 const state=record.s;
 state.requests=[{id:'MT-EMAIL',name:'Test user',contact:'member@example.test',accountEmail:'member@example.test',status:'review',start:new Date(Date.now()+3600000).toISOString(),end:new Date(Date.now()+7200000).toISOString(),items:[]}];
 const queued=queueActivityNotices(state,{requests:[]},'create','MT-EMAIL','borrower',{staff:['staff@example.test'],board:[]});
 assert.equal(queued,2);
 await saveWorkspace(DB,owner,record.version,state);
 const sentTo:string[]=[];
 const mock=async(url:any,options:any)=>{
  assert.equal(url,env.GMAIL_SCRIPT_URL);
  const body=JSON.parse(options.body);
  sentTo.push(body.to);
  return Response.json({ok:true,id:body.id});
 };
 const first=await runMaintenance(env,mock as typeof fetch);
 assert.equal(first.ok,true);
 assert.equal(first.emailsAccepted,2);
 assert.deepEqual(sentTo.sort(),['member@example.test','staff@example.test']);
 let stored=await loadOwner(env,owner);
 assert.equal(stored.s.notices.filter((n:any)=>n.type==='activity'&&n.emailStatus==='accepted').length,2);
 const second=await runMaintenance(env,mock as typeof fetch);
 assert.equal(second.emailsAccepted,0);
 assert.equal(sentTo.length,2);
});
test('Queued activity emails remain retryable when Gmail secrets are unavailable',async()=>{
 const DB=db(),owner='club:missing-gmail',env:any={DB};
 const record=await loadOwner(env,owner);
 record.s.requests=[{id:'MT-MISSING',name:'Member',contact:'member@example.test',status:'review',start:new Date(Date.now()+3600000).toISOString(),end:new Date(Date.now()+7200000).toISOString(),items:[]}];
 queueActivityNotices(record.s,{requests:[]},'create','MT-MISSING','borrower',{staff:[],board:[]});
 await saveWorkspace(DB,owner,record.version,record.s);
 const first=await runMaintenance(env);
 assert.equal(first.emailsAccepted,0);
 let stored=await loadOwner(env,owner);
 assert.equal(stored.s.notices.find((n:any)=>n.type==='activity')?.emailStatus,'retry');
 env.GMAIL_SCRIPT_URL='https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';env.GMAIL_SCRIPT_SECRET='a'.repeat(48);
 const mock=async(_url:any,options:any)=>Response.json({ok:true,id:JSON.parse(options.body).id});
 const second=await runMaintenance(env,mock as typeof fetch);
 assert.equal(second.emailsAccepted,1);
 stored=await loadOwner(env,owner);
 assert.equal(stored.s.notices.find((n:any)=>n.type==='activity')?.emailStatus,'accepted');
});
