import test from 'node:test';
import assert from 'node:assert/strict';
import {mutate, available, displayStatus, isApprovalOverdue} from '../lib/workflow.ts';
import {borrowedQuantity,reservedQuantity,visibleNotices} from '../lib/visibility.ts';

const now=Date.parse('2026-11-05T08:00:00.000Z');
const start=new Date(now+60*60*1000).toISOString();
const end=new Date(now+3*60*60*1000).toISOString();
const equipment={id:'TB001',name:'Máy ảnh',total:2,unusable:0,value:1000000};
const item={id:'TB001',qty:1};
function state(status='ready'){
 return {equipment:[{...equipment}],requests:[{id:'MT-001',name:'A',contact:'a@example.com',start,end,items:[{...item}],status,createdAt:now}],logs:[],notices:[],settings:{highValue:null}};
}
test('Staff can hand over equipment before scheduled pickup time',()=>{
 assert.equal(mutate(state(),'staff','handover',{id:'MT-001',note:'Đạt',checked:true},now).requests[0].status,'handover');
});
test('Borrower can sign when equipment is handed over even after planned deadline',()=>{
 const s=state('handover');
 assert.equal(mutate(s,'borrower','sign',{id:'MT-001',confirmed:true},now+4*60*60*1000).requests[0].status,'borrowed');
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
 const out=mutate(s,'borrower','create',{submissionId:'11111111-1111-4111-8111-111111111111',name:'A',contact:'a@example.com',phone:'0901234567',purpose:'Họp CLB',start,end,items:[{...item}]},now);
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
 const first=mutate(base,'borrower','create',{name:'Người A',contact:'a@example.com',phone:'0901234567',purpose:'Sinh hoạt CLB',start,end,items:[{id:'TB001',qty:1}],submissionId:'11111111-1111-4111-8111-111111111111'},now);
 const second=mutate(first,'borrower','create',{name:'Người B',contact:'b@example.com',phone:'0901234567',purpose:'Sinh hoạt CLB',start,end,items:[{id:'TB001',qty:1}],submissionId:'22222222-2222-4222-8222-222222222222'},now);
 assert.equal(second.requests.length,2);
 assert.notEqual(second.requests[0].submissionId,second.requests[1].submissionId);
});

test('Staff can update equipment name, category, quantity and reference value',()=>{
 const source=state();
 const next=mutate(source,'staff','updateEquipment',{id:'TB001',name:'Máy ảnh sự kiện',category:'Ghi hình',total:4,value:2500000},now);
 assert.equal(next.equipment[0].name,'Máy ảnh sự kiện');
 assert.equal(next.equipment[0].category,'Ghi hình');
 assert.equal(next.equipment[0].total,4);
 assert.equal(next.equipment[0].value,2500000);
 assert.equal(source.equipment[0].name,'Máy ảnh');
 assert.equal(next.logs[0].action,'Cập nhật thông tin thiết bị');
});
test('Borrower cannot modify the inventory',()=>{
 assert.throws(()=>mutate(state(),'borrower','updateEquipment',{id:'TB001',name:'Không được',category:'Khác',total:5,value:0},now),/Vai trò/);
});
test('Cannot reduce stock below active reservations and damaged devices',()=>{
 const source=state('ready');
 source.equipment[0].unusable=1;
 assert.throws(()=>mutate(source,'staff','updateEquipment',{id:'TB001',name:'Máy ảnh',category:'Ghi hình',total:1,value:1},now),/Không thể giảm số lượng/);
 const next=mutate(source,'staff','updateEquipment',{id:'TB001',name:'Máy ảnh',category:'Ghi hình',total:2,value:1},now);
 assert.equal(next.equipment[0].total,2);
});

