import {resetPassword} from './password-reset.ts';
import {sendVerificationCode,consumeVerificationCode} from './email-verification.ts';
import {mailReady} from './mail.ts';
export type Account={email:string;name:string;role:'borrower'|'staff'|'board';salt:string;hash:string;emailVerified?:boolean};
export const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function read(db:any,id:string){const row=await db.prepare('SELECT data FROM workspaces WHERE id=?').bind(id).first();return row?JSON.parse(row.data):null}
export async function authenticatedAccount(env:any,req:Request):Promise<Account|null>{const token=req.headers.get('cookie')?.match(/(?:^|;\s*)suctre_session=([a-f0-9-]{72})(?:;|$)/)?.[1];if(!token)return null;const session=await read(env.DB,'session:'+await digest(token));if(!session||session.expires<Date.now())return null;const account=await read(env.DB,'account:'+session.email);if(session.generation&&session.generation!==account?.salt)return null;if(account?.passwordChangedAt&&(!session.issuedAt||session.issuedAt<=account.passwordChangedAt))return null;return account}
export async function accountEndpoint(env:any,req:Request,fetcher:typeof fetch=fetch){const reply=(data:any,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});try{
 if(!env.DB)return reply({error:'Cơ sở dữ liệu chưa sẵn sàng.'},503);
 if(req.method==='GET'){const a=await authenticatedAccount(env,req);return reply({user:a?{email:a.email,name:a.name,role:a.role,emailVerified:a.emailVerified===true}:null,emailVerificationAvailable:mailReady(env)})}
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Nguồn yêu cầu không hợp lệ.'},403);
 const raw=await req.text();if(raw.length>4096)return reply({error:'Dữ liệu quá lớn.'},413);let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'Dữ liệu tài khoản không hợp lệ.'},400)}
 if(['forgotPassword','resetPassword'].includes(b.action))return resetPassword(env,req,b);
 if(b.action==='sendEmailCode'){
  const signed=await authenticatedAccount(env,req);
  const email=signed?.email||String(b.email||'').trim().toLowerCase();
  if(!signed&&await read(env.DB,'account:'+email))return reply({error:'Email đã có tài khoản. Vui lòng đăng nhập.'},409);
  try{await sendVerificationCode(env,email,fetcher);return reply({ok:true,message:'Đã gửi mã gồm 6 số tới email. Mã có hiệu lực 10 phút.'})}catch(e:any){return reply({error:e.message},e.message.includes('60 giây')?429:503)}
 }
 if(b.action==='verifyMyEmail'){
  const a=await authenticatedAccount(env,req);
  if(!a)return reply({error:'Cần đăng nhập trước.'},401);
  if(a.emailVerified===true)return reply({ok:true});
  if(!await consumeVerificationCode(env,a.email,String(b.verificationCode||'')))return reply({error:'Mã xác minh không đúng hoặc đã hết hạn.'},400);
  const row=await env.DB.prepare('SELECT data FROM workspaces WHERE id=?').bind('account:'+a.email).first();
  if(!row)return reply({error:'Tài khoản không tồn tại.'},404);
  await env.DB.prepare('UPDATE workspaces SET data=?,version=version+1 WHERE id=? AND data=?').bind(JSON.stringify({...JSON.parse(row.data),emailVerified:true}),'account:'+a.email,row.data).run();
  return reply({ok:true});
 }
 if(b.action==='logout'){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)suctre_session=([a-f0-9-]{72})(?:;|$)/)?.[1];if(token)await env.DB.prepare('DELETE FROM workspaces WHERE id=?').bind('session:'+await digest(token)).run();return reply({ok:true},200,'suctre_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0')}
 if(!['register','login'].includes(b.action))return reply({error:'Thao tác không hợp lệ.'},400);
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'',password=typeof b.password==='string'?b.password:'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>160)return reply({error:'Email không hợp lệ.'},400);
 if(password.length<10||password.length>128)return reply({error:b.action==='register'?'Mật khẩu phải có từ 10 đến 128 ký tự. Tài khoản chưa được tạo.':'Mật khẩu phải có từ 10 đến 128 ký tự.'},400);
 let a=await read(env.DB,'account:'+email);
 const registrationSalt=crypto.randomUUID();
 const token=crypto.randomUUID()+crypto.randomUUID();const session=env.DB.prepare('INSERT INTO workspaces(id,version,data) VALUES(?,0,?)').bind('session:'+await digest(token),JSON.stringify({email,generation:a?.salt||registrationSalt,issuedAt:Date.now(),expires:Date.now()+86400000}));
 if(b.action==='register'){
  if(a)return reply({error:'Email đã có tài khoản. Hãy đăng nhập bằng mật khẩu đã đăng ký.',code:'ACCOUNT_EXISTS'},409);
  const role=b.role||'borrower';if(!['borrower','staff','board'].includes(role))return reply({error:'Vai trò không hợp lệ.'},400);
  if(role!=='borrower'){const expected=role==='staff'?env.STAFF_ACCESS_CODE:env.BOARD_ACCESS_CODE;if(!expected||typeof b.code!=='string'||await digest(b.code)!==await digest(expected))return reply({error:'Mã cấp tài khoản cho vai trò này không đúng hoặc chưa được cấu hình.'},403)}
  const name=typeof b.name==='string'?b.name.trim():'';if(!name||name.length>120)return reply({error:'Nhập họ tên tối đa 120 ký tự.'},400);
  if(!await consumeVerificationCode(env,email,String(b.verificationCode||'')))return reply({error:'Bạn phải xác minh email bằng mã 6 số trước khi đăng ký.'},400);
  const salt=registrationSalt;a={email,name,role,salt,hash:await passwordHash(password,salt),emailVerified:true};
  // D1 batches are transactional: a session failure must roll back the account too.
  try{await env.DB.batch([env.DB.prepare('INSERT INTO workspaces(id,version,data) VALUES(?,0,?)').bind('account:'+email,JSON.stringify(a)),session])}
  catch{if(await read(env.DB,'account:'+email))return reply({error:'Email đã có tài khoản. Hãy đăng nhập bằng mật khẩu đã đăng ký.',code:'ACCOUNT_EXISTS'},409);return reply({error:'Chưa tạo được tài khoản. Vui lòng thử lại.',code:'REGISTRATION_FAILED'},503)}
 }else{
  // Atomic per-email throttle also applies to non-existent accounts.
  // This prevents unlimited online password guesses without exposing account existence.
  const now=Date.now();
  const throttle=await env.DB.prepare(
   "INSERT INTO workspaces(id,version,data) VALUES(?,0,?) "+
   "ON CONFLICT(id) DO UPDATE SET data=json_object('at', ?, 'count', CASE WHEN CAST(json_extract(workspaces.data,'$.at') AS INTEGER) > ? THEN COALESCE(CAST(json_extract(workspaces.data,'$.count') AS INTEGER),0)+1 ELSE 1 END),version=version+1 RETURNING data"
  ).bind('login-limit:'+await digest(email),JSON.stringify({at:now,count:1}),now,now-60000).first();
  if(!throttle||JSON.parse(throttle.data).count>10)return reply({error:'Quá nhiều lần đăng nhập trong một phút. Vui lòng thử lại sau.'},429);
  if(!a||await passwordHash(password,a.salt)!==a.hash)return reply({error:'Email hoặc mật khẩu không đúng.'},401);
  await env.DB.prepare('DELETE FROM workspaces WHERE id=?').bind('login-limit:'+await digest(email)).run();
  await session.run();
 }
 return reply({ok:true,user:{email:a.email,name:a.name,role:a.role,emailVerified:a.emailVerified===true}},200,`suctre_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
 }catch{return reply({error:'Không thể xử lý tài khoản. Vui lòng thử lại.'},503)}}

