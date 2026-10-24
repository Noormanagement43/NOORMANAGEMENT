/* Automated visual/workflow smoke test with isolated browser-only mock school data.
 * This never authenticates or writes to any real school or production tables.
 */
import { chromium } from "playwright";
const siteUrl=process.env.SITE_URL;
if(!siteUrl)throw Error("SITE_URL required");
const browser=await chromium.launch({headless:true});
async function check(viewport){
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  const res=await page.goto(siteUrl,{waitUntil:"domcontentloaded",timeout:60000});
  if(!res?.ok())throw Error("Site HTTP "+res?.status());
  await page.waitForFunction(()=>Boolean(window.NOOR_TEACHER_REFERENCE&&window.NOOR_TEACHER_EMBED&&window.NOOR_PAPER_GENERATOR),{timeout:15000});
  await page.evaluate(()=>{
    const currentDay=new Date().getDay();
    const profileId="qa-teacher-1",schoolId="qa-school-1",classId="qa-class-8",sectionId="qa-section-b";
    const students=[{id:"qa-student-1",full_name:"Student Example A",roll_number:"801",school_id:schoolId,class_id:classId,section_id:sectionId,role:"student",status:"active"},
      {id:"qa-student-2",full_name:"Student Example B",roll_number:"802",school_id:schoolId,class_id:classId,section_id:sectionId,role:"student",status:"active"}];
    const data={
      noor_teacher_profile_details:[{teacher_id:profileId,school_id:schoolId,qualification:"B.Ed.",employee_code:"TCH-QA-01",joined_on:"2026-01-03"}],
      noor_teacher_periods:[{id:"qa-period-1",teacher_id:profileId,school_id:schoolId,weekday:currentDay,period_number:1,start_time:"09:00:00",end_time:"09:45:00",subject_name:"English",class_label:"Class 8 - B",status:"upcoming",approval_status:"approved"}],
      noor_teacher_period_runs:[],
      noor_staff_attendance:[],task_assignees:[],noor_teacher_tasks:[],school_notices:[],calendar_events:[],
      teacher_assignments:[{teacher_id:profileId,school_id:schoolId,class_id:classId,section_id:sectionId,is_active:true}],
      school_memberships:[{user_id:profileId,school_id:schoolId,employee_id:"TCH-QA-01",joined_at:"2026-01-03T08:00:00Z"}],
      classes:[{id:classId,name:"Class 8",school_id:schoolId,is_active:true}],
      sections:[{id:sectionId,name:"B",class_id:classId,is_active:true}],
      profiles:students,attendance_sessions:[],attendance_records:[],school_tasks:[],noor_teacher_paper_drafts:[]
    };
    function from(table){
      let selected=[...(data[table]||[])];
      const chain={
        select(){return this;},eq(k,v){selected=selected.filter(x=>x[k]===v);return this;},
        in(k,values){selected=selected.filter(x=>values.includes(x[k]));return this;},
        is(k,v){selected=selected.filter(x=>x[k]===v);return this;},
        gte(k,v){selected=selected.filter(x=>x[k]>=v);return this;},
        order(k,options){selected.sort((a,b)=>String(a[k]??"").localeCompare(String(b[k]??""))*(options?.ascending===false?-1:1));return this;},
        limit(n){selected=selected.slice(0,n);return this;},
        maybeSingle(){return Promise.resolve({data:selected[0]||null,error:null});},
        single(){return Promise.resolve({data:selected[0]||null,error:null});},
        then(resolve,reject){return Promise.resolve({data:selected,error:null}).then(resolve,reject)}
      };
      return chain;
    }
    const db={from,channel(){return{on(){return this},subscribe(fn){fn?.("SUBSCRIBED");return this}}},removeChannel(){}};
    window.NOOR_AI_APP={
      profile:{id:profileId,role:"teacher",status:"active",full_name:"QA Teacher",email:"qa@example.test",mobile_number:"0000000000"},
      user:{id:profileId,email:"qa@example.test"},school:{name:"QA School"},
      schoolId,db,toast(){},openView(id){
       const dest=document.getElementById("view-"+id);
       document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
       dest?.classList.add("active");
       if(id==="paper-generator")window.NOOR_PAPER_GENERATOR?.open();
       if(id==="teacher-calendar")window.NOOR_TEACHER_REFERENCE?.renderCalendar();
      }
    };
    const workspace=document.getElementById("workspace");
    workspace.classList.remove("hidden");
    document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
    document.getElementById("view-overview").classList.add("active");
    window.NOOR_TEACHER_REFERENCE.render();
  });
  const profile=page.locator(".noor-t4 .nt-profile");
  await profile.waitFor({state:"visible",timeout:15000});
  if(!(await profile.innerText()).includes("QA Teacher"))throw Error("Teacher profile not visible");
  if(!(await page.locator(".noor-t4").innerText()).includes("Teaching Periods"))throw Error("Teaching Periods not visible");
  if(viewport.width<=760)await page.locator("#ntAttTable .nt-att-mobile-row").first().waitFor({timeout:15000});
  else await page.locator("#ntAttTable tr").first().waitFor({timeout:15000});
  if(!(await page.locator("#ntAttTable").innerText()).includes("Student Example A"))throw Error("Student roster not visible");
  await page.locator("#ntTeacherIntelligence .nti-quick-grid").first().waitFor({timeout:15000});
  if(!(await page.locator("#ntTeacherIntelligence").innerText()).includes("AI Teacher Command Centre"))throw Error("AI Teacher Command Centre missing beneath profile");
  await page.locator("#ntTeacherPlanners #ntpSyllabus").waitFor({timeout:15000});
  await page.locator("#ntTeacherPlanners #ntpDeadlines").waitFor({timeout:15000});
  const geometry=await page.evaluate(()=>{const photo=document.querySelector('.noor-t4 .nt-photo'),profile=document.querySelector('.noor-t4 .nt-profile'),hub=document.getElementById('ntTeacherIntelligence'),attendance=document.querySelector('.nt-attendance');const s=photo?getComputedStyle(photo):null;return {width:photo?.getBoundingClientRect().width||0,borderRadius:parseFloat(s?.borderTopLeftRadius||'999'),order:profile&&hub&&profile.nextElementSibling===hub,attendance:!!attendance};});
  if(geometry.width<155||geometry.borderRadius>23)throw Error("Teacher profile is not a large rectangular portrait: "+JSON.stringify(geometry));
  if(!geometry.order||!geometry.attendance)throw Error("Profile / Command Centre / Attendance layout incomplete");
  const bounds=await page.locator(".noor-t4").boundingBox();
  if(bounds?.width>viewport.width+25)throw Error("Teacher layout overflows screen: "+bounds?.width+" > "+viewport.width);
  await page.locator("#ntEditProfile").click();
  await page.locator(".nt4-dialog input[name='qualification']").waitFor();
  await page.locator(".nt4-overlay [data-close]").first().click();
  await page.locator("#ntEditTimetable").click();
  await page.locator(".nt4-dialog input[name='subject_name']").waitFor();
  await page.locator(".nt4-overlay [data-close]").first().click();
  await page.locator(".noor-t4 [data-link='paper-generator']").first().click();
  await page.locator("#ppForm").waitFor({timeout:15000});
  if(!(await page.locator("#ppForm").innerText()).includes("Paper type"))throw Error("Paper generator not functional");
  if(errors.length)throw Error("Browser exceptions: "+errors.join(" | "));
  console.log("PASS: Teacher profile, rectangle photo, AI Command Centre, syllabus/deadline planners, responsive attendance, paper editor (mock data), viewport "+viewport.width);
 }finally{await page.close()}
}
try{await check({width:1280,height:840});await check({width:390,height:844});}finally{await browser.close()}
