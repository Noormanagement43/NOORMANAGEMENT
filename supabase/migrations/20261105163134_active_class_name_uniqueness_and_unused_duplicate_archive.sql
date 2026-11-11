-- Reversible duplicate repair and race-safe per-school active-name uniqueness.
CREATE FUNCTION private.noor_academic_name_key(p_name text,p_type text,p_path text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_type='class' AND p_path='school' AND compact ~ '^(class|grade)?[0-9]+(st|nd|rd|th)?$'
 THEN 'class:'||coalesce(nullif(regexp_replace(regexp_replace(regexp_replace(compact,'^(class|grade)',''),'(st|nd|rd|th)$',''),'^0+',''),''),'0') ELSE compact END
 FROM (SELECT regexp_replace(lower(trim(p_name)),'[[:space:]]+','','g') compact) x;
$$;
REVOKE ALL ON FUNCTION private.noor_academic_name_key(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_academic_name_key(text,text,text) TO authenticated;
-- Only redundant, unused classes with no children or academic references are archived.
WITH candidates AS (
 SELECT g.*,(
 EXISTS(SELECT 1 FROM public.academic_groups s WHERE s.parent_group_id=g.id) OR
 EXISTS(SELECT 1 FROM public.academic_group_memberships m WHERE m.group_id=g.id) OR
 EXISTS(SELECT 1 FROM public.teacher_timetable_periods t WHERE t.academic_group_id=g.id) OR
 EXISTS(SELECT 1 FROM public.class_sessions s WHERE s.academic_group_id=g.id) OR
 EXISTS(SELECT 1 FROM public.noor_assessment_results r WHERE r.academic_group_id=g.id) OR
 EXISTS(SELECT 1 FROM public.noor_learning_items l WHERE l.academic_group_id=g.id) OR
 EXISTS(SELECT 1 FROM public.noor_calendar_events e WHERE e.academic_group_id=g.id)
 ) used FROM public.academic_groups g WHERE g.is_active AND g.group_type='class'
), ranked AS (
 SELECT id,used,row_number() OVER(PARTITION BY institution_id,education_path,private.noor_academic_name_key(name,group_type,education_path) ORDER BY used DESC,created_at,id) n FROM candidates
)
UPDATE public.academic_groups g SET is_active=false WHERE g.id IN(SELECT id FROM ranked WHERE n>1 AND NOT used);
CREATE UNIQUE INDEX noor_active_group_name_unique ON public.academic_groups(institution_id,education_path,group_type,coalesce(parent_group_id,'00000000-0000-0000-0000-000000000000'::uuid),private.noor_academic_name_key(name,group_type,education_path)) WHERE is_active AND group_type IN('class','section');
