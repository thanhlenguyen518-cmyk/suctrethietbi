import {loadOwner,saveWorkspace} from './storage.ts';
import {withLock} from './locking.ts';
import {prepareTimers,isOverdue} from './automation.ts';
import {mailReady,sendEmail,sendActivityEmail} from './mail.ts';
export const MAINTENANCE_WORKSPACES_SQL="SELECT id FROM workspaces WHERE json_valid(data)=1 AND json_type(data,'$.requests')='array' AND json_type(data,'$.equipment')='array' ORDER BY id";
export async function runMaintenance(env:any){
 if(!env.DB)throw new Error('Cơ sở dữ liệu chưa sẵn sàng.');const rows=await env.DB.prepare(MAINTENANCE_WORKSPACES_SQL).all();let processed=0,sent=0;const failures:string[]=[];
 for(const {id:owner} of rows.results){try{await withLock(env.DB,owner,async()=>{
  const {s,version}=await loadOwner(env,owner);const next=await prepareTimers(s,env);await saveWorkspace(env.DB,owner,version,next);
  for(const n of next.notices.filter((n:any)=>['overdue','activity'].includes(n.type)&&n.emailStatus==='queued'))await env.DB.prepare('INSERT OR IGNORE INTO mail_outbox(id,owner,request_id,payload,status,created) VALUES(?,?,?,?,?,?)').bind(n.id,owner,n.requestId,JSON.stringify(n),'pending',Date.parse(n.at)).run();
  const pending=await env.DB.prepare("SELECT * FROM mail_outbox WHERE owner=? AND status IN ('pending','retry') ORDER BY created LIMIT 10").bind(owner).all();let changed=false;
  for(const item of pending.results){const n=next.notices.find((n:any)=>n.id===item.id);const r=next.requests.find((r:any)=>r.id===item.request_id);let state='';let providerId='';let error='';
   if(JSON.parse(item.payload).type==='overdue'&&(!next.settings.emailEnabled||!r||!isOverdue(r,Date.now())||r.contact!==JSON.parse(item.payload).to)){state='cancelled';error='Không còn đủ điều kiện gửi.';}
   else if(Date.now()-item.created>23*3600000){state='needs_review';error='Quá cửa sổ thử lại an toàn; cần kiểm tra trạng thái dịch vụ trước khi gửi lại.';}
   else if(!mailReady(env)){state='retry';error='Chưa cấu hình email.';}
   else{try{const payload=JSON.parse(item.payload);providerId=payload.type==='activity'?await sendActivityEmail(env,payload):await sendEmail(env,payload);state='accepted';sent++}catch(e:any){state='retry';error=e.message}}
   await env.DB.prepare('UPDATE mail_outbox SET status=?,provider_id=?,error=? WHERE id=?').bind(state,providerId||null,error||null,item.id).run();if(n){n.emailStatus=state;n.emailError=error;n.providerId=providerId;changed=true;}
  }
  if(changed)await saveWorkspace(env.DB,owner,version+1,next);processed++;
 })}catch(e:any){failures.push(String(e.message).slice(0,300))}}
 return {ok:failures.length===0,processed,emailsAccepted:sent,failures,at:new Date().toISOString()};
}
