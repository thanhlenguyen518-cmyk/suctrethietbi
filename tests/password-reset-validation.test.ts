import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {resetPassword} from '../lib/password-reset.ts';
import {passwordHash,digest} from '../lib/accounts.ts';

function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE workspaces (id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL)');
 const db={
  prepare(q:string){
   let args:any[]=[];
   return {bind(...a:any[]){args=a;return this},
    async first(){return sql.prepare(q).get(...args)||null},
    async run(){const r=sql.prepare(q).run(...args);return {meta:{changes:Number(r.changes)}}},
   };
  }
 };
 return {sql,db};
}
test('reset link validation distinguishes malformed token, short password and mismatch',async()=>{
 const {sql,db}=setup();
 const env={DB:db};
 const req=new Request('https://club.example/api/auth');
 const cases=[
  {token:'bad',password:'Password123!',confirmPassword:'Password123!',text:'Liên kết'},
  {token:'a'.repeat(72),password:'short',confirmPassword:'short',text:'10 đến 128'},
  {token:'a'.repeat(72),password:'Password123!',confirmPassword:'Password1234!',text:'không trùng khớp'}
 ];
 for(const c of cases){
  const resp=await resetPassword(env,req,{action:'resetPassword',...c});
  assert.equal(resp.status,400);
  assert.match((await resp.json() as any).error,new RegExp(c.text));
 }
 sql.close();
});
test('valid email reset token can change password once only',async()=>{
 const {sql,db}=setup();
 const email='member@example.test',salt=crypto.randomUUID(),original='previous-password';
 const hash=await passwordHash(original,salt);
 sql.prepare('INSERT INTO workspaces(id,data) VALUES(?,?)').run('account:'+email,JSON.stringify({email,name:'Member',role:'borrower',salt,hash,emailVerified:true}));
 const token=crypto.randomUUID()+crypto.randomUUID();
 assert.equal(token.length,72);
 sql.prepare('INSERT INTO workspaces(id,data) VALUES(?,?)').run('reset:'+await digest(token),JSON.stringify({email,hash,expires:Date.now()+600000}));
 const env={DB:db};
 const req=new Request('https://club.example/api/auth');
 const body={action:'resetPassword',token,password:'new-secure-password',confirmPassword:'new-secure-password'};
 const success=await resetPassword(env,req,body);
 assert.equal(success.status,200,await success.clone().text());
 const row:any=sql.prepare('SELECT data FROM workspaces WHERE id=?').get('account:'+email);
 const next=JSON.parse(row.data);
 assert.equal(next.hash,await passwordHash(body.password,next.salt));
 assert.equal((await resetPassword(env,req,body)).status,400);
 sql.close();
});

test('password recovery emails use dedicated path links that survive mobile Gmail browsers',async()=>{
 const {sql,db}=setup();
 const email='member@example.test';
 const hash='existing-password-hash';
 sql.prepare('INSERT INTO workspaces(id,data) VALUES(?,?)').run('account:'+email,JSON.stringify({email,hash}));
 let text='';
 const fetcher=async (_url:any, options:any)=>{
  const body=JSON.parse(options.body);
  text=body.text;
  return new Response(JSON.stringify({id:'accepted'}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const env={DB:db,RESEND_API_KEY:'test',MAIL_FROM:'CLB Sức Trẻ <noreply@example.test>'};
 const request=new Request('https://muonthietbisuctre.suctreclub.workers.dev/api/auth');
 const response=await resetPassword(env,request,{action:'forgotPassword',email},fetcher as typeof fetch);
 assert.equal(response.status,200,await response.clone().text());
 const match=text.match(/https:\/\/[^\s]+/);
 assert.ok(match,'email must contain URL');
 const url=new URL(match[0]);
 assert.equal(url.hostname,'muonthietbisuctre.suctreclub.workers.dev');
 assert.equal(url.hash,'');
 assert.equal(url.search,'','reset links should not depend on query parameters');
 const token=url.pathname.match(/^\/reset\/([a-f0-9-]{72})$/)?.[1]||null;
 assert.match(token||'',/^[a-f0-9-]{72}$/);
 assert.equal(text.includes('\\\\n'),false,'email must contain real line break, not escaped backslash-n');
 const row:any=sql.prepare('SELECT data FROM workspaces WHERE id=?').get('reset:'+await digest(token!));
 assert.ok(row);
 sql.close();
});
