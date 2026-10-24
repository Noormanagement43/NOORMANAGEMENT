/* NOOR offline teacher attendance: device-only pending roster marks; sync only after verified online authentication. */
(()=>{'use strict';
const APP=()=>window.NOOR_AI_APP||{};
const DB_NAME='noor-teacher-offline-attendance-v1',STORE='pending-attendance';
const dbOpen=()=>new Promise((resolve,reject)=>{
 if(!window.indexedDB){reject(new Error('Offline device storage is unavailable'));return}
 const req=indexedDB.open(DB_NAME,1);
 req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'key'})};
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Device storage could not open'));
});
async function access(mode,op){const db=await dbOpen();return new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,mode),st=tx.objectStore(STORE),request=op(st);
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);
})}
const identity=()=>{const a=APP();if(!a.user?.id||!a.schoolId||a.profile?.role!=='teacher')throw new Error('Verified school teacher login is required.');return a};
const key=(a,x)=>[a.schoolId,a.user.id,x.class_id,x.section_id||'entire-class',x.attendance_date].join(':');
async function queue({class_id,section_id,attendance_date,marks}){
 const a=identity();
 if(!class_id||!attendance_date||!Array.isArray(marks)||!marks.length||marks.some(x=>!x.student_id||!['present','absent','late'].includes(x.status)))throw new Error('A full, marked class roster is required.');
 const entry={key:key(a,{class_id,section_id,attendance_date}),school_id:a.schoolId,teacher_id:a.user.id,class_id,section_id:section_id||null,attendance_date,
 marks:marks.map(x=>({student_id:x.student_id,status:x.status})),created_at:new Date().toISOString()};
 await access('readwrite',st=>st.put(entry));return entry;
}
async function all(){
 const a=identity(),rows=await access('readonly',st=>st.getAll());
 return(rows||[]).filter(x=>x.school_id===a.schoolId&&x.teacher_id===a.user.id).sort((x,y)=>x.created_at.localeCompare(y.created_at));
}
async function sync(){
 const a=identity();if(navigator.onLine===false)throw new Error('You are offline. Drafts remain only on this device.');
 const session=await a.db.auth.getUser();if(session.error||session.data?.user?.id!==a.user.id)throw new Error('Sign in again before syncing attendance.');
 const rows=await all(),results=[];
 for(const x of rows){
  // Same atomic roster submission and database authorization as online attendance.
  const r=await a.db.rpc('noor_submit_class_attendance',{p_school_id:x.school_id,p_class_id:x.class_id,p_section_id:x.section_id,p_attendance_date:x.attendance_date,p_marks:x.marks});
  if(r.error){results.push({id:x.key,ok:false,error:r.error.message});continue;}
  if(!r.data?.session_id||Number(r.data.count)!==x.marks.length){results.push({id:x.key,ok:false,error:'Database did not confirm the complete roster'});continue;}
  await access('readwrite',st=>st.delete(x.key));results.push({id:x.key,ok:true});
 }
 return results;
}
async function discard({class_id,section_id,attendance_date}){const a=identity();await access('readwrite',st=>st.delete(key(a,{class_id,section_id,attendance_date})));}
const isNetworkFailure=error=>navigator.onLine===false||/fetch|network|failed to fetch|load failed|connection|timeout/i.test(String(error?.message||''));
window.NOOR_OFFLINE_ATTENDANCE={queue,all,sync,discard,isNetworkFailure};
})();