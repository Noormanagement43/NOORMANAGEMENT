import {validOutput} from './index.ts';
function expect(condition:boolean,description:string){if(!condition)throw new Error(description);}
const current='00000000-0000-4000-8000-000000000001',pre='00000000-0000-4000-8000-000000000002';
const context={concept_id:current,evidence:[
{id:'00000000-0000-4000-8000-000000000011',source_id:'00000000-0000-4000-8000-000000000091',source_type:'approved_quiz'},
{id:'00000000-0000-4000-8000-000000000012',source_id:'00000000-0000-4000-8000-000000000091',source_type:'approved_quiz'},
{id:'00000000-0000-4000-8000-000000000013',source_id:'00000000-0000-4000-8000-000000000092',source_type:'teacher_diagnostic'}],
prerequisites:[{concept_id:pre,title:'Prerequisite'}]};
const draft={concept_id:current,evidence_ids:['E1','E3'],
 explanation:'Practice one concept at a time and verify with a guided recheck.',confidence:0.7,
 suggested_activity:{lesson:'Show one concrete example, using a simple visual model.',practice:'Try the concept with another familiar example.',duration_minutes:8,
 questions:['Show one real example.','Explain a similar example.','Apply in a new example.']},
 possible_root_causes:[{concept_id:pre,explanation:'May require earlier concept review.'}],teacher_review_status:'pending'};
Deno.test('accept only linked evidence and approved prerequisite concepts',()=>{
 const output=validOutput(draft,context,'root_cause');
 expect(output.teacher_review_status==='pending','review');
 expect(output.evidence_ids.length===2,'linked evidence');
 expect(output.confidence===0.7,'confidence');
 expect(output.possible_root_causes[0].confirmed===false,'unconfirmed cause');
});
Deno.test('single assessment remains Not Enough Evidence',()=>{
 const output=validOutput({...draft,evidence_ids:['E1','E2']},{...context,evidence:context.evidence.slice(0,2)},'diagnostic');
 expect(output.confidence===0&&output.evidence_state==='Not Enough Evidence','single-source confidence');
});
Deno.test('hallucinated concept and evidence references are rejected',()=>{
 for(const bad of [
 {...draft,concept_id:pre},
 {...draft,evidence_ids:['E999']},
 {...draft,possible_root_causes:[{concept_id:'00000000-0000-4000-8000-000000000999',explanation:'unknown'}]},
 {...draft,teacher_review_status:'approved'},
 {...draft,suggested_activity:{...draft.suggested_activity,duration_minutes:180}}
 ]){
 let denied=false;try{validOutput(bad,context,'recovery')}catch{denied=true;}
 expect(denied,'Invalid model output was accepted');
 }
});
