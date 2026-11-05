import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,mutate,available} from '../lib/workflow.ts';
import {queueActivityNotices} from '../lib/activity-email.ts';

const t=Date.parse('2030-03-01T00:00:00Z');
const fixture=()=>mutate(emptyState(),'staff','demo',{},t);
const order=(hours:number,phone='0901234567')=>({name:'Hội viên A',contact:'a@example.com',phone,purpose:'Sinh hoạt CLB tại trường',start:new Date(t+3600000).toISOString(),end:new Date(t+(1+hours)*3600000).toISOString(),items:[{id:'TB001',qty:1}]});
test('Both board and equipment staff can add equipment, borrowers cannot',()=>{
 const s=fixture();
 const p={code:'TB900',name:'Loa dự phòng',total:2,value:200000,category:'Âm thanh'};
 const n=mutate(s,'board','equipment',p,t);
 assert.equal(n.equipment.find(e=>e.id==='TB900')?.name,'Loa dự phòng');
 const s2=mutate(n,'staff','equipment',{...p,code:'TB901'},t);
 assert.ok(s2.equipment.some(e=>e.id==='TB901'));
 assert.throws(()=>mutate(s,'borrower','equipment',{...p,code:'TB902'},t),/Vai trò/);
});
test('Exactly 24 hours requires board approval, shorter low-value requests do not',()=>{
 let s=fixture();
 s.settings.highValue=999999999;
 let long=mutate(s,'borrower','create',order(24),t);
 long=mutate(long,'staff','review',{id:long.requests[0].id,valid:true},t);
 assert.equal(long.requests[0].status,'board');
 let short=mutate(s,'borrower','create',order(23),t);
 short=mutate(short,'staff','review',{id:short.requests[0].id,valid:true},t);
 assert.equal(short.requests[0].status,'ready');
});
test('Phone number is required for new loan applications',()=>{
 const s=fixture();
 assert.throws(()=>mutate(s,'borrower','create',order(2,''),t),/số điện thoại/);
 assert.throws(()=>mutate(s,'borrower','create',order(2,'oops'),t),/Số điện thoại/);
 assert.equal(mutate(s,'borrower','create',order(2),t).requests.length,1);
});
test('Staff can hand over outside planned slot; signed loans can request return even past deadline',()=>{
 let s=fixture();
 s.requests=[{id:'MT-TEST',name:'Hội viên A',contact:'a@example.com',status:'ready',start:new Date(t+86400000).toISOString(),end:new Date(t+2*86400000).toISOString(),items:[{id:'TB001',qty:1}]}];
 s=mutate(s,'staff','handover',{id:'MT-TEST',note:'Đã kiểm tra đủ phụ kiện',checked:true},t);
 assert.equal(s.requests[0].status,'handover');
 s=mutate(s,'borrower','sign',{id:'MT-TEST',confirmed:true},t);
 s=mutate(s,'borrower','requestEarlyReturn',{id:'MT-TEST',confirmed:true},t+3*86400000);
 assert.ok(s.requests[0].earlyReturnRequestedAt);
 assert.equal(s.requests[0].status,'borrowed');
 s=mutate(s,'staff','return',{id:'MT-TEST',checked:true,note:'Đủ phụ kiện',damage:[]},t+3*86400000+1000);
 assert.equal(s.requests[0].status,'closed');
});
test('New requests notify only borrower and verified club staff; board approvals notify borrower and staff',()=>{
 const before=fixture();
 let next=mutate(before,'borrower','create',order(2),t);
 const id=next.requests[0].id;
 const roles={staff:['staff@example.com'],board:['board@example.com']};
 assert.equal(queueActivityNotices(next,before,'create',id,'borrower',roles,t),2);
 assert.deepEqual(new Set(next.notices.filter(n=>n.type==='activity').map(n=>n.to)),new Set(['staff@example.com','a@example.com']));
 assert.ok(next.notices.every(n=>n.emailStatus==='queued'&&n.channel==='in-app'));
 let reviewed=mutate(next,'staff','review',{id,valid:true},t);
 assert.equal(queueActivityNotices(reviewed,next,'review',id,'staff',roles,t),2);
 assert.ok(reviewed.notices.some(n=>n.to==='board@example.com'&&n.type==='activity'));
});

test('Early handover blocks inventory immediately and overdue signed-out stock remains unavailable until staff receives it',()=>{
 let state=fixture();state.requests=[{id:'MT-EARLY',name:'Hội viên A',contact:'a@example.com',status:'ready',start:new Date(t+86400000).toISOString(),end:new Date(t+2*86400000).toISOString(),items:[{id:'TB001',qty:1}]}];
 const windowStart=new Date(t+1000).toISOString(),windowEnd=new Date(t+3600000).toISOString();
 assert.equal(available(state,'TB001',windowStart,windowEnd),4);
 state=mutate(state,'staff','handover',{id:'MT-EARLY',note:'Đã kiểm tra thiết bị',checked:true},t);
 assert.equal(available(state,'TB001',windowStart,windowEnd),3);
 state=mutate(state,'borrower','sign',{id:'MT-EARLY',confirmed:true},t+1000);
 assert.equal(available(state,'TB001',new Date(t+3*86400000).toISOString(),new Date(t+4*86400000).toISOString()),3);
 state=mutate(state,'staff','return',{id:'MT-EARLY',checked:true,note:'Nguyên vẹn',damage:[]},t+3*86400000);
 assert.equal(available(state,'TB001',new Date(t+3*86400000).toISOString(),new Date(t+4*86400000).toISOString()),4);
});
