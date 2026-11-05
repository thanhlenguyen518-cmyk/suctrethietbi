import test from 'node:test';
import assert from 'node:assert/strict';
import {mutate, available} from '../lib/workflow.ts';
import {borrowedQuantity,reservedQuantity,visibleNotices} from '../lib/visibility.ts';

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

test('Global borrowed count covers requests from every account',()=>{
 const a={status:'borrowed',items:[{id:'A',qty:2}],accountEmail:'a@example.com'};
 const b={status:'borrowed',items:[{id:'B',qty:3}],accountEmail:'b@example.com'};
 assert.equal(borrowedQuantity([a,b,{status:'closed',items:[{id:'C',qty:9}]}]),5);
});
test('Borrowers only see notices addressed to them for their own requests',()=>{
 const notices=[{requestId:'A',to:'a@example.com'},{requestId:'A',to:'b@example.com'},{requestId:'B',to:'a@example.com'},{requestId:'A',to:'staff'}];
 const out=visibleNotices(notices,'borrower','a@example.com',new Set(['A']));
 assert.equal(out.length,1);assert.equal(out[0].to,'a@example.com');
});
test('Board members cannot read unrelated staff or borrower notifications',()=>{
 const notices=[{requestId:'A',to:'board'},{requestId:'B',to:'staff'},{requestId:'B',to:'a@example.com'},{requestId:'C',to:'Ban chủ nhiệm'}];
 assert.equal(visibleNotices(notices,'board','board@example.com').length,2);
});
test('Outstanding repayment can be reported without closing debt early',()=>{
 const s=state('debt_plan');s.requests[0].amount=100000;s.requests[0].paid=20000;
 const out=mutate(s,'borrower','reportPayment',{id:'MT-001',note:'Chuyển khoản đợt hai'},now);
 assert.equal(out.requests[0].status,'payment_review');
});

test('Reserved equipment is separate from actively borrowed equipment',()=>{
 const requests=[
  {status:'ready',items:[{id:'TB001',qty:2}]},
  {status:'handover',items:[{id:'TB002',qty:1}]},
  {status:'borrowed',items:[{id:'TB003',qty:4}]},
  {status:'closed',items:[{id:'TB004',qty:6}]}
 ];
 assert.equal(reservedQuantity(requests),3);
 assert.equal(borrowedQuantity(requests),4);
});
test('Distinct borrowers can create requests without reusing the same submission identity',()=>{
 const base=state();base.requests=[];
 const first=mutate(base,'borrower','create',{name:'Người A',contact:'a@example.com',purpose:'Sinh hoạt CLB',start,end,items:[{id:'TB001',qty:1}],submissionId:'11111111-1111-4111-8111-111111111111'},now);
 const second=mutate(first,'borrower','create',{name:'Người B',contact:'b@example.com',purpose:'Sinh hoạt CLB',start,end,items:[{id:'TB001',qty:1}],submissionId:'22222222-2222-4222-8222-222222222222'},now);
 assert.equal(second.requests.length,2);
 assert.notEqual(second.requests[0].submissionId,second.requests[1].submissionId);
});
