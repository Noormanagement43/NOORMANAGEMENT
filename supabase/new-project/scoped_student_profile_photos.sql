-- Resolve private avatars for leadership, assigned class teachers and verified guardians.
CREATE FUNCTION private.noor_can_view_profile_photo(p_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT auth.uid() IS NOT NULL AND (
 split_part(p_path,'/',1)=auth.uid()::text OR EXISTS(
 SELECT 1 FROM public.institution_memberships subject JOIN public.institutions i ON i.id=subject.institution_id
 JOIN public.institution_memberships viewer ON viewer.institution_id=subject.institution_id
 WHERE subject.user_id::text=split_part(p_path,'/',1) AND subject.status='active' AND viewer.user_id=auth.uid() AND viewer.status='active' AND i.status='active' AND (
 viewer.role IN('principal','school_admin','university_admin','academic_admin') OR
 (viewer.role IN('teacher','faculty') AND subject.role IN('student','university_student') AND EXISTS(
 SELECT 1 FROM public.academic_group_memberships tm JOIN public.academic_group_memberships sm ON sm.institution_id=tm.institution_id JOIN public.academic_groups sg ON sg.id=sm.group_id AND sg.institution_id=sm.institution_id
 WHERE tm.membership_id=viewer.id AND sm.membership_id=subject.id AND tm.institution_id=i.id AND tm.status='active' AND sm.status='active' AND tm.group_role IN('teacher','faculty') AND sm.group_role='student' AND sg.is_active AND (tm.group_id=sm.group_id OR tm.group_id=sg.parent_group_id))) OR
 (viewer.role='parent' AND EXISTS(SELECT 1 FROM public.noor_guardian_links gl WHERE gl.institution_id=i.id AND gl.guardian_membership_id=viewer.id AND gl.student_membership_id=subject.id))
 ))
);
$$;
REVOKE ALL ON FUNCTION private.noor_can_view_profile_photo(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_can_view_profile_photo(text) TO authenticated;
ALTER POLICY noor_v2_photo_view_own_or_leadership ON storage.objects USING(bucket_id='noor-profile-photos' AND private.noor_can_view_profile_photo(storage.objects.name));
