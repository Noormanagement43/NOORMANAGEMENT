/* Profile photo isolation for the OLD school-id UI and the NEW institution-id backend.
 * Every upload is authenticated twice, scoped to exactly ONE user and stored at
 * an immutable, user-unique path. Never mirror another account's avatar.
 */
(function(global){
 'use strict';
 const validTypes=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'});
 const ownUser=async(client,expectedId)=>{
  if(!client?.auth?.getUser||!expectedId)throw Error('Sign in again to edit your own photo.');
  const {data,error}=await client.auth.getUser();
  const user=data?.user;
  if(error||!user||user.id!==expectedId)throw Error('This photo belongs to another account. Switch to the correct login.');
  return user;
 };
 async function uploadOwn({client,userId,profile,schoolId,file,backend='legacy'}){
  if(!client||!userId||!file)throw Error('Your account and a photo are required.');
  if(!validTypes[file.type]||file.size>5*1024*1024||file.size===0)throw Error('Use a JPG, PNG or WebP photo smaller than 5 MB.');
  if(profile?.id!==userId)throw Error('The visible profile does not belong to your signed-in account.');
  await ownUser(client,userId);
  const v2=backend==='v2';
  const bucket=v2?'noor-profile-photos':'student-photos';
  const path=userId+'/profile-'+crypto.randomUUID()+'.'+validTypes[file.type];
  const {error:uploadError}=await client.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type,cacheControl:'60'});
  if(uploadError)throw uploadError;
  // Auth could switch during the network upload; never write a profile using stale app state.
  await ownUser(client,userId);
  const patch=v2?{avatar_url:bucket+'/'+path}:{avatar_path:path};
  let q=client.from('profiles').update(patch).eq('id',userId);
  if(!v2 && schoolId)q=q.eq('school_id',schoolId);
  const {data:changed,error:updateError}=await q.select('id').single();
  if(updateError||changed?.id!==userId)throw updateError||Error('Profile update was blocked. Your school membership may have changed.');
  const signed=await client.storage.from(bucket).createSignedUrl(path,900);
  await ownUser(client,userId);
  if(profile.id!==userId)throw Error('Profile changed while saving; reload your account.');
  if(!v2)profile.avatar_path=path;
  else profile.avatar_url=bucket+'/'+path;  // DB stores a *private path*, never a public URL.
  return {path,bucket,avatar_url:signed.data?.signedUrl||'',stored_reference:bucket+'/'+path};
 }
 async function signedUrl({client,storedReference,userId,seconds=900}){
  if(!storedReference)return null;
  if(!/^noor-profile-photos\/[0-9a-f-]{36}\/[^/?#]+$/i.test(storedReference))return null;
  const [bucket,...rest]=storedReference.split('/');
  const path=rest.join('/');
  // Managers can view another member's avatar, subject to storage RLS.
  const {data,error}=await client.storage.from(bucket).createSignedUrl(path,seconds);
  if(error){console.warn('Avatar access restricted',error.message);return null;}
  return data?.signedUrl||null;
 }
 global.NOOR_AVATAR_SAFE=Object.freeze({uploadOwn,signedUrl,ownUser});
})(typeof window==='object'?window:globalThis);