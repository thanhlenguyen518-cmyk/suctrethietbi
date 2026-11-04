import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountEndpoint,authenticatedAccount} from '../lib/accounts.ts';
function database(){
 const rows=new Map<string,string>();
 const db={failSession:false,rows,prepare(sql:string){let args:any[]=[];return {bind(...a:any[]){args=a;return this},async first(){return rows.has(args[0])?{data:rows.get(args[0])}:null},async run(){
 if(sql.startsWith('DELETE'))return {meta:{changes:Number(rows.delete(args[0]))}};
 if(db.failSession&&String(args[0]).startsWith('session:'))throw new Error('simulated session failure');
 if(sql.startsWith('INSERT')&&rows.has(args[0])){if(sql.includes('OR IGNORE'))return {meta:{changes:0}};throw new Error('UNIQUE constraint failed')}
 rows.set(args[0],args[1]);return {meta:{changes:1}}}}},async batch(statements:any[]){const before=new Map(rows);try{const results=[];for(const st of statements)results.push(await st.run());return results}catch(e){rows.clear();for(const [id,value] of before)rows.set(id,value);throw e}}};return db;
}
const request=(body:any,cookie='')=>new Request('https://club.example/api/auth',{method:'POST',headers:{origin:'https://club.example','Content-Type':'application/json',cookie},body:JSON.stringify(body)});
test('privileged registration requires server code; account cannot change role; login and logout use server session',async()=>{
 const env={DB:database(),STAFF_ACCESS_CODE:'staff-test-only-code',BOARD_ACCESS_CODE:'board-test-only-code'};
 const fields={email:'member@example.com',name:'Member',password:'test-password-only'};
 assert.equal((await accountEndpoint(env,request({...fields,action:'register',role:'board',code:'wrong'}))).status,403);
 let response=await accountEndpoint(env,request({...fields,action:'register',role:'borrower'}));assert.equal(response.status,200);const cookie=response.headers.get('set-cookie')!.split(';')[0];
 let a=await authenticatedAccount(env,new Request('https://club.example',{headers:{cookie}}));assert.equal(a?.role,'borrower');
 assert.equal((await accountEndpoint(env,request({...fields,action:'register',role:'board',code:env.BOARD_ACCESS_CODE}))).status,409);
 response=await accountEndpoint(env,request({...fields,action:'login',role:'board'}));assert.equal((await response.json() as any).user.role,'borrower');
 assert.equal((await accountEndpoint(env,request({...fields,action:'login',password:'wrong-password'}))).status,401);
 await accountEndpoint(env,request({action:'logout'},cookie));assert.equal(await authenticatedAccount(env,new Request('https://club.example',{headers:{cookie}})),null);
 assert.equal((await accountEndpoint(env,new Request('https://club.example/api/auth',{method:'POST',headers:{origin:'https://evil.example'},body:'{}'}))).status,403);
 response=await accountEndpoint(env,request({...fields,email:'staff@example.com',action:'register',role:'staff',code:env.STAFF_ACCESS_CODE}));assert.equal((await response.json() as any).user.role,'staff');
});

for(const role of ['borrower','staff','board'])test(`registration validates password before saving for ${role} and allows retry`,async()=>{
 const db=database(),env={DB:db,STAFF_ACCESS_CODE:'staff-test-only-code',BOARD_ACCESS_CODE:'board-test-only-code'};
 const fields={email:role+'@example.com',name:'Test member',role,code:role==='staff'?env.STAFF_ACCESS_CODE:env.BOARD_ACCESS_CODE,action:'register'};
 for(const password of ['short','x'.repeat(129)]){
  const response=await accountEndpoint(env,request({...fields,password}));assert.equal(response.status,400);assert.equal(response.headers.get('set-cookie'),null);assert.equal(db.rows.size,0);assert.notEqual((await response.json() as any).ok,true);
 }
 const response=await accountEndpoint(env,request({...fields,password:'test-password-only'}));assert.equal(response.status,200);assert.equal((await response.json() as any).user.role,role);
 const cookie=response.headers.get('set-cookie')!.split(';')[0];assert.equal((await authenticatedAccount(env,new Request('https://club.example',{headers:{cookie}})))?.role,role);
});
test('session write failure rolls back registration and the same email can register again',async()=>{
 const db=database(),env={DB:db};const fields={action:'register',email:'retry@example.com',name:'Retry',password:'test-password-only',role:'borrower'};
 db.failSession=true;const failed=await accountEndpoint(env,request(fields));assert.equal(failed.status,503);assert.equal(db.rows.size,0);assert.equal(failed.headers.get('set-cookie'),null);
 db.failSession=false;const success=await accountEndpoint(env,request(fields));assert.equal(success.status,200);
 const duplicate=await accountEndpoint(env,request(fields));assert.equal(duplicate.status,409);assert.equal((await duplicate.json() as any).code,'ACCOUNT_EXISTS');
 const loggedIn=await accountEndpoint(env,request({...fields,action:'login'}));assert.equal(loggedIn.status,200);
});

test('Account deletion is intentionally not supported',async()=>{
 const env={DB:database()};
 const result=await accountEndpoint(env,request({action:'deleteAccount',email:'owner@example.com',password:'test-password-only',confirmation:'XÓA TÀI KHOẢN'}));
 assert.equal(result.status,400);
 assert.equal(env.DB.rows.size,0);
});
