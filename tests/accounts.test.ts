import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountEndpoint,authenticatedAccount} from '../lib/accounts.ts';
function database(){const rows=new Map<string,string>();return {prepare(sql:string){let args:any[]=[];return {bind(...a:any[]){args=a;return this},async first(){return rows.has(args[0])?{data:rows.get(args[0])}:null},async run(){if(sql.startsWith('DELETE'))return {meta:{changes:Number(rows.delete(args[0]))}};if(sql.includes('OR IGNORE')&&rows.has(args[0]))return {meta:{changes:0}};rows.set(args[0],args[1]);return {meta:{changes:1}}}}}}}
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
