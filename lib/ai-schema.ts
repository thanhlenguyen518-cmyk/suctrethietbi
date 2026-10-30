export const PROMPT_VERSION='suctre-2026-10-v2';
export const CHECK_THRESHOLD=.95;
const string={type:'string'};
const object=(properties:any)=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
export const schemas:any={
 check:object({summary:string,issues:{type:'array',items:string},verdict:{type:'string',enum:['valid','needs_information']},confidence:{type:'number'}}),
 reminder:object({message:string}),
 incident:object({requestId:string,borrowerName:string,recordedAt:string,devices:{type:'array',items:object({equipmentId:string,qty:{type:'integer'},conditionDescription:string})},observations:string,unknowns:{type:'array',items:string}})
};
const fail=(s:string):never=>{throw new Error(s)};
function str(v:any,max=3000){if(typeof v!=='string'||!v.trim()||v.length>max)fail('AI trả trường văn bản thiếu hoặc quá dài.');return v.trim()}
function exactKeys(o:any,keys:string[]){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!(k in o)))fail('AI trả cấu trúc không đúng biểu mẫu.');}
export function validateAI(kind:string,o:any,input:any){
 if(kind==='check'){exactKeys(o,['summary','issues','verdict','confidence']);str(o.summary);if(!Array.isArray(o.issues)||o.issues.length>20||o.issues.some((x:any)=>typeof x!=='string'||x.length>1000)||!['valid','needs_information'].includes(o.verdict)||!Number.isFinite(o.confidence)||o.confidence<0||o.confidence>1)fail('Kết quả kiểm tra không hợp lệ.');if(o.verdict==='valid'&&o.issues.length)fail('Kết quả AI mâu thuẫn: vừa hợp lệ vừa có lỗi.');return o;}
 if(kind==='reminder'){exactKeys(o,['message']);str(o.message,3000);return o;}
 exactKeys(o,['requestId','borrowerName','recordedAt','devices','observations','unknowns']);
 if(o.requestId!==input.id||o.borrowerName!==input.name||o.recordedAt!==input.recordedAt)fail('Mã hồ sơ, người mượn hoặc thời điểm biên bản không khớp.');
 str(o.observations,6000);if(!Array.isArray(o.unknowns)||o.unknowns.length>15||o.unknowns.some((x:any)=>typeof x!=='string'||x.length>1000))fail('Mục thông tin chưa xác minh không hợp lệ.');
 if(!Array.isArray(o.devices)||o.devices.length!==input.damage.length)fail('Danh sách thiết bị trong biên bản không khớp.');const ids=new Set();
 for(const d of o.devices){exactKeys(d,['equipmentId','qty','conditionDescription']);const original=input.damage.find((x:any)=>x.id===d.equipmentId);if(!original||original.qty!==d.qty||ids.has(d.equipmentId))fail('AI thay đổi mã hoặc số lượng hư hỏng/mất.');str(d.conditionDescription,1500);ids.add(d.equipmentId)}
 return o;
}
export function reportText(report:any){return ['BIÊN BẢN HƯ HỎNG / MẤT THIẾT BỊ','Hồ sơ: '+report.requestId,'Người mượn: '+report.borrowerName,'Thời điểm ghi nhận: '+report.recordedAt,...report.devices.map((d:any)=>`${d.equipmentId} × ${d.qty}: ${d.conditionDescription}`),'Ghi nhận: '+report.observations,'Chưa xác minh: '+(report.unknowns.join('; ')||'Không ghi nhận thêm')].join('\n')}
export function reminderText(input:any,message:string){return [`NHẮC TRẢ THIẾT BỊ — ${input.id}`,`Thiết bị: ${input.items.map((i:any)=>i.id+' — '+i.name+' × '+i.qty).join('; ')}`,`Hạn trả đã ghi nhận: ${new Date(input.end).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}`,message,'Vui lòng liên hệ phụ trách thiết bị để sắp xếp trả.'].join('\n')}
