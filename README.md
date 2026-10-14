# CampusIQ — Smart Campus Platform (Full-Stack Supabase Edition)

CampusIQ is fully connected to **Supabase PostgreSQL** (`db.pworthvdkipwqennqfto.supabase.co`). All authentication, course tracking, attendance logging, assignments, event registrations, facility bookings, notifications, and AI daily briefs are persisted in the live database.

---

## ⚡ Quick Start

### 1. Start the Server
Open a terminal in this directory and run:
```bash
npm start
```
The application will be live at: **http://localhost:3000**

*(To re-seed or reset sample database tables at any time, run `npm run init-db`)*

---

## 🔑 Login Credentials

| Role | Email | Password | Student / Staff ID |
|---|---|---|---|
| **Student** | `student@campusiq.edu` | `CampusIQ@2026` | `CIQ-2026-401` |
| **Admin / Faculty** | `admin@campusiq.edu` | `AdminIQ@2026` | `ADM-2026-001` |

> You can also click **⚡ Instant Student Login (Demo)** in the sign-in modal to log in with one click, or use the **Create account** button to sign up with a new email and password.

---

## 🛠️ Connected Features & Supabase PostgreSQL Tables

1. **Authentication & Authorization**:
   - Managed via table `public.users` with PBKDF2 cryptographic hashing and salted passwords.
   - Session tokens with 7-day persistence stored in client `localStorage`.
   - Supports Sign In, Sign Up, and Role-based metadata (`student`, `faculty`, `admin`).

2. **Academics & Coursework**:
   - Table `public.courses`: Data Structures, Web Development Lab, Database Management Systems, AI Project Studio.
   - **Assignments** (Shortcuts button): Table `public.assignments`. View due dates, toggle completion status, and record scores.
   - **Study Planner** (Shortcuts button): Table `public.study_plans`. Add target focus sessions and check off completed study blocks.
   - **Course Resources** (Shortcuts button): Table `public.course_resources`. Lecture notes, code kits, and slides.

3. **Live Attendance**:
   - Table `public.enrollments`: Tracks classes held, attended, and real percentage.
   - Interactive **`+ Present`** and **`+ Absent`** buttons directly log attendance to PostgreSQL and immediately recalculate overall rates in real time.

4. **Campus Events**:
   - Tables `public.events` and `public.event_registrations`.
   - Clicking **Register interest ↗** or **I'm interested ↗** creates a verified registration in the database and updates attendee counters.

5. **Facilities & Seat Booking**:
   - Tables `public.facilities` and `public.facility_bookings`.
   - Live seat availability for Central Library, Innovation Hub, Student Commons, and Reflection Garden.
   - Booking dialog reserves desks with time slot selection and assigned seat numbers.

6. **AI Insights & Campus Co-pilot**:
   - Table `public.ai_insights`.
   - Clicking **Generate my daily brief ✦** analyzes current attendance rates, upcoming assignments, and facility capacity to produce a personalized study nudge.

7. **Notification Center**:
   - Table `public.notifications`.
   - Live badge counter on the top navigation bar with interactive drawer and "Mark all as read" capability.
