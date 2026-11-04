import {loadOwner,saveWorkspace} from './storage.ts';
import {withLock} from './locking.ts';
import {prepareTimers,isOverdue} from './automation.ts';
import {mailReady,sendEmail} from './mail.ts';
export async function runMaintenance(env:any){
 if(!env.DB)throw new Error('Cơ sở dữ liệu chưa sẵn sàng.');const rows=await env.DB.prepare("SELECT id FROM workspaces WHERE id='club:suctre' OR (id NOT LIKE 'account:%' AND id NOT LIKE 'session:%' AND id NOT LIKE 'oauth:%' AND id NOT LIKE 'reset:%' AND id NOT LIKE 'reset-limit:%' AND id NOT LIKE 'deleted:%') ORDER BY id").all();let processed=0,sent=0;const failures:string[]=[];
 for(const {id:owner} of rows.results){try{await withLock(env.DB,owner,async()=>{
  const {s,version}=await loadOwner(env,owner);const next=await prepareTimers(s,env);await saveWorkspace(env.DB,owner,version,next);
  for(const n of next.notices.filter((n:any)=>n.type==='overdue'&&n.emailStatus==='queued'))await env.DB.prepare('INSERT OR IGNORE INTO mail_outbox(id,owner,request_id,payload,status,created) VALUES(?,?,?,?,?,?)').bind(n.id,owner,n.requestId,JSON.stringify(n),'pending',Date.parse(n.at)).run();
  const pending=await env.DB.prepare("SELECT * FROM mail_outbox WHERE owner=? AND status IN ('pending','retry') ORDER BY created LIMIT 3").bind(owner).all();let changed=false;
  for(const item of pending.results){const n=next.notices.find((n:any)=>n.id===item.id);const r=next.requests.find((r:any)=>r.id===item.request_id);let state='';let providerId='';let error='';
   if(!next.settings.emailEnabled||!r||!isOverdue(r,Date.now())||r.contact!==JSON.parse(item.payload).to){state='cancelled';error='Không còn đủ điều kiện gửi.';}
   else if(Date.now()-item.created>23*3600000){state='needs_review';error='Quá cửa sổ thử lại an toàn; cần kiểm tra trạng thái dịch vụ trước khi gửi lại.';}
   else if(!mailReady(env)){state='retry';error='Chưa cấu hình email.';}
   else{try{providerId=await sendEmail(env,JSON.parse(item.payload));state='accepted';sent++}catch(e:any){state='retry';error=e.message}}
   await env.DB.prepare('UPDATE mail_outbox SET status=?,provider_id=?,error=? WHERE id=?').bind(state,providerId||null,error||null,item.id).run();if(n){n.emailStatus=state;n.emailError=error;n.providerId=providerId;changed=true;}
  }
  if(changed)await saveWorkspace(env.DB,owner,version+1,next);processed++;
 })}catch(e:any){failures.push(String(e.message).slice(0,300))}}
 return {ok:failures.length===0,processed,emailsAccepted:sent,failures,at:new Date().toISOString()};
}
