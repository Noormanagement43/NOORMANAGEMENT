-- Additional grouping for school class sections in the NEW institution-oriented NOOR.
ALTER TABLE public.academic_groups
 ADD COLUMN IF NOT EXISTS parent_group_id uuid NULL;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='noor_academic_group_parent_same_institution') THEN
  ALTER TABLE public.academic_groups ADD CONSTRAINT noor_academic_group_parent_same_institution
   FOREIGN KEY(parent_group_id,institution_id)
   REFERENCES public.academic_groups(id,institution_id) ON DELETE RESTRICT;
 END IF;
END
$$;
CREATE INDEX IF NOT EXISTS noor_academic_groups_parent_lookup
 ON public.academic_groups(institution_id,parent_group_id);
CREATE OR REPLACE FUNCTION private.noor_v2_validate_group_parent()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
 IF NEW.parent_group_id IS NOT NULL THEN
  IF NEW.parent_group_id=NEW.id OR NEW.group_type<>'section'
   OR NOT EXISTS(SELECT 1 FROM public.academic_groups parent WHERE parent.id=NEW.parent_group_id
       AND parent.institution_id=NEW.institution_id AND parent.group_type='class') THEN
   RAISE EXCEPTION 'Sections must refer to a parent class in the same institution' USING errcode='23514';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS noor_v2_group_validate_parent ON public.academic_groups;
CREATE TRIGGER noor_v2_group_validate_parent
BEFORE INSERT OR UPDATE OF parent_group_id,institution_id,group_type ON public.academic_groups
FOR EACH ROW EXECUTE FUNCTION private.noor_v2_validate_group_parent();