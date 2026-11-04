/**
 * Serialize changes to a single workspace across concurrent requests.
 * Briefly wait for another request to finish instead of rejecting immediately.
 */
export async function withLock<T>(db:any,id:string,work:()=>Promise<T>):Promise<T>{
 const token=crypto.randomUUID();
 let acquired=false;
 for(let attempt=0;attempt<25;attempt++){
  const now=Date.now();
  const row=await db.prepare('INSERT INTO job_locks(id,token,until) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token, until=excluded.until WHERE job_locks.until < ? RETURNING token').bind(id,token,now+300000,now).first();
  if(row?.token===token){acquired=true;break}
  await new Promise(resolve=>setTimeout(resolve,200+attempt*20));
 }
 if(!acquired)throw new Error('Hệ thống đang xử lý nhiều yêu cầu. Vui lòng thử lại sau.');
 try{return await work()}
 finally{await db.prepare('DELETE FROM job_locks WHERE id=? AND token=?').bind(id,token).run()}
}
