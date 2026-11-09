// NOOR: read-only Brevo email readiness probe. Never returns a key, address or contact data.
export type BrevoStatus = {
 api_key_present:boolean; account_authenticated:boolean; sender_configured:boolean;
 sender_registered:boolean; sender_verified:boolean; delivery_ready:boolean;
 check_performed:boolean; email_sent:false; reason:string;
};
const ENDPOINT = 'https://api.brevo.com/v3';
export async function checkBrevoEmailReadiness(env:Record<string,string|undefined>, request:typeof fetch=fetch):Promise<BrevoStatus>{
 const apiKey=env.BREVO_API_KEY||env.brevo;
 const sender=String(env.EMAIL_FROM||'').trim().toLowerCase();
 const result:BrevoStatus={
  api_key_present:!!apiKey,account_authenticated:false,sender_configured:!!sender,
  sender_registered:false,sender_verified:false,delivery_ready:false,
  check_performed:false,email_sent:false,reason:''
 };
 if(!apiKey){result.reason='BREVO_API_KEY_MISSING';return result;}
 const headers:Record<string,string>={'api-key':apiKey,'accept':'application/json'};
 const opts={method:'GET',headers,redirect:'error' as RequestRedirect,signal:AbortSignal.timeout(12000)};
 try{
  const account=await request(ENDPOINT+'/account',opts);
  result.check_performed=true;result.account_authenticated=account.status===200;
  await account.body?.cancel().catch(()=>{});
  if(!result.account_authenticated){result.reason=account.status===401?'BREVO_API_KEY_REJECTED':'BREVO_ACCOUNT_UNAVAILABLE';return result;}
  if(!sender){result.reason='EMAIL_FROM_MISSING';return result;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)){result.reason='EMAIL_FROM_INVALID';return result;}
  const res=await request(ENDPOINT+'/senders',opts);
  if(!res.ok){result.reason='BREVO_SENDERS_UNAVAILABLE';await res.body?.cancel().catch(()=>{});return result;}
  // Never expose the sender address or unrelated customer records.
  const payload=await res.json();
  const record=Array.isArray(payload?.senders)?payload.senders.find((x:{email?:string})=>String(x?.email||'').toLowerCase()===sender):undefined;
  result.sender_registered=!!record;
  result.sender_verified=!!record&&(record.active===true||record.verified===true);
  result.delivery_ready=result.account_authenticated&&result.sender_verified;
  result.reason=result.delivery_ready?'READY_FOR_EXPLICIT_SEND_TEST':!result.sender_registered?'SENDER_NOT_REGISTERED':'SENDER_NOT_VERIFIED';
  return result;
 }catch{
  result.reason='BREVO_CHECK_FAILED';return result;
 }
}
