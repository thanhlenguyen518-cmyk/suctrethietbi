import {env} from 'cloudflare:workers';
import {json} from '../../../lib/storage';
import {runMaintenance} from '../../../lib/jobs';
// This endpoint relies on the platform's owner-only Site access boundary.
// SCHEDULER_ENABLED is set only after that access policy has been verified.
export async function POST(req:Request){try{if((env as any).SCHEDULER_ENABLED!=='true')return json({error:'Bộ chạy theo lịch chưa được bật.'},503);const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Nguồn yêu cầu không hợp lệ.'},403);if(req.headers.get('x-suctre-job')!=='maintenance')return json({error:'Thiếu loại tác vụ.'},400);return json(await runMaintenance(env))}catch(e:any){return json({error:e.message},500)}}
export async function GET(){try{const rows=await (env as any).DB.prepare('SELECT data FROM workspaces LIMIT 20').all();return json({enabled:(env as any).SCHEDULER_ENABLED==='true',workspaces:rows.results.length,runs:rows.results.map((r:any)=>JSON.parse(r.data).settings.lastJob||null)})}catch(e:any){return json({error:e.message},503)}}
