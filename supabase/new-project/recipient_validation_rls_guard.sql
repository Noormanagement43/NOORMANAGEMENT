-- Validate enrollment inside the trigger without the teacher's roster-read policy hiding valid students.
-- The learning row's existing write RLS still checks the authenticated teacher's group permission.
ALTER FUNCTION private.noor_validate_learning_recipient() SECURITY DEFINER;
REVOKE ALL ON FUNCTION private.noor_validate_learning_recipient() FROM PUBLIC,anon,authenticated;
