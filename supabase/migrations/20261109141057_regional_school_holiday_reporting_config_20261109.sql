alter table public.noor_report_settings
 add column if not exists region_code text not null default 'UNSET',
 add column if not exists include_official_holidays boolean not null default true;
alter table public.noor_report_settings drop constraint if exists report_region_code_allowed;
alter table public.noor_report_settings
 add constraint report_region_code_allowed check (region_code in ('UNSET','TS','OTHER'));
comment on column public.noor_report_settings.region_code is 'Official school state code. TS uses verified Telangana 2026 general holidays; others require principal-published calendar until supported.';
