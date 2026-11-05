import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {MAINTENANCE_WORKSPACES_SQL} from '../lib/jobs.ts';
import {emptyState,mutate} from '../lib/workflow.ts';
import {resetPassword} from '../lib/password-reset.ts';

test('maintenance includes only real workspaces, never authentication or verification records',()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE workspaces(id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL)');
 for(const [id,data] of [
  ['club:suctre',emptyState()], ['legacy-owner',emptyState()],
  ['email-verify:somehash',{nonce:'test',expires:1234}],
  ['email-limit:somehash',{at:Date.now()}],
  ['login-limit:somehash',{at:Date.now(),count:1}],
  ['account:some@example.test',{email:'some@example.test'}],
  ['reset:somehash',{hash:'test'}]
 ] as const){sql.prepare('INSERT INTO workspaces(id,data) VALUES(?,?)').run(id,JSON.stringify(data));}
 const found=sql.prepare(MAINTENANCE_WORKSPACES_SQL).all().map((r:any)=>r.id);
 assert.deepEqual(found,['club:suctre','legacy-owner']);
 sql.close();
});

test('staff cannot review or board approve a request after its borrowing period ends',()=>{
 const now=Date.parse('2026-11-01T00:00:00Z');
 let s=mutate(emptyState(),'staff','demo',{},now);
 const order={name:'Member',contact:'member@example.test',purpose:'Sinh hoạt CLB',start:new Date(now+3600000).toISOString(),end:new Date(now+7200000).toISOString(),items:[{id:'TB001',qty:1}]};
 s=mutate(s,'borrower','create',order,now);
 const id=s.requests[0].id;
 assert.throws(()=>mutate(s,'staff','review',{id,valid:true},now+7200001),/Chỉ được xem/);
 s=mutate(s,'staff','review',{id,valid:true},now);
 assert.equal(s.requests[0].status,'board');
 assert.throws(()=>mutate(s,'board','approve',{id,approved:true},now+7200001),/Chỉ được xem/);
});

test('password reset reports sender permission errors without leaking provider response',async()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE workspaces(id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL)');
 const email='member@example.test';
 sql.prepare('INSERT INTO workspaces(id,data) VALUES(?,?)').run('account:'+email,JSON.stringify({email,hash:'hash'}));
 const DB={prepare(query:string){let values:any[]=[];return {bind(...args:any[]){values=args;return this},async first(){return sql.prepare(query).get(...values)||null},async run(){return {meta:{changes:Number(sql.prepare(query).run(...values).changes)}}}}}};
 const req=new Request('https://club.example/api/auth',{method:'POST'});
 const fetcher=async()=>new Response(JSON.stringify({message:'upstream details'}),{status:403});
 const r=await resetPassword({DB,RESEND_API_KEY:'test',MAIL_FROM:'Sức Trẻ <noreply@example.test>'},req,{action:'forgotPassword',email},fetcher as typeof fetch);
 assert.equal(r.status,503);
 const out:any=await r.json();
 assert.match(out.error,/Resend/);
 assert.doesNotMatch(out.error,/upstream details/);
 assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM workspaces WHERE id LIKE 'reset:%'").get()?.n),0);
 sql.close();
});
