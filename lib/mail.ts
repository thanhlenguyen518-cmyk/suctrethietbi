type Fetcher=typeof fetch;
const validEmail=(email:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=160;
/**
 * Prefer Google Apps Script whenever both Gmail configuration values are present.
 * This also supports older Cloudflare deployments that omitted EMAIL_PROVIDER.
 * Explicit gmail_script settings never silently fall back to Resend.
 */
export function mailProvider(env:any):'gmail_script'|'resend'|null{
 const gmail=!!(env.GMAIL_SCRIPT_URL&&env.GMAIL_SCRIPT_SECRET);
 if(env.EMAIL_PROVIDER==='gmail_script')return gmail?'gmail_script':null;
 if(gmail)return 'gmail_script';
 return env.RESEND_API_KEY&&env.MAIL_FROM?'resend':null;
}
export function mailReady(env:any){return mailProvider(env)!==null;}
/**
 * One server-only mail gateway for registration codes, password resets and reminders.
 * Google Apps Script mode uses a separate, secret-protected Apps Script deployment.
 * A provider acknowledgement means accepted for sending, not guaranteed delivery.
 */
export async function sendTransactionalEmail(env:any,to:string,subject:string,body:string,id:string,fetcher:Fetcher=fetch):Promise<string>{
 if(!validEmail(to))throw new Error('Địa chỉ email người nhận không hợp lệ.');
 if(!mailReady(env))throw new Error('Chưa cấu hình dịch vụ gửi email. Người quản lý cần hoàn tất thiết lập email.');
 if(mailProvider(env)==='gmail_script'){
  const url=new URL(String(env.GMAIL_SCRIPT_URL));
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)||url.search||url.hash)throw new Error('Địa chỉ Google Apps Script không hợp lệ.');
  const secret=String(env.GMAIL_SCRIPT_SECRET);
  if(secret.length<32)throw new Error('Khóa bảo vệ Google Apps Script phải dài ít nhất 32 ký tự.');
  let response:Response;
  try{
   response=await fetcher(url.href,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({secret,to,subject,body,id}),signal:AbortSignal.timeout(20000)});
  }catch{throw new Error('Không kết nối được dịch vụ gửi Gmail.');}
  if(!response.ok)throw new Error('Dịch vụ gửi Gmail chưa phản hồi thành công.');
  let data:any;
  try{data=await response.json()}catch{throw new Error('Phản hồi của dịch vụ Gmail không hợp lệ.');}
  if(data?.ok!==true||typeof data?.id!=='string')throw new Error('Gmail không chấp nhận gửi thư. Kiểm tra quyền cấp cho Google Apps Script và hạn mức Gmail.');
  return data.id;
 }
 let response:Response;
 try{
  response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject,text:body}),signal:AbortSignal.timeout(15000)});
 }catch{throw new Error('Không kết nối được dịch vụ gửi email.');}
 if(response.status===401||response.status===403)throw new Error('Resend chưa được cấp quyền gửi. Kiểm tra tên miền và API key.');
 if(response.status===422)throw new Error('Resend chưa xác minh địa chỉ gửi MAIL_FROM.');
 if(response.status===429)throw new Error('Dịch vụ email đang giới hạn số lần gửi.');
 if(!response.ok)throw new Error('Dịch vụ email tạm thời từ chối gửi thư.');
 let data:any;try{data=await response.json()}catch{throw new Error('Dịch vụ email trả dữ liệu không hợp lệ.');}
 if(typeof data?.id!=='string'||!data.id)throw new Error('Dịch vụ email không trả mã xác nhận.');
 return data.id;
}
export async function sendActivityEmail(env:any,notice:any,fetcher:Fetcher=fetch){
 if(notice.type!=='activity'||typeof notice.subject!=='string'||typeof notice.body!=='string')throw new Error('Thông báo hoạt động không hợp lệ.');
 return sendTransactionalEmail(env,notice.to,notice.subject,notice.body,'suctre-event-'+notice.id,fetcher);
}
export async function sendEmail(env:any,notice:any,fetcher:Fetcher=fetch){
 return sendTransactionalEmail(env,notice.to,'CLB Sức Trẻ — Nhắc trả thiết bị '+notice.requestId,notice.body,'suctre-'+notice.id,fetcher);
}
