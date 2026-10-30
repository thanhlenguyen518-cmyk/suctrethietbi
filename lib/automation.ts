import {validate,route,mutate} from './workflow.ts';
import {runAI,aiFingerprint} from './ai.ts';
import {calibrationMetrics} from './calibration.ts';
import {reminderText,PROMPT_VERSION,CHECK_THRESHOLD} from './ai-schema.ts';
export function requestInput(s:any,r:any){return {id:r.id,name:r.name,purpose:r.purpose,start:r.start,end:r.end,items:r.items.map((i:any)=>({...i,name:s.equipment.find((e:any)=>e.id===i.id)?.name})),returnNote:r.returnNote,recordedAt:new Date(r.returnedAt||Date.now()).toISOString(),damage:r.damage||[]};}
export async function checkRequest(s:any,r:any,env:any,now=Date.now(),ai=runAI){
 const out=await ai(env,'check',requestInput(s,r));r.ai={...(r.ai||{}),check:{...out,at:now,promptVersion:PROMPT_VERSION,fingerprint:aiFingerprint(env)}};
 const metrics=calibrationMetrics(s.settings.calibration||[],aiFingerprint(env));
 if(!s.settings.autoCheck||!metrics.ready){r.ai.check.decision='manual_review';s.logs.unshift({id:crypto.randomUUID(),requestId:r.id,role:'system',action:'Kiểm tra mô tả; chờ người phụ trách xác nhận (chưa bật tự động hoặc chưa đủ hiệu chuẩn)',at:new Date(now).toISOString()});return s;}
 let ruleError='';try{validate(s,r,now)}catch(e:any){ruleError=e.message}
 if(!ruleError&&out.verdict==='valid'&&out.confidence>=CHECK_THRESHOLD){route(s,r,now);r.ai.check.decision='valid';r.reviewNote='Kiểm tra tự động: mô tả đạt ngưỡng, luật hợp lệ; hiệu chuẩn '+metrics.samples+' mẫu.'}
 else{r.status='supplement';r.note=ruleError||out.issues.join('; ')||'Mô tả chưa đạt ngưỡng tin cậy 0,95. Vui lòng bổ sung mục đích, địa điểm và nhu cầu sử dụng.';r.supplementUntil=now+86400000;r.ai.check.decision='needs_information';s.notices.unshift({id:crypto.randomUUID(),requestId:r.id,to:r.contact,body:r.note+' Hạn bổ sung: '+new Date(r.supplementUntil).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),at:new Date(now).toISOString(),channel:'in-app'})}
 s.logs.unshift({id:crypto.randomUUID(),requestId:r.id,role:'system',action:'Kiểm tra tự động theo ngưỡng 0,95 và luật: '+r.ai.check.decision,at:new Date(now).toISOString()});return s;
}
export function isOverdue(r:any,now:number){return r.status==='borrowed'&&!r.returnedAt&&Date.parse(r.end)<now;}
export async function prepareTimers(input:any,env:any,now=Date.now(),ai=runAI){
 const s:any=mutate(input,'staff','tick',{},now);
 for(const r of s.requests.filter((r:any)=>s.settings.autoReminders!==false&&isOverdue(r,now)&&(!r.lastReminder||now-r.lastReminder>=86400000)).slice(0,3)){
  let message='Lượt mượn của bạn đã quá hạn. Vui lòng kiểm tra và sắp xếp trả thiết bị.';let usedAI=false;
  try{const out=await ai(env,'reminder',requestInput(s,r));message=out.message;usedAI=true;r.ai={...(r.ai||{}),reminder:{draft:reminderText(requestInput(s,r),message),at:now}}}catch(e:any){r.lastAIError=String(e.message).slice(0,500)}
  if(!isOverdue(r,now)||r.lastReminder&&now-r.lastReminder<86400000)continue;
  const body=reminderText(requestInput(s,r),message),id=crypto.randomUUID();
  s.notices.unshift({id,requestId:r.id,to:r.contact,body,at:new Date(now).toISOString(),channel:'in-app',type:'overdue',emailStatus:s.settings.emailEnabled?'queued':'disabled',aiAssisted:usedAI});r.lastReminder=now;
  s.logs.unshift({id:crypto.randomUUID(),requestId:r.id,role:'system',action:usedAI?'Tạo nhắc trả quá hạn có AI hỗ trợ':'Tạo nhắc trả theo mẫu dự phòng (AI chưa sẵn sàng)',at:new Date(now).toISOString()});
 }
 for(const r of s.requests){if(['payment','debt_plan'].includes(r.status)&&now-r.compensationAt>=7*86400000&&!r.debtEscalatedAt){r.debtEscalatedAt=now;s.notices.unshift({id:crypto.randomUUID(),requestId:r.id,to:'Ban chủ nhiệm',body:'Khoản bồi thường còn thiếu sau 7 ngày: '+(r.amount-r.paid)+' đồng. Cần lập phương án xử lý.',at:new Date(now).toISOString(),channel:'in-app'})}}
 s.settings.lastJob={at:new Date(now).toISOString(),status:'succeeded'};return s;
}
