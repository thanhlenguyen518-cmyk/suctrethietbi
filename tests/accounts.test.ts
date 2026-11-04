import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {accountEndpoint,authenticatedAccount} from '../lib/accounts.ts';

const request=(body:any,cookie='')=>new Request('https://club.example/api/auth',{method:'POST',headers:{origin:'https://club.example','Content-Type':'application/json',cookie},body:JSON.stringify(body)});
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE workspaces(id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL)');
 const DB={
  prepare(query:string){let values:any[]=[];return {
   bind(...args:any[]){values=args;return this},
   async first(){return sql.prepare(query).get(...values)||null},
   async run(){return {meta:{changes:Number(sql.prepare(query).run(...values).changes)}};}
  }},
  async batch(stmts:any[]){sql.exec('BEGIN');try{const out=[];for(const statement of stmts)out.push(await statement.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}
 };
 let lastCode='';
 const fetcher=async (_url:any,options:any)=>{const sent=JSON.parse(options.body);lastCode=String(sent.text).match(/\b\d{6}\b/)?.[0]||'';return new Response(JSON.stringify({id:'mail-test'}),{status:200,headers:{'Content-Type':'application/json'}})};
 const env={DB,RESEND_API_KEY:'dummy',MAIL_FROM:'Sức Trẻ <noreply@example.test>',STAFF_ACCESS_CODE:'staff-test-only-code',BOARD_ACCESS_CODE:'board-test-only-code'};
 return {env,sql,fetcher:fetcher as typeof fetch,code:()=>lastCode};
}
async function sendCode(f:any,email:string){
 const r=await accountEndpoint(f.env,request({action:'sendEmailCode',email}),f.fetcher);
 assert.equal(r.status,200);
 assert.match(f.code(),/^\d{6}$/);
 return f.code();
}
test('Registration requires proof of receiving a valid email code',async()=>{
 const f=fixture();
 const data={action:'register',email:'member@example.test',name:'Member',role:'borrower',password:'test-password-only'};
 assert.equal((await accountEndpoint(f.env,request(data),f.fetcher)).status,400);
 assert.equal(f.sql.prepare('SELECT * FROM workspaces WHERE id=?').get('account:member@example.test'),undefined);
 const code=await sendCode(f,data.email);
 assert.equal((await accountEndpoint(f.env,request({...data,verificationCode:'000000'}),f.fetcher)).status,400);
 const accepted=await accountEndpoint(f.env,request({...data,verificationCode:code}),f.fetcher);
 assert.equal(accepted.status,200);
 const cookie=accepted.headers.get('set-cookie')!.split(';')[0];
 const user=await authenticatedAccount(f.env,new Request('https://club.example',{headers:{cookie}}));
 assert.equal(user?.emailVerified,true);
 assert.equal((await accountEndpoint(f.env,request({...data,verificationCode:code}),f.fetcher)).status,409);
 f.sql.close();
});
test('Invalid passwords and role codes cannot bypass verification',async()=>{
 const f=fixture();const email='staff@example.test';
 const code=await sendCode(f,email);
 const data={action:'register',email,name:'Staff',role:'staff',password:'test-password-only',code:'bad',verificationCode:code};
 assert.equal((await accountEndpoint(f.env,request(data),f.fetcher)).status,403);
 assert.equal((await accountEndpoint(f.env,request({...data,code:f.env.STAFF_ACCESS_CODE,password:'short'}),f.fetcher)).status,400);
 const valid=await accountEndpoint(f.env,request({...data,code:f.env.STAFF_ACCESS_CODE}),f.fetcher);
 assert.equal(valid.status,200);
 const cookie=valid.headers.get('set-cookie')!.split(';')[0];
 const a=await authenticatedAccount(f.env,new Request('https://club.example',{headers:{cookie}}));
 assert.equal(a?.role,'staff');
 const logout=await accountEndpoint(f.env,request({action:'logout'},cookie),f.fetcher);
 assert.equal(logout.status,200);
 assert.equal(await authenticatedAccount(f.env,new Request('https://club.example',{headers:{cookie}})),null);
 f.sql.close();
});
test('Existing accounts must verify email separately; code is single-use',async()=>{
 const f=fixture();const email='legacy@example.test',password='test-password-only';
 const salt=crypto.randomUUID();
 const {passwordHash}=await import('../lib/accounts.ts');
 f.sql.prepare('INSERT INTO workspaces(id,version,data) VALUES(?,0,?)').run('account:'+email,JSON.stringify({email,name:'Legacy',role:'borrower',salt,hash:await passwordHash(password,salt)}));
 const login=await accountEndpoint(f.env,request({action:'login',email,password}),f.fetcher);
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie')!.split(';')[0];
 let session=await accountEndpoint(f.env,new Request('https://club.example/api/auth',{headers:{cookie}}),f.fetcher);
 assert.equal((await session.json()).user.emailVerified,false);
 assert.equal((await accountEndpoint(f.env,request({action:'verifyMyEmail',verificationCode:'123456'},cookie),f.fetcher)).status,400);
 const send=await accountEndpoint(f.env,request({action:'sendEmailCode'},cookie),f.fetcher);
 assert.equal(send.status,200);
 const code=f.code();
 assert.equal((await accountEndpoint(f.env,request({action:'verifyMyEmail',verificationCode:code},cookie),f.fetcher)).status,200);
 session=await accountEndpoint(f.env,new Request('https://club.example/api/auth',{headers:{cookie}}),f.fetcher);
 assert.equal((await session.json()).user.emailVerified,true);
 f.sql.close();
});
test('Email sending configuration must exist and code requests are throttled',async()=>{
 const f=fixture();const email='new@example.test';
 assert.equal((await accountEndpoint({...f.env,RESEND_API_KEY:''},request({action:'sendEmailCode',email}),f.fetcher)).status,503);
 assert.equal((await accountEndpoint(f.env,request({action:'sendEmailCode',email}),f.fetcher)).status,200);
 assert.equal((await accountEndpoint(f.env,request({action:'sendEmailCode',email}),f.fetcher)).status,429);
 f.sql.close();
});
