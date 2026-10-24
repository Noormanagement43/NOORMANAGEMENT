# NOOR AI — Combined Preview

## Open the preview
1. Download `NOOR-AI-Combined-Preview.zip` or just the HTML preview.
2. Extract the ZIP if needed.
3. Open `index.html` with Chrome or Edge on Windows.
4. Use the role selector at the top to switch between Creator, Principal, Manager, Teacher and Student views.
5. In **Settings**, try the global theme presets and teacher edit-permission toggles.

## Included in this unified preview
- Public landing page styled to match the first NOOR AI page, with demo Log in / Create account flows and an Explore Preview button.
- Unified navigation and consistent first-page theme (burgundy/rose, warm ivory, champagne accents).
- Theme presets: Classic Rose, Lavender Bloom, Sage & Champagne, Midnight Plum & Gold, plus custom accent and typography options.
- Creator/Principal/Manager/Teacher/Student view switching.
- Editable classes, sections, academic years and subjects.
- Student add/edit workflow with roll-number uniqueness checks and configurable teacher permissions for roll number, class/section and subject changes.
- Roll-number attendance with present/absent/late/approved leave/unmarked counts and explicit Save action.
- Student progress report and print-to-PDF workflow.
- Syllabus file picker, reviewed syllabus-text editor and AI paper-generator sample flow.
- Editable questions, add/remove/rewrite, marks summary, draft saving and print-to-PDF.
- Basic task creation/editing and school identity settings.

## Important limitations
This is an **interactive browser preview**, not the live NOOR AI application. Sample data and demo edits are stored in your browser's local storage. No Supabase project, Auth, RLS, OCR or AI API is connected by this HTML file. The AI paper draft and answer-key content are illustrative only. PDF buttons use the browser print dialog; select **Save as PDF**.

Do not enter real student personal data into this preview. Before production, integrate these flows into the actual repository and shared database; enforce all role and school permissions server-side and with Supabase RLS; run the acceptance tests in `MASTER_PROMPT.md`.

## Teacher edits
The preview enables policy toggles for editing a student's roll number, class/section, subject assignments and adding students. In production, these decisions must be enforced by the authenticated server/database. Class transfers should be auditable and can require management approval. Student accounts must never be allowed to change their own official attendance or marks.

## Files
- `index.html` — standalone interactive preview.
- `MASTER_PROMPT.md` — unified development specification combining the first prompt, Task 2 and Task 3.