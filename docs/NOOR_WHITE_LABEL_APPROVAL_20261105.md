# Tenant branding, structure and teacher timetable — 2026-11-05

Owner approved database activation and the expanded school/college structure and period workflow in this conversation.

## Implemented

- Active classes/years/streams and their own child sections, with custom names. School leadership can create Class 1–10 on demand, add further classes/streams, rename and archive/reactivate. College/university registration preserves its selected institution type; BiPC/HEC/MPC are examples, not fixed categories.
- School-verified students select from their institution's own active classes and matching sections. Changing class clears the old section. Group reads paginate beyond the default PostgREST page size. The enrollment RPC validates own active student membership and blocks cross-school groups and self-transfer of existing assignments.
- Institution name and private shared school logos for all active members. Leadership alone can save logos/names. Account/tenant switches clear stale logo state. Existing data and accounts preserved.
- Principal/authorized school leadership sets period timings once. Backend rejects overlapping slots and derives teacher period times from these slots, including direct API writes. Timing changes propagate to linked active weekly periods.
- Teachers add/edit/remove only their own recurring weekday/class/section/subject/room periods. Daily lesson/topic/completed notes are separate date-specific rows; saving a daily note does not rewrite the recurring schedule. Principal/student reads retain existing class/section RLS.

## Applied database migrations

- tenant_branding_and_student_section_selection
- principal_period_slots_and_teacher_daily_lessons
- period_slot_propagation_index

SQL snapshots are in supabase/new-project; migration history is stored by Supabase. No old schema, policies, user accounts or school records were deleted or replaced. No automatic production class/section seed was inserted.

## Verification

- 122 Node regression tests passed before release, including account isolation, role ownership, school-specific Mango/Apple choices, school versus college type, custom stream names, pagination, principal slot control and separate daily notes.
- Supabase applied/compiled both feature migrations successfully.
- Live database rollback test: leadership slot creation, overlapping slot rejection, teacher time normalization, teacher denial of slot writes, class enrollment, section-specific timetable visibility, daily lesson visibility, other-school group exclusion, own-school branding reads, student branding write denial, cross-school section rejection, self-transfer denial and timing propagation all passed.
- All synthetic Auth, school, membership, class, period and note rows were rolled back; remaining test Auth users = 0.
- Security advisor reported no new findings; existing leaked-password-protection warning remains.

## Remaining limits

Real school user walkthrough, actual logo upload/signed-image rendering and phone/laptop visual verification are not established by database/mocked tests. SMTP/inbox delivery is a separate outstanding account setting. Broader legacy academic adapters are outside this feature.
