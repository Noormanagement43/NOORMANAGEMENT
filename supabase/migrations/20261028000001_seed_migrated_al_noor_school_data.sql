-- ============================================================================
-- NOOR SaaS: Seed Migrated 'Al noor' School, Classes & Sections
-- Destination: ayrryemawwplguaauxij
-- Source: legacy-migration-archive (Preserving exact IDs & Structures)
-- ============================================================================

-- 1. Insert or update the Al Noor School and Institution
INSERT INTO public.institutions (id, name, slug, code, institution_type, timezone, status)
VALUES (
  '18df9f46-61ba-4603-aca6-096f96f335b9',
  'Al noor',
  'al-noor',
  'SCH-ALNOOR-2026',
  'school',
  'Asia/Kolkata',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  timezone = EXCLUDED.timezone,
  status = EXCLUDED.status;

INSERT INTO public.schools (id, name, slug, school_code, institution_id, timezone, is_active, status)
VALUES (
  '18df9f46-61ba-4603-aca6-096f96f335b9',
  'Al noor',
  'al-noor',
  'SCH-ALNOOR-2026',
  '18df9f46-61ba-4603-aca6-096f96f335b9',
  'Asia/Kolkata',
  true,
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  timezone = EXCLUDED.timezone,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status;

INSERT INTO public.school_directory (id, name, is_active)
VALUES (
  '18df9f46-61ba-4603-aca6-096f96f335b9',
  'Al noor',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- 2. Insert Classes migrated from old project
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('c4749a56-44c4-4e61-9099-98cbdb1f139d', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 1', 1, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('b909744d-c282-4576-9a0b-c337bfde05a2', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 2', 2, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('071cb462-80df-4f3a-a556-b8a630310a6b', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 3', 3, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('d722173d-e66d-4316-bd2d-f8044c6ed825', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 4', 4, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('9d712cbe-b5d5-4b98-af14-592092a255a6', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 5', 5, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('0cf81c85-43b8-4ed3-906a-fb3cc595dd46', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 6', 6, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('5649c714-2034-4fba-8e5a-7fd6cd36ed93', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 7', 7, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('914711ee-227f-4d3d-a9f9-da0faf811df1', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 8', 8, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('f5e4525f-2eec-498c-88a2-f70eb414f733', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 9', 9, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('b9643ed7-2aef-4e11-8590-9c38b56b3445', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 10', 10, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('1b68d20f-650a-4d0a-a0d1-26ce653bf49b', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'MPC (Maths, Physics, Chemistry)', 11, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('18a8ddaf-a43b-4512-8a9c-dcb36b4caebd', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'BiPC (Biology, Physics, Chemistry)', 12, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('8ee6e6a2-30bf-4d92-a88f-274cfcf59289', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'MEC (Maths, Economics, Commerce)', 13, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('2fbe3883-279a-417e-b663-f6a616684c50', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'HEC (History, Economics, Civics)', 14, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('f1fcc4bd-cef8-496d-ab4d-8a4cca24e360', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'CEC (Commerce, Economics, Civics)', 15, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('4bed2c1e-4dc3-42d3-9fca-7f3a6b29762c', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Physics Lab', 16, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('ecd8805d-b72e-4f1a-b751-60c4ab359029', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Chemistry Lab', 17, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('1c52cb29-1ca1-4799-8515-515f104c8dc4', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Computer Science Lab', 18, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('3028496f-d633-4584-b506-5e9909bb0f75', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Biology Lab', 19, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- 3. Insert Sections migrated from old project
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('18dcc484-30a8-408d-aa8f-1e631357eed4', '071cb462-80df-4f3a-a556-b8a630310a6b', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('6b18abdd-fe3f-456a-8f57-002eb5c28e16', '071cb462-80df-4f3a-a556-b8a630310a6b', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('20bc2f7e-51a4-4a23-a4ef-877a4676cd48', '0cf81c85-43b8-4ed3-906a-fb3cc595dd46', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('cb76f943-5a7e-4ab8-9759-816e3e27c1a4', '0cf81c85-43b8-4ed3-906a-fb3cc595dd46', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('1e4689c4-8f5c-4c42-a78d-e230ba329d76', '5649c714-2034-4fba-8e5a-7fd6cd36ed93', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('49185179-46f7-4bb3-9779-ca93b34c56df', '5649c714-2034-4fba-8e5a-7fd6cd36ed93', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('356a66a2-1dbb-4333-9e92-3e05b79a43bd', '914711ee-227f-4d3d-a9f9-da0faf811df1', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('428647f2-843e-42dc-a873-1ed5cc0e8399', '914711ee-227f-4d3d-a9f9-da0faf811df1', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('80370018-3564-47a4-90c1-e3dea883bd47', '9d712cbe-b5d5-4b98-af14-592092a255a6', 'apple', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('eb541e7e-1475-4203-9742-cd19e6c8c1d9', '9d712cbe-b5d5-4b98-af14-592092a255a6', 'mango', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('3f3eddbd-7ecc-40d5-b82d-2074e8b27cdf', 'b909744d-c282-4576-9a0b-c337bfde05a2', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('7d17727e-223e-4bc1-a993-15511f46f8e4', 'b909744d-c282-4576-9a0b-c337bfde05a2', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('31afe18e-02a7-4d6e-b077-b3cfe6598f32', 'c4749a56-44c4-4e61-9099-98cbdb1f139d', 'dimond', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('1453d66b-d340-494b-a1c7-05722eb4a080', 'c4749a56-44c4-4e61-9099-98cbdb1f139d', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('28d0e1b7-994c-4436-9c72-ebf56b35202e', 'd722173d-e66d-4316-bd2d-f8044c6ed825', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('49e1947f-4f9f-4877-956e-dc47addcf0ad', 'd722173d-e66d-4316-bd2d-f8044c6ed825', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('69162d2e-6f26-48b6-a8f7-0755e4b459e5', 'f5e4525f-2eec-498c-88a2-f70eb414f733', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('6d48f71c-9c5d-4ebe-8810-5fc3d300b847', 'f5e4525f-2eec-498c-88a2-f70eb414f733', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
