# Live RLS verification — 11 November 2026

Project: ayrryemawwplguaauxij.

All 44 public tables had RLS enabled. Live catalog inspection and rollback-only tests found two authorization gaps: students could read peer academic-group membership records, and AI job ownership allowed reads without an active membership in that job's institution (including suspended membership or suspended school).

Applied migration 20261111110831 narrows roster reads to the active member's own record, assigned teaching staff, leadership or platform administration. A restrictive AI-job SELECT policy now requires active membership in the row's institution, or existing platform administration privileges.

## Validation

18 SQL role/claim simulation checks pass after the fix. They cover own and peer roster rows, assigned and unassigned teacher rosters, principal school access and foreign-school denial, own and peer assessment marks, own and peer quiz attempts, blocked peer profile updates, blocked self-assignment as teacher, blocked foreign-school job creation, private answer-key privileges, and AI-job reads after membership or institution suspension. The original test demonstrated four failing conditions across the two policy gaps before applying the fix.

All synthetic schools, memberships, marks, quiz attempts and job records were rolled back. A follow-up query confirmed zero rls-audit fixture schools. No real profile data or membership status was permanently changed.

These are database role/JWT-claim simulations, not browser sessions or a proof covering every RPC, Storage object or Edge Function. Existing intentionally broad within-school publishing permissions, controlled achiever sharing and automatic grading behavior were not changed. Auth password-protection and pg_net extension advisory warnings remain; private/internal tables with no client policies intentionally deny direct browser access.
