# NOOR — Intelligent SaaS Operating System for Schools & Colleges

[![Static Quality Checks](https://github.com/Noormanagement43/NOORMANAGEMENT/actions/workflows/quality.yml/badge.svg)](https://github.com/Noormanagement43/NOORMANAGEMENT/actions/workflows/quality.yml)
[![GitHub Pages](https://img.shields.io/badge/deployment-GitHub%20Pages-wine?logo=github)](https://noormanagement43.github.io/NOORMANAGEMENT/)

**NOOR** is a modern, high-performance SaaS operating system built for schools, colleges, and educational institutions. It unifies institutional leadership, faculty coordination, student learning, and parent communication into a cohesive, secure workspace.

Hosted live on GitHub Pages with Supabase providing PostgreSQL data storage, Row-Level Security (RLS), real-time subscriptions, and authenticated Edge Functions.

---

## Highlights & Workspaces

### 1. Multi-Portal Authentication System
- **Role-Aware Portals:** Dedicated sign-in gates for **Students**, **Teachers**, **School Management** (Principal, School Admin, Manager), and **Platform Creators**.
- **Student Registration:** Self-service registration with school joining codes, roll numbers, class/section assignments, and profile photo upload.
- **School Creation (Onboarding):** One-step institutional setup for School Owners and Principals with auto-generated student and faculty joining codes.
- **Staff Joining:** Direct staff enrollment using institution-issued Staff Joining Codes without external invitation bottlenecks.
- **Auth Recovery:** In-app password recovery and verification email re-dispatch.

### 2. School Leadership & Principal Studio
- **Real-Time Overview:** Active student counts, faculty statistics, live attendance metrics, and class performance tracking.
- **Member Access & Approvals:** Granular member management, reversible pause/reactivate actions, and approval workflows.
- **Command Centre:** Draggable institutional widgets, tasks, calendar agendas, automated notifications, and audit logging.

### 3. Teacher Command Centre & Classrooms
- **Timetable & Attendance:** Integrated weekly schedules, period planning, and thumb-friendly daily attendance marking with offline recovery support.
- **Exam & Paper Generator:** Question paper authoring with customizable rubrics, exam contexts, and difficulty levels.
- **Academic Monitoring:** Syllabus tracking, weekly learning plans, daily class logs, and teacher-reviewed Smart Notes.

### 4. Student & Parent Portals
- **Student Workspace:** Personal timetable, attendance rate tracking, subject notes, assignments, announcements, and school notices.
- **Academic Support:** Classroom alerts, teacher follow-ups, and calendar timelines.

### 5. Appearance Studio & Central Sound Engine
- **8 Bespoke Themes:** Rose Gold, Pearl Ivory, Ocean Blue, Sage Garden, Lavender Mist, Teal Glass, Sandstone, and Midnight Luxe.
- **Sound Engine:** Central sound manager with 40+ mapped UI sounds, volume/mute toggles, and user preference persistence.

---

## Repository Structure

```text
├── index.html                   # Primary unified application entry & login portal
├── auth.html                    # Dedicated authentication gateway
├── principal.html               # Dedicated principal dashboard view
├── config.js                    # Public browser configuration (Supabase URL & anon key)
├── noor-official-logo.svg       # Official NOOR vector brandmark
├── .nojekyll                    # GitHub Pages asset routing guard
│
├── academic.js                  # Core academic data, groups, syllabus & notes
├── academic-extras.js           # Extended academic routines
├── command-centre.js            # School Command Centre widgets, tasks & calendar
├── noor-member-access.js        # Member pause/reactivate RPC & profile controls
├── noor-class-assignments.js    # Assignment tracking & submissions
├── noor-offline-attendance.js   # Local offline attendance sync engine
├── noor-parent-support.js       # Parent follow-ups & student support
├── noor-school-calendar.js      # Institutional calendar & academic events
├── noor-teacher-intelligence.js # Teacher insights & automated alerts
├── noor-teacher-planners.js     # Weekly syllabus & curriculum planners
├── noor-teacher-setup.js        # Class & subject configuration
├── principal-live.js            # Real-time principal metrics & data feeds
├── principal-studio.js          # Principal workspace management suite
├── principal-teacher-approvals.js# Teacher plan approval pipeline
├── student-portal.js            # Authenticated student dashboard
├── teacher-attendance.js        # Teacher daily period attendance engine
├── teacher-classroom.js         # Classroom coordination module
├── teacher-dashboard-v3.js      # Reference-style faculty dashboard
├── teacher-paper-generator.js   # AI-assisted question paper generator
├── teacher-reference.js         # Unified teacher dashboard & timetable
├── theme-system.js              # Appearance Studio theme manager
│
├── sounds/                      # Audio assets and central sound manager
│   ├── sound-manager.js
│   ├── sound-settings.js
│   └── sound-assets-*.js
│
├── preview/                     # Smoke previews for individual dashboards
│   ├── student-dashboard-preview.html
│   ├── teacher-dashboard-preview.html
│   ├── principal-dashboard-preview.html
│   └── parent-support-preview.html
│
├── scripts/                     # Automated browser smoke tests (Playwright)
│   ├── app-shell-smoke.mjs
│   ├── noor-reliability-smoke.mjs
│   └── principal-studio-smoke.mjs
│
├── supabase/                    # Backend PostgreSQL schema & Edge Functions
│   ├── migrations/              # Incremental SQL migrations & RLS policies
│   ├── functions/               # Deno/TypeScript Edge Functions
│   └── tests/                   # Security & tenant-isolation test suites
│
└── tests/                       # Static regression and security test suites
    └── static-audit.test.mjs
```

---

## Quality Assurance & Automated Testing

Run the full static regression test suite:

```bash
node --test tests/*.test.mjs
```

Validate JavaScript syntax across all root and sound modules:

```bash
node --check *.js
node --check sounds/*.js
node --check scripts/*.mjs
```

---

## Local Development & Preview

Serve the static web application locally without complex build dependencies:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx serve .
```

Open `http://localhost:8000/index.html` in your browser.

---

## Security Architecture

1. **Publishable Keys Only:** The browser configuration (`config.js`) only contains the public Supabase URL and publishable anon key.
2. **Server-Side Secrets:** Service-role keys, database passwords, and third-party API credentials reside strictly in Supabase Edge Function environment secrets.
3. **Row-Level Security (RLS):** All public tables have RLS enabled with school-isolated policies to ensure zero cross-tenant data leakage.
4. **Security Definer RPCs:** Institution setup RPCs execute with strict search paths, `auth.uid()` checks, and revoked public/anonymous execution grants.

---

## License

All rights reserved © 2026 NOOR Management Platform.
