import {digest} from './accounts.ts';
const cookie=(v:string,age=600)=>`suctre_google=${v}; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function googleAuth(env:any,req:Request,fetcher:typeof fetch=fetch){
 const url=new URL(req.url),callback=url.origin+'/api/auth/google/callback';
 const fail=(message:string,status=400)=>new Response(message,{status,headers:{'Cache-Control':'no-store','Set-Cookie':cookie('',0)}});
 if(req.method!=='GET')return fail('Method not allowed',405);
 if(!env.DB||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)return fail('Đăng nhập Google chưa được cấu hình. Vui lòng đăng nhập bằng email và mật khẩu.',503);
 try{
 if(url.pathname==='/api/auth/google'){
  const state=crypto.randomUUID()+crypto.randomUUID(),verifier=crypto.randomUUID()+crypto.randomUUID();
  await env.DB.prepare('INSERT INTO workspaces(id,version,data) VALUES(?,0,?)').bind('oauth:'+await digest(state),JSON.stringify({verifier,expires:Date.now()+600000})).run();
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  const challenge=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:callback,response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
  return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':cookie(state),'Cache-Control':'no-store'}});
 }
 const state=url.searchParams.get('state')||'',saved=req.headers.get('cookie')?.match(/(?:^|;\s*)suctre_google=([a-f0-9-]{72})(?:;|$)/)?.[1];
 if(!saved||state!==saved)return fail('Phiên Google không hợp lệ. Hãy đăng nhập lại.');
 const record=await env.DB.prepare('DELETE FROM workspaces WHERE id=? RETURNING data').bind('oauth:'+await digest(state)).first();
 if(!record)return fail('Phiên Google đã được sử dụng.');
 const flow=JSON.parse(record.data);if(flow.expires<Date.now()||url.searchParams.has('error')||!url.searchParams.get('code'))return fail('Đăng nhập Google đã hủy hoặc hết hạn.');
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,code:url.searchParams.get('code')!,code_verifier:flow.verifier,redirect_uri:callback,grant_type:'authorization_code'}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)return fail('Không xác nhận được đăng nhập Google.',502);
 const token:any=await response.json();if(!token.access_token)return fail('Google chưa cấp quyền đăng nhập.',502);
 const info=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});
 if(!info.ok)return fail('Không đọc được tài khoản Google.',502);
 const profile:any=await info.json(),email=String(profile.email||'').toLowerCase();
 if(profile.email_verified!==true||!profile.sub||!/^\S+@\S+\.\S+$/.test(email)||email.length>160)return fail('Google chưa xác minh email.');
 const existing=await env.DB.prepare('SELECT data FROM workspaces WHERE id=?').bind('account:'+email).first();
 if(existing){const account=JSON.parse(existing.data);if(account.googleSub!==profile.sub)return fail('Email này đã có tài khoản. Hãy đăng nhập bằng mật khẩu; chưa hỗ trợ tự liên kết tài khoản Google.',409)}
 const generation=existing?JSON.parse(existing.data).salt:crypto.randomUUID();
 const session=crypto.randomUUID()+crypto.randomUUID(),writes=[];
 if(!existing)writes.push(env.DB.prepare('INSERT INTO workspaces(id,version,data) VALUES(?,0,?)').bind('account:'+email,JSON.stringify({email,name:String(profile.name||email).slice(0,120),role:'borrower',googleSub:profile.sub,salt:generation,hash:'google-only',emailVerified:true})));
 else {const account=JSON.parse(existing.data);if(account.emailVerified!==true)writes.push(env.DB.prepare('UPDATE workspaces SET data=?,version=version+1 WHERE id=? AND data=?').bind(JSON.stringify({...account,emailVerified:true}),'account:'+email,existing.data));}
 writes.push(env.DB.prepare('INSERT INTO workspaces(id,version,data) VALUES(?,0,?)').bind('session:'+await digest(session),JSON.stringify({email,generation,issuedAt:Date.now(),expires:Date.now()+86400000})));
 await env.DB.batch(writes);
 const headers=new Headers({'Location':'/','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});headers.append('Set-Cookie',cookie('',0));headers.append('Set-Cookie',`suctre_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
 return new Response(null,{status:302,headers});
 }catch{return fail('Chưa thể đăng nhập Google. Vui lòng thử lại.',503)}
}
