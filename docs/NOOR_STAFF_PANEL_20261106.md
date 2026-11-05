# Principal Staff panel

A separate Staff sidebar page uses the current authenticated institution membership, profiles, recurring teacher timetable, academic groups, dated staff check-ins and daily lesson records. All reads preserve existing RLS; no schema changes or sample production records.

Every staff row offers All Periods. The read-only side drawer shows saved weekday, period number, class, section and subject, with a day filter. It intentionally does not show clock times or ratings. Existing Staff & Access still manages suspension, reactivation, class access, recorded attendance and parent links.

Attendance is present plus late divided by actual recorded present/late/absent/leave days within the selected dates, excluding missing days. Summary is weighted by recorded days for active staff. Missing attendance is blank. Archived classes and their sections do not appear in active periods.

There is no canonical planned-syllabus source in the current project. Show Syllabus not set, and separately count completed vs logged lesson entries; never present diary completion as syllabus percentage. No true syllabus percentage until a planned topic source is implemented.

Verified: 166 Node tests; isolated SQL rollback test for leadership reads and school isolation; production contains no staff memberships, timetable periods, staff check-ins or daily lesson entries at audit time. Signed-in browser walkthrough remains unverified.
