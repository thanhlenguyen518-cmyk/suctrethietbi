import PasswordReset from '../../../components/password-reset';

export default async function ResetPasswordPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 return <PasswordReset token={token}/>;
}
