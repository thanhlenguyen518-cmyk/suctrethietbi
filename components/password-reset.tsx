'use client';
import {useState} from 'react';

export default function PasswordReset({token,onBack}:{token:string;onBack:()=>void}){
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirm]=useState('');
 const [visible,setVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const isReset=token.length>0;
 const validToken=!isReset||/^[a-f0-9-]{72}$/.test(token);
 const passwordLengthOk=password.length>=10&&password.length<=128;
 const mismatch=isReset&&confirmPassword.length>0&&password!==confirmPassword;
 const canSubmit=!busy&&!(isReset&&message)&&(!isReset||validToken&&passwordLengthOk&&password===confirmPassword);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  setError('');setMessage('');
  if(isReset&&!validToken){setError('Liên kết đặt lại không hợp lệ. Hãy yêu cầu liên kết mới.');return;}
  if(isReset&&!passwordLengthOk){setError('Mật khẩu mới phải có từ 10 đến 128 ký tự.');return;}
  if(isReset&&password!==confirmPassword){setError('Hai mật khẩu không trùng khớp.');return;}
  setBusy(true);
  try{
   const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:isReset?'resetPassword':'forgotPassword',token,email,password,confirmPassword})});
   const result:any=await r.json();
   if(!r.ok)throw Error(result.error||'Không xử lý được yêu cầu. Vui lòng thử lại.');
   setMessage(result.message||'Đã xử lý thành công.');
   if(isReset){setPassword('');setConfirm('');}
  }catch(e:any){setError(e.message||'Có lỗi xảy ra. Vui lòng thử lại.');}
  finally{setBusy(false);}
 }
 return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:16,width:'100%',boxSizing:'border-box'}}>
  <section className="panel" style={{maxWidth:440,width:'100%',padding:'clamp(18px,5vw,32px)',minWidth:0,boxSizing:'border-box'}}>
   <h1>{isReset?'Đặt lại mật khẩu':'Quên mật khẩu'}</h1>
   <form style={{display:'grid',gap:16}} onSubmit={submit}>
    {isReset?<>
     {!validToken&&<p role="alert" className="error">Liên kết không đầy đủ. Vui lòng mở lại liên kết từ email hoặc yêu cầu liên kết mới.</p>}
     <label>Mật khẩu mới
      <input required type={visible?'text':'password'} minLength={10} maxLength={128} autoComplete="new-password"
       value={password} onChange={e=>{setPassword(e.target.value);setError('')}}/>
     </label>
     <label>Nhập lại mật khẩu
      <input required type={visible?'text':'password'} minLength={10} maxLength={128} autoComplete="new-password"
       value={confirmPassword} onChange={e=>{setConfirm(e.target.value);setError('')}}/>
     </label>
     <button type="button" className="secondary" onClick={()=>setVisible(v=>!v)}
      aria-pressed={visible} style={{width:'100%',minHeight:44,display:'block'}}>
      {visible?'Ẩn mật khẩu':'Hiện mật khẩu'}
     </button>
     {mismatch&&<p role="alert" style={{color:'#9b2d12',margin:0}}>Hai mật khẩu chưa trùng khớp.</p>}
     {password.length>0&&!passwordLengthOk&&<p style={{color:'#7b5116',margin:0}}>Cần từ 10 đến 128 ký tự.</p>}
    </>:<label>Email đã đăng ký
     <input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/>
    </label>}
    {error&&<p role="alert" style={{color:'#9b2d12',margin:0}}>{error}</p>}
    {message&&<p role="status" style={{color:'#285a42',margin:0}}>{message}</p>}
    <button type="submit" className="primary" disabled={!canSubmit}>
     {busy?'Đang xử lý…':isReset?'Lưu mật khẩu mới':'Gửi liên kết đặt lại'}
    </button>
    <button type="button" className="secondary" onClick={onBack}>Về đăng nhập</button>
   </form>
  </section>
 </main>;
}
