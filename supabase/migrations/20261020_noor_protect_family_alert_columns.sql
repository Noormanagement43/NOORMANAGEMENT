-- Browser accounts can change alert review status, not fabricated scores or identities.
REVOKE UPDATE ON public.noor_academic_support_alerts FROM authenticated;
GRANT UPDATE(status) ON public.noor_academic_support_alerts TO authenticated;
-- School follow-ups cannot be reassigned to a different child or author via API.
REVOKE UPDATE ON public.noor_parent_contact_logs FROM authenticated;
GRANT UPDATE(subject,message,contact_method,status,contacted_at,follow_up_due,updated_at) ON public.noor_parent_contact_logs TO authenticated;
