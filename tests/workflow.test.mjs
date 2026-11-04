import test from 'node:test';
import assert from 'node:assert/strict';
import {mutate, available} from '../lib/workflow.ts';

const now=Date.parse('2026-11-05T08:00:00.000Z');
const start=new Date(now+60*60*1000).toISOString();
const end=new Date(now+3*60*60*1000).toISOString();
const equipment={id:'TB001',name:'Máy ảnh',total:2,unusable:0,value:1000000};
const item={id:'TB001',qty:1};
function state(status='ready'){
 return {equipment:[{...equipment}],requests:[{id:'MT-001',name:'A',contact:'a@example.com',start,end,items:[{...item}],status,createdAt:now}],logs:[],notices:[],settings:{highValue:null}};
}
test('Cannot hand over equipment before pickup time',()=>{
 assert.throws(()=>mutate(state(),'staff','handover',{id:'MT-001',note:'Đạt',checked:true},now),/Chưa đến thời gian nhận/);
});
test('Cannot sign after return deadline',()=>{
 const s=state('handover');
 assert.throws(()=>mutate(s,'borrower','sign',{id:'MT-001',confirmed:true},now+4*60*60*1000),/ngoài thời gian nhận/);
});
test('Reservation prevents double booking and is released on cancellation',()=>{
 const s=state('ready');
 assert.equal(available(s,'TB001',start,end),1);
 const cancel=mutate(s,'borrower','cancel',{id:'MT-001',confirmed:true},now);
 assert.equal(available(cancel,'TB001',start,end),2);
});
test('Cannot restore more devices than are unusable',()=>{
 const s=state();s.equipment[0].unusable=1;
 assert.throws(()=>mutate(s,'staff','restoreEquipment',{id:'TB001',qty:2,note:'Đã kiểm tra'},now),/không hợp lệ/);
 const out=mutate(s,'staff','restoreEquipment',{id:'TB001',qty:1,note:'Đã sửa và thử máy'},now);
 assert.equal(out.equipment[0].unusable,0);
 assert.equal(out.logs.length,1);
});
test('Zero compensation requires an explicit waiver',()=>{
 const s=state('compensation');
 assert.throws(()=>mutate(s,'board','compensation',{id:'MT-001',amount:0,note:'Miễn giảm theo quyết định'},now),/xác nhận miễn/);
 const out=mutate(s,'board','compensation',{id:'MT-001',amount:0,note:'Miễn giảm theo quyết định',waiverConfirmed:true},now);
 assert.equal(out.requests[0].status,'closed');
});
test('Debt plan does not close unpaid compensation',()=>{
 const s=state('payment');s.requests[0].amount=100000;s.requests[0].paid=20000;s.requests[0].compensationAt=now-8*86400000;
 const out=mutate(s,'board','debtPlan',{id:'MT-001',note:'Trả góp sau 7 ngày',confirmed:true},now);
 assert.equal(out.requests[0].status,'debt_plan');
 assert.equal(out.requests[0].remainingDebt,80000);
});
test('Creation preserves idempotency token',()=>{
 const s=state();s.requests=[];
 const out=mutate(s,'borrower','create',{submissionId:'11111111-1111-4111-8111-111111111111',name:'A',contact:'a@example.com',purpose:'Họp CLB',start,end,items:[{...item}]},now);
 assert.equal(out.requests[0].submissionId,'11111111-1111-4111-8111-111111111111');
});
