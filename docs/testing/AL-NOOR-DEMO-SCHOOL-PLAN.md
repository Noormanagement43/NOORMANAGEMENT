# Al Noor Demo School — Functional Acceptance Plan

**Purpose:** Safely prove the existing NOOR workflows work end-to-end before production use.
**Environment:** Development/staging only. Do not seed the production database.
**Institution display name:** Al Noor
**Suggested slug:** al-noor-demo
**Timezone:** Asia/Kolkata
**Country:** India
**Language:** English (Hindi, Telugu and Urdu remain configurable)

## Important safety rule
This document is a test plan, not a claim that demo records or accounts have already been created. Create the institution and records only after the selected Supabase environment is positively confirmed as non-production and its RLS policies are reviewed. Do not put real student personal information in the demo dataset.

## Demo roles and population
- 1 platform Creator: the product owner's existing authenticated account, granted platform role through a trusted, audited owner-only process. Do not make a shared master key or allow role self-assignment.
- 1 Principal.
- 5 staff/teachers.
- 5 classes (Class 1 through Class 5), with Sections A and B in each class.
- At least 5 synthetic students per class (minimum 25 students); target at least 50 total institution members by adding synthetic students to each section as needed.
- Every synthetic identity uses reserved example.invalid email addresses and clearly fake names; no real contact information or passwords are committed to the repository.
- Assign a homeroom teacher for each class and subject teachers for scheduled periods.

## Academic setup
- Academic year: 2026–2027.
- Groups: Class 1, Class 2, Class 3, Class 4, Class 5 (group_type = class), with Sections A and B (group_type = section) using the existing schema's supported representation.
- Assign each student to exactly one demo section; assign teachers to class/section and subjects.
- Schedule sample periods across the week with room labels and Asia/Kolkata time.
- Create synthetic attendance for selected sessions, including Present, Absent, Late and Leave, plus notes only where needed.
- Populate safe demo assignments/notices only if the existing schema and authorization rules support them.

## Required end-to-end checks
1. Creator can inspect the platform using their own authenticated account; Creator role remains separate from school membership.
2. Principal sees Al Noor overview, students, staff, class/section lists, and all authorized teacher periods.
3. Principal can create, rename, edit and deactivate classes/sections and assign/reassign a class teacher.
4. Teacher sees only their authorized teaching assignments and timetable periods.
5. Teacher can take attendance for an assigned class/section and save each of the four supported statuses.
6. Teacher can export authorized attendance to an Excel-compatible report. Verify headings, date, class, section, roll number, student, status, notes, and UTF-8 names.
7. Student sees only their own profile, timetable, attendance, and assigned learning content.
8. A user from another institution cannot read or modify Al Noor records; direct API/RLS checks must confirm this.
9. Unauthenticated users cannot access private school data.
10. Responsive/mobile layout and accessible labels, loading, empty, and error states are checked.

## Completion evidence
Record environment identity (never secrets), migration versions, test account creation outcome, row counts by entity, role-by-role screenshots, attendance export sample, and pass/fail results. Do not report a feature as working until it has been exercised against the running app and database.

## Current schema notes from initial read-only inspection
The connected Supabase project exposes RLS-enabled tables including institutions, institution_memberships, profiles, platform_roles, academic_years, academic_groups, academic_group_memberships, class_sessions, and attendance_records. Existing migrations include foundation, teacher timetable/attendance, editable class management, and foreign-key indexes. Table-level RLS being enabled is not proof that every policy is correct; review policy definitions before seeding or testing writes.
