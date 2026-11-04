/**
 * Access-control helpers for the shared club workspace.
 * A notice addressed to an email or role must never be shown to another account.
 */
export function borrowedQuantity(requests:any[]):number{
 return requests.filter(r=>r.status==='borrowed'&&!r.returnedAt)
  .reduce((total,r)=>total+r.items.reduce((sum:number,i:any)=>sum+i.qty,0),0);
}
export function visibleNotices(notices:any[],role:string|null,email:string|null,allowedRequestIds?:Set<string>){
 return notices.filter(n=>{
  if(role==='borrower')return !!allowedRequestIds?.has(n.requestId)&&(n.to===email||n.to==='borrower');
  return n.to===email||n.to===role||(role==='board'&&n.to==='Ban chủ nhiệm')||(role==='staff'&&n.to==='Phụ trách thiết bị');
 });
}
