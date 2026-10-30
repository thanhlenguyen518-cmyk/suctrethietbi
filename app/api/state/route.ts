import {env} from 'cloudflare:workers';
import {mutate} from '../../../lib/workflow';
import {runAI,aiConfig,aiFingerprint} from '../../../lib/ai';
import {loadWorkspace,loadOwner,saveWorkspace,sameOrigin,json} from '../../../lib/storage';
import {withLock} from '../../../lib/locking';
import {requestInput,checkRequest} from '../../../lib/automation';
import {calibrationMetrics} from '../../../lib/calibration';
import {reportText,reminderText} from '../../../lib/ai-schema';
import {imageInputs} from '../../../lib/evidence';
import {mailReady} from '../../../lib/mail';
function publicState(s:any){return {...s,requests:s.requests.map((r:any)=>({...r,photos:(r.photos||[]).map(({key,...p}:any)=>p)})),settings:{...s.settings,calibration:undefined}}}
export async function GET(req:Request){try{const {s,version}=await loadWorkspace(env,req);return json({...publicState(s),version,aiReady:aiConfig(env).ready,aiConfiguration:{...aiConfig(env),fingerprint:aiFingerprint(env)},calibration:calibrationMetrics(s.settings.calibration||[],aiFingerprint(env)),mailReady:mailReady(env),schedulerEnabled:(env as any).SCHEDULER_ENABLED==='true'})}catch(e:any){return json({error:e.message==='AUTH'?'Vui lòng đăng nhập ChatGPT để sử dụng.':e.message},e.message==='AUTH'?401:503)}}
export async function POST(req:Request){try{
 sameOrigin(req);if(Number(req.headers.get('content-length')||0)>200000)throw new Error('Dữ liệu quá lớn.');const b:any=await req.json();if(JSON.stringify(b).length>200000)throw new Error('Dữ liệu quá lớn.');if(!['borrower','staff','board'].includes(b.role))throw new Error('Vai trò không hợp lệ.');const initial=await loadWorkspace(env,req);
 return await withLock(initial.db,initial.owner,async()=>{
 const {owner,db,s,version}=await loadOwner(env,initial.owner);if(b.version!==version)return json({error:'Dữ liệu đã thay đổi. Tải lại trước khi thực hiện.'},409);let next:any=s;const p=b.payload||{};
 if(b.action==='ai'){
  if(b.role!=='staff')throw new Error('Chỉ phụ trách thiết bị được thực hiện.');const r=s.requests.find((r:any)=>r.id===p.id);if(!r)throw new Error('Không tìm thấy hồ sơ.');const kind=p.kind;
  if(!['check','reminder','incident'].includes(kind)||kind==='check'&&r.status!=='review'||kind==='incident'&&r.status!=='incident'||kind==='reminder'&&(r.status!=='borrowed'||Date.parse(r.end)>=Date.now()))throw new Error('Trạng thái không phù hợp cho tác vụ.');
  if(kind==='check')next=await checkRequest(s,r,env);
  else{const images=kind==='incident'?await imageInputs(env,r):[];const out=await runAI(env,kind,requestInput(s,r),images);r.ai={...(r.ai||{}),[kind]:{...out,draft:kind==='incident'?reportText(out):reminderText(requestInput(s,r),out.message),at:Date.now()}};s.logs.unshift({id:crypto.randomUUID(),requestId:r.id,role:'staff',action:'Tạo bản nháp '+(kind==='incident'?'biên bản':'nhắc trả')+'; chờ kiểm tra',at:new Date().toISOString()})}
 }else if(b.action==='connectionTest'){
  if(b.role!=='board')throw new Error('Chỉ Ban chủ nhiệm được kiểm tra cấu hình.');const out=await runAI(env,'check',{id:'TEST-CONNECTION',name:'Kiểm tra kết nối',purpose:'Mượn micro cho sinh hoạt CLB tại phòng sinh hoạt',start:'2030-01-01T01:00:00Z',end:'2030-01-01T03:00:00Z',items:[{id:'TEST-MIC',name:'Micro',qty:1}]});s.settings.connectionTest={at:new Date().toISOString(),ok:true,model:aiConfig(env).model};s.logs.unshift({id:crypto.randomUUID(),role:'board',requestId:'',action:'Kiểm tra kết nối AI thành công và nhận JSON hợp lệ',at:new Date().toISOString()});
 }else if(b.action==='calibration'){
  if(b.role!=='board')throw new Error('Chỉ Ban chủ nhiệm được kiểm thử hiệu chuẩn.');if(!Array.isArray(p.cases)||!p.cases.length||p.cases.length>3)throw new Error('Mỗi lượt tối đa 3 mẫu có nhãn.');const existing=s.settings.calibration||[];const validated:any[]=[];for(const c of p.cases){if(typeof c.caseId!=='string'||c.caseId.length>80||typeof c.expectedValid!=='boolean'||typeof c.purpose!=='string'||c.purpose.length>3000||!Array.isArray(c.items)||!c.items.length||c.items.length>10||typeof c.start!=='string'||typeof c.end!=='string'||c.items.some((i:any)=>typeof i.id!=='string'||typeof i.name!=='string'||!Number.isSafeInteger(i.qty)||i.qty<1))throw new Error('Mẫu kiểm thử sai định dạng.');const canonical=JSON.stringify({purpose:c.purpose,start:c.start,end:c.end,items:c.items});const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical)))).map(x=>x.toString(16).padStart(2,'0')).join('');if(existing.some((e:any)=>e.digest===digest&&e.fingerprint===aiFingerprint(env))||validated.some((e:any)=>e.digest===digest))throw new Error('Mẫu kiểm thử bị trùng nội dung.');validated.push({...c,digest});}
  for(const c of validated){const {expectedValid,caseId,digest,...input}=c;const output=await runAI(env,'check',input);existing.push({caseId,digest,expectedValid,output,fingerprint:aiFingerprint(env),at:Date.now()})}s.settings.calibration=existing.slice(-1000);s.logs.unshift({id:crypto.randomUUID(),role:'board',requestId:'',action:'Thêm '+validated.length+' mẫu kiểm thử có nhãn; không dùng nhãn làm đầu vào AI',at:new Date().toISOString()});
 }else if(b.action==='automationSettings'){
  if(b.role!=='board')throw new Error('Chỉ Ban chủ nhiệm được thay đổi tự động hóa.');if(p.autoCheck&&!calibrationMetrics(s.settings.calibration||[],aiFingerprint(env)).ready)throw new Error('Chưa đủ bằng chứng hiệu chuẩn để bật tự chuyển nhánh.');if(p.emailEnabled&&!mailReady(env))throw new Error('Cần cấu hình dịch vụ email và địa chỉ gửi trước.');s.settings.autoCheck=p.autoCheck===true;s.settings.autoReminders=p.autoReminders===true;s.settings.emailEnabled=p.emailEnabled===true;
 }else if(b.action==='sendReminder'){
  if(b.role!=='staff')throw new Error('Chỉ phụ trách được xác nhận lời nhắc.');const r=s.requests.find((r:any)=>r.id===p.id);if(!r||r.status!=='borrowed'||Date.parse(r.end)>=Date.now())throw new Error('Lượt mượn không còn quá hạn hoặc đã trả.');if(r.lastReminder&&Date.now()-r.lastReminder<86400000)throw new Error('Đã nhắc trong 24 giờ gần nhất.');const body=String(p.note||'').trim();if(!body||body.length>10000)throw new Error('Kiểm tra nội dung nhắc trả.');r.lastReminder=Date.now();s.notices.unshift({id:crypto.randomUUID(),requestId:r.id,to:r.contact,body,at:new Date().toISOString(),channel:'in-app',type:'overdue',emailStatus:s.settings.emailEnabled?'queued':'disabled'});s.logs.unshift({id:crypto.randomUUID(),requestId:r.id,role:'staff',action:'Lưu lời nhắc và xếp hàng email nếu được bật',at:new Date().toISOString()});
 }else{
  next=mutate(s,b.role,b.action,p);
  if(['create','resubmit'].includes(b.action)&&next.settings.autoCheck){const r=b.action==='create'?next.requests[0]:next.requests.find((r:any)=>r.id===p.id);try{next=await checkRequest(next,r,env)}catch(e:any){r.lastAIError=String(e.message).slice(0,500);next.logs.unshift({id:crypto.randomUUID(),requestId:r.id,role:'system',action:'AI chưa xử lý được; đơn đã lưu và chuyển kiểm tra thủ công',at:new Date().toISOString()})}}
 }
 await saveWorkspace(db,owner,version,next);return json({ok:true});
 });
 }catch(e:any){return json({error:e.message==='AUTH'?'Cần đăng nhập.':e.message},e.message==='AUTH'?401:400)}}
