# Stable joining and teacher-owned timetable

User-requested behavior update: joining codes no longer expire automatically, and each teacher can choose/edit their own recurring start/end times. Principal slot settings are optional defaults and do not overwrite teacher times. Existing code hashes and existing period times are preserved.

## Joining

Student and staff codes were already persisted and valid; the UI cleared input fields after save and imposed a 30-day policy. Code save is now idempotent, blank fields preserve existing values, confirmed status reads Saved / No automatic expiry, and repeat save is disabled until edited. Values remain masked, with no plaintext retrieval of stored hashes. The existing temporary signup draft holds the user-entered joining code only until membership is verified; no provider secrets are stored in frontend code. Rotation deliberately invalidates the replaced code.

## Signup placement

Both signup forms ask for class/stream and section. School-specific options come from a bounded, public-label-only discovery RPC; this exposes no people, rosters or joining codes and grants no membership. Changing the school clears stale selections. Joining still requires the correct role-specific code, signed-in identity and active institution. Chosen IDs are saved after verified membership through authenticated section RPCs. A teacher's initial choice grants section-only academic access; existing class assignments cannot be self-transferred. Verified school joins remain audit notifications for leadership.

## Timetable

Teacher My Timetable navigation bypasses the old management-only schedule page. Teachers can create/edit only their own recurring weekday, period, class/section, subject and times. Duplicate period numbers and overlapping own times are rejected server-side. Daily chapter/lesson and topic remain separate dated rows. Principal, student and explicitly linked parent reads retain RLS; parent access is limited to linked children's groups. Realtime events refresh weekly timetable, daily lessons, principal overview, student schedule and open Staff periods.

## Validation

172 Node tests pass. Live rollback tests cover code persistence, idempotence, rotation, role/group mismatch protections, anonymous class-name-only access, teacher section placement, editable times, overlap rejection, student and parent read scopes, daily topics and unchanged teacher times after principal default changes. Zero synthetic test users remain. Security advisors show only the pre-existing disabled leaked-password protection warning.

Signed-in real-account browser and email inbox delivery remain unverified. Historical SQL fixtures expecting principal-forced times describe the old behavior; use stable_join_teacher_live_rollback.sql for the current ownership contract.
