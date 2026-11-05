import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailReady,mailProvider,sendTransactionalEmail} from '../lib/mail.ts';

const env={EMAIL_PROVIDER:'gmail_script',GMAIL_SCRIPT_URL:'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec',GMAIL_SCRIPT_SECRET:'a'.repeat(48)};
test('Gmail provider requires URL and server-side secret',()=>{
 assert.equal(mailReady(env),true);
 assert.equal(mailReady({...env,GMAIL_SCRIPT_SECRET:''}),false);
 assert.equal(mailReady({}),false);
});
test('Gmail gateway posts only server-side credentials and accepts explicit JSON acknowledgement',async()=>{
 let called=false;
 const fetcher=async(url:any,init:any)=>{
  called=true;
  assert.equal(url,env.GMAIL_SCRIPT_URL);
  assert.equal(init.method,'POST');
  assert.equal(init.headers['Content-Type'],'text/plain;charset=utf-8');
  const body=JSON.parse(init.body);
  assert.equal(body.secret,env.GMAIL_SCRIPT_SECRET);
  assert.equal(body.to,'member@example.test');
  assert.equal(body.subject,'Mã xác minh');
  return new Response(JSON.stringify({ok:true,id:body.id}),{status:200});
 };
 const id=await sendTransactionalEmail(env,'member@example.test','Mã xác minh','Nội dung test','verify-test-message',fetcher as typeof fetch);
 assert.equal(id,'verify-test-message');
 assert.equal(called,true);
});
test('Gmail gateway rejects false acknowledgements and malformed URL',async()=>{
 const fake=async()=>new Response(JSON.stringify({ok:false,error:'delivery_failed'}),{status:200});
 await assert.rejects(sendTransactionalEmail(env,'member@example.test','subject','body','message-01',fake as typeof fetch),/Gmail không chấp nhận/);
 await assert.rejects(sendTransactionalEmail({...env,GMAIL_SCRIPT_URL:'https://evil.example/steal'},'member@example.test','subject','body','message-01',fake as typeof fetch),/không hợp lệ/);
});

test('Gmail configuration works without optional EMAIL_PROVIDER and takes priority over legacy Resend',async()=>{
 const fallback={GMAIL_SCRIPT_URL:env.GMAIL_SCRIPT_URL,GMAIL_SCRIPT_SECRET:env.GMAIL_SCRIPT_SECRET,RESEND_API_KEY:'outdated',MAIL_FROM:'not-configured@example.test'};
 assert.equal(mailProvider(fallback),'gmail_script');
 assert.equal(mailReady(fallback),true);
 let called=false;
 const send=async(url:any,init:any)=>{
  called=true;
  assert.equal(url,env.GMAIL_SCRIPT_URL);
  return Response.json({ok:true,id:JSON.parse(init.body).id});
 };
 const id=await sendTransactionalEmail(fallback,'member@example.test','Xác minh','Code','verify-mail-test',send as typeof fetch);
 assert.equal(id,'verify-mail-test');
 assert.equal(called,true);
 assert.equal(mailProvider({EMAIL_PROVIDER:'gmail_script',RESEND_API_KEY:'old',MAIL_FROM:'x@y.test'}),null);
});
