export type Role='borrower'|'staff'|'board';
export type State={equipment:any[],requests:any[],logs:any[],notices:any[],settings:{highValue:number|null,autoCheck?:boolean,autoReminders?:boolean,emailEnabled?:boolean,calibration?:any[],lastJob?:any},version?:number};
export const labels:Record<string,string>={cancelled:'Đã hủy',review:'Chờ kiểm tra',supplement:'Cần bổ sung',board:'Chờ Ban chủ nhiệm',ready:'Đã giữ thiết bị',handover:'Chờ ký nhận',borrowed:'Đang mượn',incident:'Chờ duyệt biên bản',compensation:'Chờ duyệt bồi thường',payment:'Chờ bồi thường',payment_review:'Chờ đối chiếu bồi thường',debt_plan:'Chờ xử lý khoản còn thiếu',closed:'Hoàn tất',rejected:'Từ chối',unavailable:'Không đủ thiết bị',expired:'Hết hạn bổ sung',overdue:'Quá hạn duyệt'};
/** An unapproved request becomes read-only as soon as its planned pickup begins. */
export function isApprovalOverdue(r:any,now=Date.now()):boolean{
 return !!r&&['review','supplement','board'].includes(r.status)&&Number.isFinite(Date.parse(r.start))&&Date.parse(r.start)<=now;
}
export function displayStatus(r:any,now=Date.now()):string{
 return isApprovalOverdue(r,now)?'overdue':r.status;
}
export const emptyState=():State=>({equipment:[],requests:[],logs:[],notices:[],settings:{highValue:null}});
const fail=(s:string):never=>{throw new Error(s)};
const text=(x:any,max=3000)=>typeof x==='string'?x.trim().slice(0,max):'';
export function available(s:State,eid:string,start:string,end:string,exclude=''){
 const e=s.equipment.find(e=>e.id===eid);if(!e)return 0;
 const reserved=s.requests.filter(r=>r.id!==exclude&&['ready','handover','borrowed'].includes(r.status)&&(r.start<end&&r.end>start || r.status==='borrowed'&&r.end<new Date().toISOString())).reduce((n,r)=>n+r.items.filter((i:any)=>i.id===eid).reduce((a:number,i:any)=>a+i.qty,0),0);
 return Math.max(0,e.total-e.unusable-reserved);
}
export function validate(s:State,p:any,now=Date.now()){
 if(!text(p.name)||!text(p.contact)||!text(p.purpose)||!text(p.start)||!text(p.end)) fail('Vui lòng điền đủ tên, liên hệ, mục đích và thời gian.');
 if(!Number.isFinite(Date.parse(p.start))||!Number.isFinite(Date.parse(p.end))||Date.parse(p.end)<=Date.parse(p.start))fail('Hạn trả phải sau thời gian nhận.');
 if(Date.parse(p.start)<now-60000)fail('Thời gian nhận phải từ hiện tại trở đi.');
 if(!text(p.phone))fail('Vui lòng nhập số điện thoại liên hệ.');if(!/^\+?[0-9 .()-]{9,20}$/.test(String(p.phone).trim()))fail('Số điện thoại không hợp lệ.');
 if(!Array.isArray(p.items)||p.items.length===0||p.items.length>30)fail('Chọn ít nhất một thiết bị.');
 const ids=new Set();for(const i of p.items){if(ids.has(i.id))fail('Mỗi mã thiết bị chỉ được xuất hiện một lần.');ids.add(i.id);if(!s.equipment.some(e=>e.id===i.id)||!Number.isSafeInteger(i.qty)||i.qty<=0)fail('Mã thiết bị hoặc số lượng không hợp lệ.');}
}
function log(s:State,role:Role,id:string,action:string,now:number){s.logs.unshift({id:crypto.randomUUID(),requestId:id,role,action,at:new Date(now).toISOString()})}
function notice(s:State,r:any,body:string,now:number){s.notices.unshift({id:crypto.randomUUID(),requestId:r.id,to:r.contact,body,at:new Date(now).toISOString(),channel:'in-app'})}
function reserve(s:State,r:any,now:number){if(r.items.some((i:any)=>available(s,i.id,r.start,r.end,r.id)<i.qty)){r.status='unavailable';notice(s,r,'Không đủ thiết bị theo lịch mượn. Vui lòng tạo đơn với lịch hoặc số lượng khác.',now)}else{r.status='ready';notice(s,r,'Đã giữ thiết bị. Lịch nhận: '+new Date(r.start).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),now)}}
export function route(s:State,r:any,now:number){if(r.items.some((i:any)=>available(s,i.id,r.start,r.end,r.id)<i.qty)){r.status='unavailable';notice(s,r,'Không đủ thiết bị theo lịch mượn.',now);return}
 const value=r.items.reduce((n:number,i:any)=>n+s.equipment.find(e=>e.id===i.id).value*i.qty,0);
 r.totalValue=value;
 if(s.settings.highValue===null || Date.parse(r.end)-Date.parse(r.start)>=86400000 || value>=s.settings.highValue){r.status='board';r.boardAt=now;r.routingReason=s.settings.highValue===null?'Chờ Ban chủ nhiệm phê duyệt do CLB chưa quy định mức giá trị cần duyệt.':'Giá trị cao hoặc thời gian mượn trên một ngày.'}else reserve(s,r,now);
}
export function mutate(input:State,role:Role,action:string,p:any,now=Date.now()):State{
 const s=structuredClone(input);const r=s.requests.find(r=>r.id===p.id);
 if(isApprovalOverdue(r,now))fail('Đơn đã quá thời gian nhận nhưng chưa được duyệt. Chỉ được xem, không thể xử lý.');
 const need=(allowed:Role[],statuses?:string[])=>{if(!allowed.includes(role))fail('Vai trò này không được thực hiện hành động.');if(statuses&&(!r||!statuses.includes(r.status)))fail('Trạng thái đã thay đổi hoặc không phù hợp. Hãy tải lại dữ liệu.');};
 if(action==='demo'){need(['staff']);if(s.equipment.length||s.requests.length)fail('Chỉ nạp dữ liệu mẫu khi danh mục và hồ sơ trống.');s.equipment=[['TB001','Loa kéo','Âm thanh',4,3500000,'speaker'],['TB002','Micro không dây','Âm thanh',8,800000,'mic'],['TB003','Máy chiếu','Trình chiếu',2,12000000,'projector'],['TB004','Chân máy ảnh','Phụ kiện',5,450000,'tripod'],['TB005','Máy ảnh','Ghi hình',2,15000000,'camera'],['TB006','Dây nối điện','Phụ kiện',10,150000,'cable']].map(([id,name,category,total,value,icon])=>({id,name,category,total,value,icon,unusable:0}));log(s,role,'','Nạp danh mục giả lập để demo; không phải dữ liệu khảo sát.',now);return s;}
 if(action==='equipment'){need(['staff','board']);const id=text(p.code,40);if(!/^[A-Za-z0-9_-]{2,40}$/.test(id)||!text(p.name)||!Number.isSafeInteger(p.total)||p.total<1||!Number.isFinite(p.value)||p.value<0)fail('Kiểm tra mã, tên, số lượng nguyên dương và giá trị không âm.');if(s.equipment.some(e=>e.id===id))fail('Mã thiết bị đã tồn tại.');s.equipment.push({id,name:text(p.name,120),category:text(p.category,60)||'Khác',total:p.total,value:p.value,unusable:0,icon:'box'});log(s,role,id,'Thêm thiết bị',now);return s;}
 if(action==='updateEquipment'){
  need(['staff','board']);
  const e=s.equipment.find(e=>e.id===p.id);
  if(!e)fail('Không tìm thấy thiết bị cần chỉnh sửa.');
  const name=text(p.name,120),category=text(p.category,60)||'Khác';
  if(!name||!Number.isSafeInteger(p.total)||p.total<1||!Number.isSafeInteger(p.value)||p.value<0)fail('Tên, số lượng và giá trị thiết bị không hợp lệ.');
  if(p.total<e.unusable)fail('Tổng số lượng không được nhỏ hơn số thiết bị hỏng hoặc mất.');
  // Existing reservations and handovers must remain fulfilled after inventory edits.
  const events:{time:number,delta:number}[]=[];
  for(const req of s.requests.filter((q:any)=>['ready','handover','borrowed'].includes(q.status))){
   const qty=(req.items||[]).filter((i:any)=>i.id===e.id).reduce((a:number,i:any)=>a+i.qty,0);
   if(!qty)continue;
   const start=Date.parse(req.start);
   const end=req.status==='borrowed'?Number.POSITIVE_INFINITY:Date.parse(req.end);
   if(!Number.isFinite(start)||(!Number.isFinite(end)&&end!==Infinity))continue;
   events.push({time:start,delta:qty},{time:end,delta:-qty});
  }
  events.sort((a,b)=>a.time-b.time||a.delta-b.delta);
  let active=0,peak=0;
  for(const event of events){active+=event.delta;peak=Math.max(peak,active)}
  if(p.total<peak+e.unusable)fail('Không thể giảm số lượng: đã có thiết bị đang mượn hoặc giữ chỗ. Cần ít nhất '+(peak+e.unusable)+' chiếc.');
  e.name=name;e.category=category;e.total=p.total;e.value=p.value;
  log(s,role,e.id,'Cập nhật thông tin thiết bị',now);
  return s;
 }
 if(action==='restoreEquipment'){
  need(['staff']);
  const e=s.equipment.find(e=>e.id===p.id);
  if(!e)fail('Không tìm thấy loại thiết bị.');
  if(!Number.isSafeInteger(p.qty)||p.qty<1||p.qty>e.unusable)fail('Số lượng khôi phục không hợp lệ.');
  if(!text(p.note))fail('Cần ghi căn cứ xác nhận thiết bị đã sửa chữa hoặc được tìm thấy.');
  e.unusable-=p.qty;
  log(s,role,e.id,'Khôi phục '+p.qty+' thiết bị đạt yêu cầu: '+text(p.note,300),now);
  return s;
 }
 if(action==='settings'){need(['board']);if(p.highValue!==null&&(!Number.isFinite(p.highValue)||p.highValue<=0))fail('Ngưỡng giá trị phải lớn hơn 0.');s.settings.highValue=p.highValue;log(s,role,'','Cập nhật ngưỡng giá trị cao: '+(p.highValue??'chưa xác định'),now);return s;}
 if(action==='create'||action==='resubmit'){
  need(['borrower'],action==='resubmit'?['supplement']:undefined);validate(s,p,now);
  if(action==='resubmit'&&now>r.supplementUntil)fail('Đã quá 24 giờ bổ sung. Vui lòng tạo đơn mới.');
  const data={name:text(p.name,120),contact:text(p.contact,180),phone:text(p.phone,20),purpose:text(p.purpose),start:new Date(p.start).toISOString(),end:new Date(p.end).toISOString(),items:p.items.map((i:any)=>({id:i.id,qty:i.qty})),status:'review',updatedAt:now};
  if(action==='create'){const n={...data,submissionId:typeof p.submissionId==='string'&&/^[a-f0-9-]{36}$/i.test(p.submissionId)?p.submissionId:crypto.randomUUID(),id:'MT-'+crypto.randomUUID().slice(0,8).toUpperCase(),createdAt:now};s.requests.unshift(n);log(s,role,n.id,'Gửi đơn mượn trực tuyến',now)}else{Object.assign(r,data);delete r.ai;log(s,role,r.id,'Bổ sung và gửi lại đơn',now)}return s;
 }
 if(action==='cancel'){
  need(['borrower']);if(!r)fail('Không tìm thấy đơn mượn.');
  if(r.signedAt||!['review','supplement','board','ready','handover'].includes(r.status)){
   notice(s,r,'Không thể hủy: '+(r.signedAt?'đã ký nhận thiết bị. Vui lòng thực hiện quy trình trả thiết bị.':'đơn không còn ở trạng thái được hủy.'),now);
   log(s,role,r.id,'Từ chối yêu cầu hủy; giữ nguyên quy trình đang xử lý',now);return s;
  }
  if(p.confirmed!==true)fail('Cần xác nhận hủy đơn.');
  r.status='cancelled';r.cancelledAt=now;r.cancelReason='Người mượn yêu cầu hủy trước khi ký nhận';
  notice(s,r,'Đơn đã hủy theo yêu cầu. Lịch giữ thiết bị đã được giải phóng.',now);
  for(const to of ['staff','board'])s.notices.unshift({id:crypto.randomUUID(),requestId:r.id,to,body:'Người mượn '+r.name+' đã hủy đơn '+r.id+'. Lịch giữ thiết bị đã được giải phóng.',at:new Date(now).toISOString(),channel:'in-app'});
  log(s,role,r.id,'Người mượn hủy đơn; giải phóng lịch giữ thiết bị',now);return s;
 }
 if(action==='noSuitableEquipment'){
  need(['staff'],['ready']);if(p.checked!==true||p.confirmed!==true)fail('Cần xác nhận đã kiểm tra và không có thiết bị đạt để giao.');
  r.status='cancelled';r.cancelledAt=now;r.cancelReason='Không có thiết bị đạt yêu cầu trước khi giao';
  notice(s,r,'Đơn bị hủy vì không có thiết bị đạt yêu cầu để giao. Lịch giữ thiết bị đã được giải phóng.',now);
  log(s,role,r.id,'Hủy đơn do kiểm tra trước giao không có thiết bị đạt; giải phóng lịch giữ',now);return s;
 }
 if(action==='review'){need(['staff'],['review']);if(Date.parse(r.end)<=now)fail('Lịch mượn đã kết thúc. Người mượn cần tạo đơn với thời gian mới.');if(p.valid===false){if(!text(p.note))fail('Nhập thông tin cần bổ sung.');r.status='supplement';r.note=text(p.note);r.supplementUntil=now+86400000;notice(s,r,r.note+' — vui lòng bổ sung trong 24 giờ.',now)}else{r.reviewNote='Đã kiểm tra và xác nhận thông tin hợp lệ.';route(s,r,now)}}
 else if(action==='approve'){need(['board'],['board']);if(Date.parse(r.end)<=now)fail('Lịch mượn đã kết thúc. Không thể duyệt đơn quá hạn.');if(typeof p.approved!=='boolean')fail('Chọn đồng ý hoặc từ chối đơn.');if(p.approved===false&&!text(p.note))fail('Nhập lý do từ chối đơn.');r.boardNote=text(p.note)||'Ban chủ nhiệm đồng ý cho mượn sau khi xem xét hồ sơ.';if(p.approved===true)reserve(s,r,now);else{r.status='rejected';notice(s,r,'Đơn bị từ chối: '+r.boardNote,now)}}
 else if(action==='handover'){need(['staff'],['ready']);if(!text(p.note)||p.checked!==true)fail('Xác nhận kiểm tra thiết bị và ghi tình trạng, phụ kiện trước giao.');r.handoverNote=text(p.note);r.status='handover'}
 else if(action==='sign'){need(['borrower'],['handover']);if(p.confirmed!==true)fail('Cần xác nhận đã nhận đúng thiết bị và phụ kiện.');r.signature=r.name;r.signedAt=now;r.status='borrowed'}
 else if(action==='requestEarlyReturn'){
  need(['borrower'],['borrowed']);
  if(!r.signedAt)fail('Thiết bị chưa được ký nhận.');
  
  if(r.earlyReturnRequestedAt)fail('Bạn đã gửi yêu cầu trả trước hạn. Vui lòng chờ phụ trách tiếp nhận.');
  if(p.confirmed!==true)fail('Cần xác nhận yêu cầu trả thiết bị trước hạn.');
  r.earlyReturnRequestedAt=now;
  r.earlyReturnNote=text(p.note,500);
  s.notices.unshift({id:crypto.randomUUID(),requestId:r.id,to:'staff',body:'Người mượn '+r.name+' đề nghị trả thiết bị trước hạn cho đơn '+r.id+'. Hạn trả ban đầu: '+new Date(r.end).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})+'. Vui lòng kiểm tra thiết bị và ghi nhận trả thực tế.',at:new Date(now).toISOString(),channel:'in-app'});
  notice(s,r,'Đã gửi đề nghị trả trước hạn. Phụ trách thiết bị sẽ kiểm tra và xác nhận khi nhận lại thiết bị.',now);
  log(s,role,r.id,'Đề nghị trả thiết bị trước hạn',now);
 }
 else if(action==='return'){need(['staff'],['borrowed']);if(p.checked!==true)fail('Cần đối chiếu và kiểm tra từng thiết bị.');if(!text(p.note))fail('Nhập kết quả kiểm tra khi trả.');r.returnNote=text(p.note);r.returnedAt=now;r.returnedEarly=now<Date.parse(r.end);
  if(!Array.isArray(p.damage))fail('Danh sách thiết bị hỏng/mất không hợp lệ.');
  for(const d of p.damage){const item=r.items.find((i:any)=>i.id===d.id);if(!item||!Number.isSafeInteger(d.qty)||d.qty<1||d.qty>item.qty)fail('Số lượng hỏng/mất vượt số đã mượn.');}if(new Set(p.damage.map((d:any)=>d.id)).size!==p.damage.length)fail('Mã hỏng/mất trùng.');
  r.damage=p.damage.map((d:any)=>({id:d.id,qty:d.qty}));for(const d of r.damage)s.equipment.find(e=>e.id===d.id).unusable+=d.qty;
  r.status=r.damage.length?'incident':'closed';if(r.status==='closed'){r.closedAt=now;notice(s,r,'Đã hoàn tất lượt mượn, không ghi nhận hư hỏng hoặc mất.',now)}}
 else if(action==='incident'){need(['staff'],['incident']);if(!text(p.note)||p.confirmed!==true)fail('Cần kiểm tra, sửa và ký xác nhận biên bản.');if(!text(p.signer,120))fail('Nhập họ tên người ký xác nhận biên bản.');const mandatory=[r.id,r.name,...r.damage.map((d:any)=>d.id+' × '+d.qty)];if(mandatory.some((v:string)=>!p.note.includes(v)))fail('Biên bản phải giữ đúng mã hồ sơ, người mượn và mã × số lượng thiết bị hỏng/mất.');r.report=text(p.note,10000);r.reportSigner=text(p.signer,120);r.reportSignedAt=now;r.status='compensation'}
 else if(action==='compensation'){need(['board'],['compensation']);if(!Number.isSafeInteger(p.amount)||p.amount<0||!text(p.note))fail('Nhập số tiền nguyên không âm và căn cứ quy định/miễn giảm.');if(p.amount===0&&!p.waiverConfirmed)fail('Phải xác nhận miễn bồi thường và ghi rõ căn cứ khi số tiền là 0.');r.amount=p.amount;r.paid=0;r.remainingDebt=p.amount;r.compensationBasis=text(p.note);r.compensationAt=now;r.status=p.amount?'payment':'closed';if(!p.amount)r.closedAt=now;notice(s,r,'Phương án bồi thường được duyệt: '+p.amount.toLocaleString('vi-VN')+' đồng. Căn cứ: '+r.compensationBasis,now)}
 else if(action==='reportPayment'){need(['borrower'],['payment','debt_plan']);if(!text(p.note))fail('Nhập thông tin hoặc mã tham chiếu bồi thường.');r.paymentEvidence=text(p.note);r.status='payment_review'}
 else if(action==='confirmPayment'){need(['staff'],['payment_review']);if(!Number.isSafeInteger(p.amount)||p.amount<0||p.amount>r.amount-r.paid||!text(p.note))fail('Nhập số tiền thực nhận không vượt khoản còn thiếu và căn cứ đối chiếu.');r.paid+=p.amount;r.paymentCheck=text(p.note);r.status=r.paid===r.amount?'closed':r.debtPlanConfirmedAt?'debt_plan':'payment';r.remainingDebt=r.amount-r.paid;if(r.status==='closed')r.closedAt=now;notice(s,r,'Đã xác nhận '+p.amount.toLocaleString('vi-VN')+' đồng; còn thiếu '+(r.amount-r.paid).toLocaleString('vi-VN')+' đồng.',now)}
 else if(action==='debtPlan'){need(['board'],['payment','debt_plan']);if(now-r.compensationAt<7*86400000)fail('Chưa đến mốc 7 ngày xử lý khoản chưa bồi thường.');if(!text(p.note))fail('Nhập phương án và kết quả thực hiện.');r.debtPlan=text(p.note);r.remainingDebt=r.amount-r.paid;r.status=p.confirmed&&r.remainingDebt===0?'closed':'debt_plan';if(p.confirmed){r.debtPlanConfirmedAt=now;if(r.status==='closed')r.closedAt=now;notice(s,r,'Đã ghi nhận phương án xử lý; khoản còn phải bồi thường: '+r.remainingDebt+' đồng.',now)}}
 else if(action==='tick'){need(['staff']);for(const q of s.requests){if(q.status==='supplement'&&now>q.supplementUntil){q.status='expired';notice(s,q,'Đơn hết hạn do quá 24 giờ chưa bổ sung.',now)}if(q.status==='board'&&now-q.boardAt>=4*3600000&&(!q.lastApprovalReminder||now-q.lastApprovalReminder>=4*3600000)){q.lastApprovalReminder=now;notice(s,q,'Đơn đang chờ Ban chủ nhiệm. Đã tạo nhắc duyệt sau 4 giờ.',now)}}}
 else fail('Hành động không được hỗ trợ.');
 log(s,role,r?.id||'',({review:'Kiểm tra đơn',approve:'Ghi nhận quyết định duyệt',handover:'Kiểm tra và bàn giao',sign:'Người mượn ký nhận',return:'Đối chiếu và tiếp nhận trả',incident:'Ký xác nhận biên bản',compensation:'Duyệt phương án bồi thường',reportPayment:'Báo đã bồi thường',confirmPayment:'Đối chiếu bồi thường',debtPlan:'Xử lý khoản còn thiếu',tick:'Kiểm tra các mốc thời gian'} as any)[action],now);return s;
}
