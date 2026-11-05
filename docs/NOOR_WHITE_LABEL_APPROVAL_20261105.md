# Tenant classes, sections and white-label branding — proposed activation

## Prepared implementation

- After a school's joining code is verified and the student has an active membership, list only that institution's active academic_groups with group_type=class.
- The section picker lists only active sections whose institution_id matches that school AND parent_group_id matches the selected class. Preserve school-defined names such as Mango and Apple; never fabricate A/B sections. Changing class clears the previous section.
- No anonymous directory or public access to academic groups. Student enrollment uses a server-validated, current-user-only RPC; initial selection cannot transfer an existing student to another class.
- School name continues to come from institutions.name. Shared school logo uses an institution-scoped branding record and a new private storage bucket, read by active members and written by authorized leadership only. Signed URLs are renewed; no device-only per-account logo storage.
- Clearing/switching school clears old logo state to prevent another tenant's logo appearing. All roles use the same school branding loader.

## Exact database changes needing owner approval

Review: supabase/new-project/proposed_tenant_branding_enrolment.sql

1. Add institution_branding table (institution_id primary key, own-tenant logo_path, updated_at) with RLS. Members read their own school; authorized leadership writes.
2. Add private noor-school-logos bucket, 3 MB JPG/PNG/WebP, tenant-scoped read and leadership-only insert policies. Logo replacement creates a new object, with no extra overwrite/delete permissions.
3. Add noor_select_student_section RPC backed by an authenticated private function. It validates active student membership, active same-school class and its section, rate limits and locks the membership, and records the initial assignment/audit event. Existing class transfers remain a leadership action.

No live schema, data, policies, bucket or membership has been modified. Existing school/account records are preserved. Frontend changes must not be merged/deployed until this migration has been approved, reviewed against the latest live schema and applied successfully.

## Verification limits

Unit tests use synthetic Al Iqra Class 1 Mango/Apple rows, other-school and other-class sections, inactive sections, account switching and validated RPC arguments. The existing branding tests cover account/tenant isolation and saved object paths. These tests do not prove live enrollment, signed-logo access, browser role dashboards or SQL execution. After activation, test with an approved school and two separate tenants; do not manufacture production records without authorization.
