import {authenticatedAccount} from '../../../lib/accounts';
import {env} from 'cloudflare:workers';
import {mutate,displayStatus,isApprovalOverdue} from '../../../lib/workflow';
import {runAI,aiConfig,aiFingerprint} from '../../../lib/ai';
import {loadWorkspace,loadOwner,saveWorkspace,sameOrigin,json} from '../../../lib/storage';
import {withLock} from '../../../lib/locking';
import {requestInput,checkRequest} from '../../../lib/automation';
import {calibrationMetrics} from '../../../lib/calibration';
import {reportText,reminderText} from '../../../lib/ai-schema';
import {imageInputs} from '../../../lib/evidence';
import {mailReady,mailProvider} from '../../../lib/mail';
import {personalLogs,attributeNewLogs} from '../../../lib/activity';
import {queueActivityNotices,activityActions} from '../../../lib/activity-email';
import {borrowedQuantity,reservedQuantity,visibleNotices} from '../../../lib/visibility';
function visibleState(s:any,req:Request){
 const result=publicState(s);
 result.requests=result.requests.map((r:any)=>({...r,status:displayStatus(r)}));
 const email=req.headers.get('x-suctre-account');
 const role=req.headers.get('x-suctre-role');
 result.logs=personalLogs(result.logs,email,req.headers.get('oai-authenticated-user-id'));
 const allRequests=result.requests;
 // Public inventory counts refer to all borrowers, not only the current user's records.
 result.activeBorrowedCount=borrowedQuantity(allRequests);
 result.activeReservedCount=reservedQuantity(allRequests);
 if(role==='borrower'){
  result.requests=result.requests.filter((r:any)=>r.accountEmail===email);
  const ids=new Set<string>(result.requests.map((r:any)=>String(r.id)));
  result.logs=result.logs.filter((l:any)=>ids.has(l.requestId));
  result.settings={};
  result.notices=visibleNotices(result.notices,role,email,ids);
 }else{
  // Legacy notices used role identifiers, while newer notifications may target an email.
  result.notices=visibleNotices(result.notices,role,email);
 }
 return result;
}
function publicState(s:any){return {...s,requests:s.requests.map((r:any)=>({...r,photos:(r.photos||[]).map(({key,...p}:any)=>p)})),settings:{...s.settings,calibration:undefined}}}
export async function GET(req:Request){try{const {s,version}=await loadWorkspace(env,req);return json({...visibleState(s,req),version,aiReady:aiConfig(env).ready,aiConfiguration:{...aiConfig(env),fingerprint:aiFingerprint(env)},calibration:calibrationMetrics(s.settings.calibration||[],aiFingerprint(env)),mailReady:mailReady(env),mailSetup:req.headers.get('x-suctre-role')==='board'?{gmailUrl:!!(env as any).GMAIL_SCRIPT_URL,gmailSecret:!!(env as any).GMAIL_SCRIPT_SECRET,provider:mailProvider(env)}:undefined,schedulerEnabled:(env as any).SCHEDULER_ENABLED==='true'})}catch(e:any){return json({error:e.message==='AUTH'?'Vui lòng đăng nhập ChatGPT để sử dụng.':e.message},e.message==='AUTH'?401:503)}}
export async function POST(req:Request){try{
 sameOrigin(req);if(Number(req.headers.get('content-length')||0)>200000)throw new Error('Dữ liệu quá lớn.');const b:any=await req.json();if(JSON.stringify(b).length>200000)throw new Error('Dữ liệu quá lớn.');if(!['borrower','staff','board'].includes(b.role))throw new Error('Vai trò không hợp lệ.');const assigned=req.headers.get('x-suctre-role');if(assigned&&b.role!==assigned)return json({error:'Bạn không có quyền sử dụng vai trò này.'},403);const initial=await loadWorkspace(env,req);
 return await withLock(initial.db,initial.owner,async()=>{
 const verifiedUser=req.headers.get('x-suctre-account')?await authenticatedAccount(env,req):null;if(req.headers.get('x-suctre-account')&&!verifiedUser)return json({error:'Phiên đăng nhập đã kết thúc.'},401);if(['create','resubmit'].includes(b.action)&&req.headers.get('x-suctre-account')&&verifiedUser?.emailVerified!==true)return json({error:'Bạn cần xác minh email trong Thông tin tài khoản trước khi gửi đơn.'},403);
 const {owner,db,s,version}=await loadOwner(env,initial.owner);if(b.action==='create'&&typeof b.payload?.submissionId==='string'&&b.payload.submissionId.length===36&&s.requests.some((r:any)=>r.submissionId===b.payload.submissionId&&r.accountEmail===req.headers.get('x-suctre-account')))return json({ok:true,duplicate:true});if(b.version!==version&&b.action!=='create')return json({error:'Dữ liệu đã thay đổi. Tải lại trước khi thực hiện.'},409);const previousLogs=[...s.logs];let next:any=s;const p=b.payload||{};
 if(p.id&&isApprovalOverdue(s.requests.find((r:any)=>r.id===p.id)))return json({error:'Đơn đã quá thời gian nhận và chưa được duyệt. Chỉ được xem thông tin.',code:'APPROVAL_OVERDUE'},409);const account=req.headers.get('x-suctre-account');if(assigned==='borrower'){if(p.id&&!s.requests.some((r:any)=>r.id===p.id&&r.accountEmail===account))return json({error:'Bạn không có quyền thao tác hồ sơ này.'},403);if(['create','resubmit'].includes(b.action)){p.name=decodeURIComponent(req.headers.get('x-suctre-name')||'');p.contact=account;}}
 if(b.action==='ai'){
  if(b.role!=='staff')throw new Error('Chỉ phụ trách thiết bị được thực hiện.');const r=s.requests.find((r:any)=>r.id===p.id);if(!r)throw new Error('Không tìm thấy hồ sơ.');const kind=p.kind;
  if(!['check','reminder','incident'].includes(kind)||kind==='check'&&r.status!=='review'||kind==='incident'&&r.status!=='incident'||kind==='reminder'&&(r.status!=='borrowed'||Date.parse(r.end)>=Date.now()))throw new Error('Trạng thái không phù hợp cho tác vụ.');
  if(kind==='check'){next=await checkRequest(s,r,env);next.logs.unshift({id:crypto.randomUUID(),requestId:r.id,role:'staff',action:'Yêu cầu AI kiểm tra mô tả đơn',at:new Date().toISOString()})}
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
  next=mutate(s,b.role,b.action,p);if(b.action==='create'&&account)next.requests[0].accountEmail=account;
  if(['create','resubmit'].includes(b.action)&&next.settings.autoCheck){const r=b.action==='create'?next.requests[0]:next.requests.find((r:any)=>r.id===p.id);try{next=await checkRequest(next,r,env)}catch(e:any){r.lastAIError=String(e.message).slice(0,500);next.logs.unshift({id:crypto.randomUUID(),requestId:r.id,role:'system',action:'AI chưa xử lý được; đơn đã lưu và chuyển kiểm tra thủ công',at:new Date().toISOString()})}}
 }
 if(activityActions.has(b.action)){
  const requestId=b.action==='create'?String(next.requests[0]?.id||''):String(p.id||p.code||'');
  const accounts=await db.prepare("SELECT data FROM workspaces WHERE id LIKE 'account:%' LIMIT 250").all();
  const roleEmails:Record<string,string[]>={staff:[],board:[]};
  for(const row of accounts.results||[]){
   try{const user=JSON.parse(row.data);if(user.emailVerified===true&&['staff','board'].includes(user.role)&&typeof user.email==='string')roleEmails[user.role].push(user.email)}catch{}
  }
  queueActivityNotices(next,s,b.action,requestId,b.role,roleEmails);
 }
 attributeNewLogs(previousLogs,next.logs,account,owner);
 await saveWorkspace(db,owner,version,next);return json({ok:true});
 });
 }catch(e:any){return json({error:e.message==='AUTH'?'Cần đăng nhập.':e.message},e.message==='AUTH'?401:400)}}
