/** A personal log is scoped to the authenticated person, never just their role. */
export function personalLogs(logs:any[],account:string|null,owner:string|null){
 return logs.filter(log=>account?log.actorEmail===account:!!owner&&log.actorId===owner);
}
export function attributeNewLogs(previous:any[],next:any[],account:string|null,owner:string){
 const existing=new Set(previous.map(log=>log.id));
 for(const log of next){
  if(existing.has(log.id)||log.role==='system')continue;
  if(account)log.actorEmail=account;
  else log.actorId=owner;
 }
}
