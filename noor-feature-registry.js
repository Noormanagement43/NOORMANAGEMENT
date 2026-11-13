/* Shared feature declarations. Add new feature metadata and route aliases here.
   Postgres authorizes registration and stores all effective availability settings. */
(()=>{'use strict';
const catalog=[
  {
    "feature_key": "attendance",
    "label": "Student Attendance",
    "category": "Academics",
    "description": "Attendance marking and attendance records",
    "views": [
      "student-attendance",
      "my-class-attendance"
    ]
  },
  {
    "feature_key": "staff_attendance",
    "label": "Teacher Attendance",
    "category": "People",
    "description": "Staff check-in and attendance",
    "views": []
  },
  {
    "feature_key": "classes",
    "label": "Classes and Sections",
    "category": "Academics",
    "description": "Class, section and stream management",
    "views": []
  },
  {
    "feature_key": "teachers",
    "label": "Teacher Management",
    "category": "People",
    "description": "Teacher and staff management",
    "views": [
      "staff-management",
      "teacher-directory",
      "staff-access"
    ]
  },
  {
    "feature_key": "students",
    "label": "Student Management",
    "category": "People",
    "description": "Student management and enrollment",
    "views": [
      "student-directory",
      "teacher-classroom"
    ]
  },
  {
    "feature_key": "timetable",
    "label": "Timetable and Periods",
    "category": "Academics",
    "description": "Schedules, time slots and daily lessons",
    "views": [
      "schedules",
      "student-schedule"
    ]
  },
  {
    "feature_key": "marks",
    "label": "Student Marks",
    "category": "Academics",
    "description": "Marks entry and academic results",
    "views": [
      "assessments"
    ]
  },
  {
    "feature_key": "report_cards",
    "label": "Report Cards",
    "category": "Academics",
    "description": "Term report cards and progress reports",
    "views": [
      "class-performance",
      "student-progress",
      "student-portfolio"
    ]
  },
  {
    "feature_key": "annual_cards",
    "label": "Annual Cards",
    "category": "Academics",
    "description": "Annual consolidated report cards",
    "views": []
  },
  {
    "feature_key": "weekly_tests",
    "label": "Weekly Tests",
    "category": "Academics",
    "description": "Weekly online tests and attempts",
    "views": []
  },
  {
    "feature_key": "monthly_tests",
    "label": "Monthly Tests",
    "category": "Academics",
    "description": "Monthly test papers and attempts",
    "views": []
  },
  {
    "feature_key": "exams",
    "label": "Exams",
    "category": "Academics",
    "description": "Exam papers and attempts",
    "views": []
  },
  {
    "feature_key": "assignments",
    "label": "Assignments and Homework",
    "category": "Learning",
    "description": "Class assignments and submissions",
    "views": [
      "paper-generator",
      "student-homework",
      "deadline-planner",
      "rubric-assistant"
    ]
  },
  {
    "feature_key": "smart_notes",
    "label": "Smart Notes",
    "category": "Learning",
    "description": "Revision, smart notes and recorded lessons",
    "views": [
      "teaching",
      "notes"
    ]
  },
  {
    "feature_key": "library",
    "label": "Learning Library",
    "category": "Learning",
    "description": "Published learning materials",
    "views": [
      "student-learning"
    ]
  },
  {
    "feature_key": "ai_assistant",
    "label": "AI Assistant",
    "category": "AI",
    "description": "AI assistance and generation",
    "views": []
  },
  {
    "feature_key": "analytics",
    "label": "Analytics and Live Insights",
    "category": "AI",
    "description": "Role-based progress and attendance insights",
    "views": [
      "live-analytics",
      "academic-monitoring",
      "student-gaps"
    ]
  },
  {
    "feature_key": "notices",
    "label": "Notices and Meetings",
    "category": "Communication",
    "description": "School notices and meetings",
    "views": [
      "notifications",
      "meetings"
    ]
  },
  {
    "feature_key": "email",
    "label": "Email",
    "category": "Communication",
    "description": "External school email campaigns",
    "views": [
      "email-automation"
    ]
  },
  {
    "feature_key": "parent_communication",
    "label": "Parent Communication",
    "category": "Communication",
    "description": "Guardian links and parent support",
    "views": [
      "parent-support"
    ]
  },
  {
    "feature_key": "calendar",
    "label": "Calendar",
    "category": "Academics",
    "description": "School calendar and holidays",
    "views": [
      "school-calendar",
      "teacher-calendar",
      "student-calendar"
    ]
  },
  {
    "feature_key": "profile_edit",
    "label": "Profile Editing",
    "category": "People",
    "description": "Profile and personal preferences",
    "views": []
  },
  {
    "feature_key": "school_settings",
    "label": "School Settings",
    "category": "Other",
    "description": "Branding and school appearance",
    "views": []
  },
  {
    "feature_key": "diary",
    "label": "Teaching Diary and Plans",
    "category": "Learning",
    "description": "Teaching plans, class questions and tasks",
    "views": [
      "weekly-plan",
      "teaching-diary",
      "daily-report",
      "today-note",
      "student-questions",
      "student-planner",
      "school-tasks",
      "syllabus-tracker"
    ]
  }
];
// Mixed launchers stay available while at least one child feature is enabled.
const groups=Object.freeze({'teacher-resources':Object.freeze(['smart_notes','assignments'])});
// Workspace/security/support shells must remain reachable independently of feature switches.
const shells=Object.freeze({overview:'Workspace home',settings:'Account and school settings shell',profile:'Account settings shell','help-support':'Contact platform support',schools:'Legacy creator shell',management:'Legacy management shell','command-centre':'Workspace home alias','principal-studio':'Principal workspace home','audit-logs':'Security audit history'});
const views=Object.create(null);
for(const f of catalog){Object.freeze(f.views);Object.freeze(f);for(const view of [f.feature_key,...f.views]){if(views[view])throw Error('Duplicate feature route: '+view);views[view]=f.feature_key;}}
Object.freeze(catalog);Object.freeze(views);
function keys(view){return groups[view]|| (views[view]?[views[view]]:[]);}
function known(view){return !!(views[view]||groups[view]||Object.hasOwn(shells,view));}
function allowed(view,features){const targets=keys(view);return !targets.length||targets.some(k=>features?.[k]!==false);}
async function sync(db){const definitions=catalog.map(({feature_key,label,category,description})=>({feature_key,label,category,description}));const r=await db.rpc('noor_creator_register_features',{p_features:definitions});if(r.error)throw r.error;if(r.data?.registered!==catalog.length)throw Error('Feature registry sync was not confirmed.');return r.data;}
window.NOOR_FEATURE_REGISTRY=Object.freeze({catalog,views,groups,shells,keys,known,allowed,sync});
})();
