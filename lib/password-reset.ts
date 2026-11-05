import {mailReady,sendTransactionalEmail} from './mail.ts';
import {digest,passwordHash} from './accounts.ts';
export async function resetPassword(env:any,req:Request,b:any,fetcher:typeof fetch=fetch){
 const reply=(x:any,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 const email=String(b.email||'').trim().toLowerCase();
 if(b.action==='forgotPassword'){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>160)return reply({error:'Nhập email hợp lệ.'},400);
  if(!mailReady(env))return reply({error:'Chưa cấu hình email khôi phục mật khẩu. Vui lòng liên hệ người quản lý website.'},503);
  const result=await env.DB.prepare('INSERT INTO workspaces(id,version,data) VALUES(?,0,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE CAST(json_extract(workspaces.data,\'$.at\') AS INTEGER) < ? RETURNING id').bind('reset-limit:'+await digest(email),JSON.stringify({at:Date.now()}),Date.now()-60000).first();
  if(!result)return reply({error:'Vui lòng chờ một phút trước khi yêu cầu lại.'},429);
  const row=await env.DB.prepare('SELECT data FROM workspaces WHERE id=?').bind('account:'+email).first();
  if(row){const account=JSON.parse(row.data),token=crypto.randomUUID()+crypto.randomUUID();const id='reset:'+await digest(token);await env.DB.prepare('INSERT INTO workspaces(id,version,data) VALUES(?,0,?)').bind(id,JSON.stringify({email,hash:account.hash,expires:Date.now()+900000})).run();
   const link=new URL('/reset/'+encodeURIComponent(token),req.url);
   try{
    await sendTransactionalEmail(env,email,'Sức Trẻ — Đặt lại mật khẩu','Bạn đã yêu cầu đặt lại mật khẩu. Mở liên kết sau trong 15 phút: '+link.href+'\nNếu không phải bạn yêu cầu, hãy bỏ qua email này.',id,fetcher);
   }catch(e:any){
    await env.DB.prepare('DELETE FROM workspaces WHERE id=?').bind(id).run();
    return reply({error:e.message||'Chưa gửi được email khôi phục. Vui lòng thử lại sau.'},503);
   }
  }
  return reply({ok:true,message:'Nếu email đã được đăng ký, liên kết đặt lại mật khẩu sẽ được gửi tới địa chỉ đó. Hãy kiểm tra cả thư rác.'});
 }
 const token=typeof b.token==='string'?b.token:'';
 const password=typeof b.password==='string'?b.password:'';
 if(!/^[a-f0-9-]{72}$/.test(token))return reply({error:'Liên kết đặt lại mật khẩu không đầy đủ hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới từ trang đăng nhập.'},400);
 if(password.length<10||password.length>128)return reply({error:'Mật khẩu mới phải có từ 10 đến 128 ký tự.'},400);
 if(password!==b.confirmPassword)return reply({error:'Hai mật khẩu không trùng khớp. Vui lòng kiểm tra lại từng ký tự.'},400);
 const row=await env.DB.prepare('SELECT data FROM workspaces WHERE id=?').bind('reset:'+await digest(token)).first();if(!row)return reply({error:'Liên kết không hợp lệ hoặc đã được sử dụng.'},400);const reset=JSON.parse(row.data);if(reset.expires<Date.now())return reply({error:'Liên kết đã hết hạn. Hãy yêu cầu liên kết mới.'},400);
 const arow=await env.DB.prepare('SELECT data FROM workspaces WHERE id=?').bind('account:'+reset.email).first();if(!arow)return reply({error:'Liên kết không hợp lệ.'},400);const a=JSON.parse(arow.data);if(a.hash!==reset.hash)return reply({error:'Liên kết đã được sử dụng hoặc mật khẩu đã thay đổi.'},400);
 const salt=crypto.randomUUID(),hash=await passwordHash(password,salt);const next={...a,salt,hash,passwordChangedAt:Date.now()};
 const result=await env.DB.prepare('UPDATE workspaces SET data=?,version=version+1 WHERE id=? AND data=?').bind(JSON.stringify(next),'account:'+reset.email,arow.data).run();if(!result.meta.changes)return reply({error:'Mật khẩu vừa thay đổi. Hãy yêu cầu liên kết mới.'},409);
 await env.DB.prepare('DELETE FROM workspaces WHERE id=?').bind('reset:'+await digest(token)).run();return reply({ok:true,message:'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.'});
}
