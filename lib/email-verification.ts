const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const key=async(email:string)=>'email-verify:'+await digest(email);
const cooldown=async(email:string)=>'email-limit:'+await digest(email);
export async function sendVerificationCode(env:any,email:string,fetcher:typeof fetch=fetch){
 email=email.trim().toLowerCase();
 if(!emailPattern.test(email)||email.length>160)throw new Error('Địa chỉ email không hợp lệ.');
 if(!env.RESEND_API_KEY||!env.MAIL_FROM)throw new Error('Chưa cấu hình dịch vụ email xác minh. Vui lòng liên hệ quản trị viên.');
 const now=Date.now(),limitId=await cooldown(email);
 // Enforce a per-address cooldown, including across concurrent requests.
 const allowed=await env.DB.prepare("INSERT INTO workspaces(id,version,data) VALUES(?,0,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE CAST(json_extract(workspaces.data,'$.at') AS INTEGER) < ? RETURNING id").bind(limitId,JSON.stringify({at:now}),now-60000).first();
 if(!allowed)throw new Error('Vui lòng chờ 60 giây rồi yêu cầu lại mã xác minh.');
 const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
 const nonce=crypto.randomUUID();
 const id=await key(email);
 // Hash codes with a random nonce rather than storing a plaintext OTP.
 const record={hash:await digest(nonce+':'+code),nonce,expires:now+10*60000,tries:0};
 await env.DB.prepare('INSERT INTO workspaces(id,version,data) VALUES(?,0,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=version+1').bind(id,JSON.stringify(record)).run();
 try{
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:'Sức Trẻ — Mã xác minh email',text:'Mã xác minh của bạn là: '+code+'\nMã có hiệu lực 10 phút. Nếu không yêu cầu, hãy bỏ qua email này.'}),signal:AbortSignal.timeout(15000)});
  if(!response.ok||((await response.json()) as any).id==null)throw new Error('mail failed');
 }catch{
  await env.DB.prepare('DELETE FROM workspaces WHERE id=?').bind(id).run();
  throw new Error('Chưa gửi được mã xác minh. Hãy kiểm tra cấu hình email.');
 }
}
export async function consumeVerificationCode(env:any,email:string,code:string){
 email=email.trim().toLowerCase();
 if(!/^\d{6}$/.test(code))return false;
 const id=await key(email);
 const row=await env.DB.prepare('SELECT data,version FROM workspaces WHERE id=?').bind(id).first();
 if(!row)return false;
 const record=JSON.parse(row.data);
 if(record.expires<Date.now()||record.tries>=5)return false;
 if(await digest(record.nonce+':'+code)!==record.hash){
  await env.DB.prepare('UPDATE workspaces SET data=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify({...record,tries:record.tries+1}),id,row.version).run();
  return false;
 }
 const used=await env.DB.prepare('DELETE FROM workspaces WHERE id=? AND version=? RETURNING id').bind(id,row.version).first();
 return !!used;
}
