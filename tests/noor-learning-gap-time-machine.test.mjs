import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const js=readFileSync(new URL('../noor-learning-gap-time-machine.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261117121344_noor_learning_gap_time_machine_universal.sql',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('learning module parses and is attached without changing existing sidebar',()=>{
  assert.doesNotThrow(()=>new vm.Script(js));
  assert.match(html,/noor-learning-gap-time-machine\.js/);
  assert.match(html,/noor-learning-gap-time-machine\.css/);
  assert.match(js,/data-lgt-launcher/);
  assert.doesNotMatch(js,/mainNav\.innerHTML|sidebar\.innerHTML/);
});
test('schema is additive, RLS-backed and guarded by configured controls',()=>{
  const tables=['learning_concepts','concept_dependencies','assessment_concept_mapping',
   'student_concept_evidence','student_concept_mastery','learning_gap_findings',
   'learning_recovery_plans','learning_recovery_activities','learning_reassessments',
   'learning_ai_audit_logs','learning_timeline_events'];
  for(const name of tables) {
    assert.match(sql,new RegExp('create table public\\.'+name+' \\('));
    assert.match(sql,new RegExp("'"+name+"'"));
  }
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on public\.%I from public,anon,authenticated/);
  assert.match(sql,/grant select on public\.%I to authenticated/);
  assert.match(sql,/noor_lg_can_teach/);
  assert.match(sql,/noor_lg_can_read/);
  assert.match(sql,/learning_gap_time_machine',false/);
});
test('no single quiz submission can become a confirmed learning gap',()=>{
  assert.match(sql,/when n<3 or sources<2 then 'Not Enough Evidence'/);
  assert.match(sql,/if m\.evidence_count<3 or m\.source_count<2/);
  assert.match(sql,/if f\.status<>'confirmed'/);
  assert.match(sql,/on conflict\(institution_id,source_type,source_id,question_index,concept_id\) do nothing/);
  assert.match(sql,/Historical evidence exists\. Mapping cannot be changed/);
});
test('teacher approves interventions; student activity is self-scoped and audited',()=>{
  assert.match(sql,/if not private\.noor_lg_can_teach\(pinst,p_student\)/);
  assert.match(sql,/m\.user_id=auth\.uid\(\) and m\.status='active'/);
  assert.match(sql,/learning_timeline_events/);
  assert.match(js,/I checked the lesson and practice against the school syllabus/);
  assert.match(js,/I have completed this practice/);
  assert.doesNotMatch(js,/Groq|Gemini|OpenAI/);
});
test('teacher rechecks follow assigned practice and never auto-certify mastery',()=>{
 assert.match(sql,/create function private\.noor_lg_reassess/);
 assert.match(sql,/Completed practice and a verified reassessment are required/);
 assert.match(js,/noor_lg_reassess/);
 assert.match(js,/noor_lg_principal_summary/);
 assert.match(js,/features\?\.learning_gap_time_machine===true/);
 assert.match(js,/Possible prerequisites/);
 assert.match(js,/noor_lg_add_concept/);
 assert.match(js,/noor_lg_observe/);
 assert.match(sql,/create function private\.noor_lg_add_concept/);
 assert.match(sql,/create function private\.noor_lg_observe/);
 assert.match(sql,/create or replace function private\.noor_lg_principal_summary/);
});
