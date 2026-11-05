/** Build privacy-scoped email notices for meaningful club workflow events.
 * Delivery happens from the server-side outbox, never the browser.
 */
export const activityActions=new Set(['create','resubmit','review','approve','handover','sign','return','requestEarlyReturn','cancel','noSuitableEquipment','incident','compensation','reportPayment','confirmPayment','debtPlan','equipment','updateEquipment']);
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=160;
export function queueActivityNotices(next:any,previous:any,action:string,requestId:string,actorRole:string,roleEmails:Record<string,string[]>,now=Date.now()):number{
 if(!activityActions.has(action))return 0;
 const request=next.requests.find((r:any)=>r.id===requestId);
 const before=previous?.requests?.find((r:any)=>r.id===requestId);
 const equipment=['equipment','updateEquipment'].includes(action);
 if(!equipment&&!request)return 0;
 const key=equipment?requestId:request.id;
 const recipientRoles=new Set<string>();
 let borrower=false;
 if(action==='create'||action==='resubmit'){borrower=true;recipientRoles.add('staff');}
 else if(action==='review'){borrower=true;if(request.status==='board')recipientRoles.add('board');else if(request.status==='ready')recipientRoles.add('staff');}
 else if(action==='approve'){borrower=true;recipientRoles.add('staff');}
 else if(action==='handover'){borrower=true;}
 else if(action==='sign'||action==='requestEarlyReturn'){recipientRoles.add('staff');}
 else if(action==='return'){borrower=true;if(request.status==='incident')recipientRoles.add('board');}
 else if(action==='cancel'||action==='noSuitableEquipment'){borrower=true;recipientRoles.add('staff');recipientRoles.add('board');}
 else if(action==='incident'){borrower=true;recipientRoles.add('board');}
 else if(action==='compensation'){borrower=true;}
 else if(action==='reportPayment'){recipientRoles.add('staff');}
 else if(action==='confirmPayment'||action==='debtPlan'){borrower=true;}
 else if(equipment){recipientRoles.add('staff');recipientRoles.add('board');}
 const recipients=new Set<string>();
 if(borrower&&request?.contact&&validEmail(request.contact))recipients.add(request.contact.toLowerCase());
 for(const role of recipientRoles)for(const email of roleEmails[role]||[])if(validEmail(email))recipients.add(email.toLowerCase());
 const label=equipment?'Danh mục thiết bị':action==='requestEarlyReturn'?'Yêu cầu trả thiết bị':action==='return'?'Ghi nhận trả thiết bị':action==='create'?'Có đơn mượn mới':action==='resubmit'?'Đơn đã bổ sung':'Đơn mượn có cập nhật';
 const status=request?.status||'';
 const body=equipment?`Danh mục thiết bị Sức Trẻ vừa được cập nhật (mã: ${key}). Hãy đăng nhập website để kiểm tra.`:`${label}. Mã đơn: ${key}. Trạng thái hiện tại: ${status}. Hãy đăng nhập website Sức Trẻ để xem thông tin chi tiết.`;
 let count=0;
 for(const to of recipients){
  // Do not send an email if no meaningful transition occurred.
  if(!equipment&&action==='review'&&before?.status===status)continue;
  next.notices.unshift({id:crypto.randomUUID(),requestId:key,to,body,at:new Date(now).toISOString(),channel:'in-app',type:'activity',emailStatus:'queued',subject:'CLB Sức Trẻ — '+label+' ('+key+')'});
  count++;
 }
 return count;
}