test('Ban chủ nhiệm can edit equipment but cannot lower stock below reserved quantities',()=>{
 const source=state('ready');
 const updated=mutate(source,'board','updateEquipment',{id:'TB001',name:'Máy ảnh CLB',category:'Ghi hình',total:3,value:2000000},now);
 assert.equal(updated.equipment[0].name,'Máy ảnh CLB');
 assert.equal(updated.equipment[0].total,3);
 assert.equal(updated.logs[0].role,'board');
 assert.throws(()=>mutate(source,'board','updateEquipment',{id:'TB001',name:'Máy ảnh CLB',category:'Ghi hình',total:0,value:2000000},now),/không hợp lệ/);
});

test('Unapproved requests are marked overdue when pickup time passes',()=>{
 for(const status of ['review','supplement','board']){
  const s=state(status);
  assert.equal(displayStatus(s.requests[0],Date.parse(start)-1),status);
  assert.equal(displayStatus(s.requests[0],Date.parse(start)),'overdue');
  assert.equal(isApprovalOverdue(s.requests[0],Date.parse(start)+1000),true);
 }
 assert.equal(displayStatus(state('borrowed').requests[0],Date.parse(end)+1000),'borrowed');
 assert.equal(displayStatus(state('closed').requests[0],Date.parse(end)+1000),'closed');
});
test('Staff and board cannot process an unapproved overdue request',()=>{
 const time=Date.parse(start)+1000;
 const review=state('review'),board=state('board'),supplement=state('supplement');
 assert.throws(()=>mutate(review,'staff','review',{id:'MT-001',valid:true},time),/Chỉ được xem/);
 assert.throws(()=>mutate(review,'staff','review',{id:'MT-001',valid:false,note:'Bổ sung'},time),/Chỉ được xem/);
 assert.throws(()=>mutate(board,'board','approve',{id:'MT-001',approved:true},time),/Chỉ được xem/);
 assert.throws(()=>mutate(board,'board','approve',{id:'MT-001',approved:false,note:'Từ chối'},time),/Chỉ được xem/);
 assert.throws(()=>mutate(supplement,'borrower','cancel',{id:'MT-001',confirmed:true},time),/Chỉ được xem/);
});

test('Borrower may request return before the scheduled deadline without releasing equipment',()=>{
 const t=now+90*60*1000;const v=state('borrowed');v.requests[0].signedAt=now+60*60*1000;
 const next=mutate(v,'borrower','requestEarlyReturn',{id:'MT-001',confirmed:true,note:'Trả sau khi kết thúc chương trình'},t);
 assert.equal(next.requests[0].status,'borrowed');
 assert.equal(next.requests[0].earlyReturnRequestedAt,t);
 assert.equal(next.requests[0].returnedAt,undefined);
 assert.equal(borrowedQuantity(next.requests),1);
 assert.equal(next.notices.some(n=>n.to==='staff'&&n.requestId==='MT-001'),true);
 assert.throws(()=>mutate(next,'borrower','requestEarlyReturn',{id:'MT-001',confirmed:true},t+1000),/đã gửi yêu cầu/);
 const returned=mutate(next,'staff','return',{id:'MT-001',note:'Đã kiểm tra máy và phụ kiện: nguyên vẹn',checked:true,damage:[]},t+2000);
 assert.equal(returned.requests[0].status,'closed');
 assert.equal(returned.requests[0].returnedEarly,true);
 assert.equal(borrowedQuantity(returned.requests),0);
});
test('Early return is not self-confirmable and rejects invalid states',()=>{
 const t=now+90*60*1000;const v=state('borrowed');v.requests[0].signedAt=now+60*60*1000;
 assert.throws(()=>mutate(v,'borrower','requestEarlyReturn',{id:'MT-001',confirmed:false},t),/xác nhận/);
 assert.throws(()=>mutate(v,'board','requestEarlyReturn',{id:'MT-001',confirmed:true},t),/Vai trò/);
 assert.equal(mutate(v,'borrower','requestEarlyReturn',{id:'MT-001',confirmed:true},Date.parse(end)).requests[0].status,'borrowed');
 assert.throws(()=>mutate(state('ready'),'borrower','requestEarlyReturn',{id:'MT-001',confirmed:true},t),/Trạng thái/);
});
