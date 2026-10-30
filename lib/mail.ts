export function mailReady(env:any){return !!(env.RESEND_API_KEY&&env.MAIL_FROM)}
export async function sendEmail(env:any,notice:any,fetcher:typeof fetch=fetch){
 if(!mailReady(env))throw new Error('Chưa cấu hình dịch vụ email hoặc địa chỉ gửi.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notice.to))throw new Error('Liên hệ không phải địa chỉ email hợp lệ.');
 const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'suctre-'+notice.id},body:JSON.stringify({from:env.MAIL_FROM,to:[notice.to],subject:'CLB Sức Trẻ — Nhắc trả thiết bị '+notice.requestId,text:notice.body}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Dịch vụ gửi email trả lỗi '+response.status);const body:any=await response.json();if(!body.id)throw new Error('Dịch vụ email không trả mã tiếp nhận.');return body.id;
}
