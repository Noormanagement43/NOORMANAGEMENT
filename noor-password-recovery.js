(function(root){
 'use strict';
 function createRecovery(auth, redirectTo, now=Date.now, sendRecovery=null){
  let email='',verifiedUser=null,busy=false,nextSend=0;
  const failure=message=>new Error(message);
  function requireIdle(){if(busy)throw failure('Please wait for the current request.');}
  return {
   get email(){return email;},get verified(){return !!verifiedUser;},get busy(){return busy;},
   async send(value){
    requireIdle();const address=String(value||'').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||address.length>254)throw failure('Enter a valid account email.');
    if(now()<nextSend)throw failure('Please wait a minute before requesting another email.');
    busy=true;verifiedUser=null;
    try{const {error}=await (sendRecovery?sendRecovery(address):auth.resetPasswordForEmail(address,{redirectTo}));if(error)throw failure(error.status===429?'Too many requests. Wait before trying again.':'Recovery email could not be requested. Please try again shortly.');email=address;nextSend=now()+60000;}
    finally{busy=false;}
   },
   async verify(code){
    requireIdle();if(!email)throw failure('Request a recovery email first.');
    const token=String(code||'').trim();if(!/^\d{6,10}$/.test(token))throw failure('Enter the numeric code from your recovery email.');
    busy=true;verifiedUser=null;
    try{const {data,error}=await auth.verifyOtp({email,token,type:'recovery'});if(error||!data?.session?.user?.id)throw failure('Code is invalid or expired. Request a new recovery email.');verifiedUser=data.session.user.id;}
    finally{busy=false;}
   },
   acceptRecoverySession(session){if(session?.user?.id)verifiedUser=session.user.id;},
   async save(password,confirmation){
    requireIdle();if(!verifiedUser)throw failure('Verify your recovery code or open the email reset link first.');
    if(typeof password!=='string'||password.length<8||password.length>128||password!==confirmation)throw failure('Use 8–128 characters and enter the same password twice.');
    busy=true;
    try{
     const {data,error}=await auth.getUser();
     if(error||data?.user?.id!==verifiedUser){verifiedUser=null;throw failure('Recovery session expired. Request a new email.');}
     const result=await auth.updateUser({password});
     if(result.error)throw failure('Password was not changed. Use a different strong password or request a new recovery email.');
     verifiedUser=null;
     let signedOut=false;
     try{const result=await auth.signOut({scope:'global'});signedOut=!result.error;}catch{/* Password already changed; report sign-out separately. */}
     return {updated:true,signedOut};
    }finally{busy=false;}
   },
  };
 }
 root.NOOR_PASSWORD_RECOVERY={createRecovery};
 if(!root.document?.getElementById('passwordRecoveryApp'))return;
 const $=id=>document.getElementById(id),message=(text,type='info')=>{const el=$('recoveryMessage');el.textContent=text;el.className='notice '+type;el.hidden=false;};
 const config=root.NOOR_CONFIG||{};
 if(config.SUPABASE_URL!=='https://ayrryemawwplguaauxij.supabase.co'||!config.SUPABASE_PUBLISHABLE_KEY||!root.supabase?.createClient){message('Secure connection unavailable. Please try again later.','error');return;}
 const linkParams=new URLSearchParams(root.location.hash.slice(1));
 const recoveryLink=linkParams.get('type')==='recovery';
 const db=root.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:true,storageKey:'noor.password-recovery'}});
 const redirectTo=new URL('./forgot-password.html',root.location.href).href;
 const flow=createRecovery(db.auth,redirectTo,Date.now,async email=>{const result=await db.functions.invoke('noor-auth-recovery',{body:{email}});return {error:result.error?{status:result.error.context?.status}:null};});
 function showPassword(){ $('emailStep').hidden=true;$('codeStep').hidden=true;$('passwordStep').hidden=false;message('Email verified. Choose your new password.','success');$('newPassword').focus(); }
 db.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'&&session?.user?.id){flow.acceptRecoverySession(session);setTimeout(showPassword,0);}});
 async function run(button,fn){if(flow.busy)return;button.disabled=true;try{await fn();}catch(error){message(error.message,'error');}finally{button.disabled=false;}}
 $('emailForm').addEventListener('submit',event=>{event.preventDefault();run($('sendRecovery'),async()=>{await flow.send($('recoveryEmail').value);$('emailStep').hidden=true;$('codeStep').hidden=false;$('sentEmail').textContent=flow.email;message('If this email is registered, a recovery email will arrive. Check Spam too. Enter its code below or open its reset link.');$('recoveryCode').focus();});});
 $('codeForm').addEventListener('submit',event=>{event.preventDefault();run($('verifyRecovery'),async()=>{await flow.verify($('recoveryCode').value);$('recoveryCode').value='';showPassword();});});
 $('resendRecovery').addEventListener('click',()=>run($('resendRecovery'),async()=>{await flow.send(flow.email);message('If this email is registered, a new recovery email will arrive. Only the latest code should be used.');}));
 $('changeEmail').addEventListener('click',()=>{$('codeStep').hidden=true;$('emailStep').hidden=false;$('recoveryCode').value='';$('recoveryEmail').focus();});
 $('passwordForm').addEventListener('submit',event=>{event.preventDefault();run($('saveRecoveryPassword'),async()=>{const result=await flow.save($('newPassword').value,$('confirmNewPassword').value);$('passwordForm').reset();$('passwordStep').hidden=true;$('completeStep').hidden=false;message(result.signedOut?'Password updated. Sign in with your new password.':'Password updated. Return to sign in; other-session sign-out could not be confirmed.','success');});});
 const tokenHash=linkParams.get('token_hash');
 if(recoveryLink&&tokenHash){
  root.history.replaceState(null,'',root.location.pathname);
  db.auth.verifyOtp({token_hash:tokenHash,type:'recovery'}).then(({data,error})=>{
   if(error||!data?.session?.user?.id){message('This reset link is invalid or expired. Request another recovery email.','error');return;}
   flow.acceptRecoverySession(data.session);showPassword();
  }).catch(()=>message('Could not verify this link. Request another recovery email.','error'));
 }
 const errorParams=new URLSearchParams(root.location.search);
 if(linkParams.has('error')||errorParams.has('error')){
  message('This reset link is invalid or expired. Request another recovery email.','error');root.history.replaceState(null,'',root.location.pathname);
 }
 db.auth.getSession().then(({data,error})=>{
  if(!error&&recoveryLink&&data?.session?.user?.id){flow.acceptRecoverySession(data.session);showPassword();}
 }).catch(()=>message('Could not restore the recovery link. Request a new email.','error'));
})(typeof window!=='undefined'?window:globalThis);
