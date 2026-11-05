import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personalLogs,attributeNewLogs} from '../lib/activity.ts';
import {emptyState,mutate} from '../lib/workflow.ts';

test('same-role accounts cannot read each other logs, old unattributed and system logs stay private',()=>{
 const logs=[{id:'a',role:'staff',actorEmail:'a@example.com'},{id:'b',role:'staff',actorEmail:'b@example.com'},{id:'legacy',role:'staff'},{id:'system',role:'system'},{id:'owner',actorId:'site-owner'}];
 assert.deepEqual(personalLogs(logs,'a@example.com','shared-club').map(l=>l.id),['a']);
 assert.deepEqual(personalLogs(logs,'b@example.com','shared-club').map(l=>l.id),['b']);
 assert.deepEqual(personalLogs(logs,'c@example.com','shared-club'),[]);
 assert.deepEqual(personalLogs(logs,null,'site-owner').map(l=>l.id),['owner']);
 assert.deepEqual(personalLogs(logs,null,null),[]);
});
test('only newly created human actions are attributed, never reassigned old actions or automatic logs',()=>{
 const previous=[{id:'old',role:'staff',actorEmail:'a@example.com'},{id:'legacy',role:'board'}];
 const next=[{id:'new',role:'board'},{id:'auto',role:'system'},...structuredClone(previous)];
 attributeNewLogs(previous,next,'b@example.com','shared-club');
 assert.deepEqual(personalLogs(next,'b@example.com','shared-club').map(l=>l.id),['new']);
 assert.deepEqual(personalLogs(next,'a@example.com','shared-club').map(l=>l.id),['old']);
 assert.equal((next.find(l=>l.id==='legacy') as any).actorEmail,undefined);
});
test('board approval accepts an optional note but rejects missing rejection reasons, invalid decisions and wrong roles',()=>{
 const now=Date.now();let s=mutate(emptyState(),'staff','demo',{},now);
 s=mutate(s,'borrower','create',{name:'Member',contact:'member@example.com',phone:'0901234567',purpose:'Sinh hoạt CLB',start:new Date(now+3600000).toISOString(),end:new Date(now+7200000).toISOString(),items:[{id:'TB001',qty:1}]},now);
 const id=s.requests[0].id;s=mutate(s,'staff','review',{id,valid:true},now);
 const approved=mutate(s,'board','approve',{id,approved:true,note:''},now);
 assert.equal(approved.requests[0].status,'ready');assert.ok(approved.requests[0].boardNote);
 assert.equal(s.requests[0].status,'board');
 assert.throws(()=>mutate(s,'board','approve',{id,approved:false,note:''},now),/lý do từ chối/);
 assert.throws(()=>mutate(s,'board','approve',{id},now),/Chọn đồng ý/);
 assert.throws(()=>mutate(s,'staff','approve',{id,approved:true},now),/Vai trò/);
 assert.throws(()=>mutate(approved,'board','approve',{id,approved:true},now),/Trạng thái/);
 const rejected=mutate(s,'board','approve',{id,approved:false,note:'Không phù hợp'},now);assert.equal(rejected.requests[0].status,'rejected');
});
