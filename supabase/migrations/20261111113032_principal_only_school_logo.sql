-- Shared logo can be read by school members, but changed only by that school's principal.
ALTER POLICY branding_leadership_insert ON public.institution_branding
 WITH CHECK (private.has_institution_role(institution_id,ARRAY['principal','university_admin']::text[]));
ALTER POLICY branding_leadership_update ON public.institution_branding
 USING (private.has_institution_role(institution_id,ARRAY['principal','university_admin']::text[]))
 WITH CHECK (private.has_institution_role(institution_id,ARRAY['principal','university_admin']::text[]));
ALTER POLICY noor_school_logo_leadership_insert ON storage.objects
 WITH CHECK (bucket_id='noor-school-logos' AND private.has_institution_role(private.noor_logo_tenant(name),ARRAY['principal','university_admin']::text[]));
