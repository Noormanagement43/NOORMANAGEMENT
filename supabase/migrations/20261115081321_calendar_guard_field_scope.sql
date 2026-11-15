-- Only reference learning-item columns inside the matching trigger branch.
-- Calendar events share this guard but have no attachment_path column.
do $$ declare def text; begin
 select pg_get_functiondef('private.noor_guard_academic_row()'::regprocedure) into def;
 if position('if tg_table_name=''noor_learning_items'' and new.attachment_path' in def)=0 then raise exception 'Expected attachment guard not found';end if;
 def:=replace(def,
 'if tg_table_name=''noor_learning_items'' and new.attachment_path is not null and(split_part(new.attachment_path,''/'',1)<>new.created_by::text or new.attachment_path like ''%..%'') then raise exception ''Attachment must belong to the author'' using errcode=''23514'';end if;',
 'if tg_table_name=''noor_learning_items'' then if new.attachment_path is not null and(split_part(new.attachment_path,''/'',1)<>new.created_by::text or new.attachment_path like ''%..%'') then raise exception ''Attachment must belong to the author'' using errcode=''23514'';end if;end if;');
 execute def;
end $$;
