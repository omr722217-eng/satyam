# 🎓 CampusIQ — Smart Campus Intelligence Platform

CampusIQ is a modern, full-stack campus management and intelligence platform connected to **Supabase PostgreSQL** and integrated with **Google Gemini AI**.

It brings together real-time course tracking, interactive assignments, live attendance logging, campus event RSVPs, study space reservations, and an AI-driven academic co-pilot.

---

## 🚀 Live Demo & Repository

* **GitHub Repository:** [https://github.com/omr722217-eng/satyam](https://github.com/omr722217-eng/satyam)
* **Database Host:** Supabase PostgreSQL (`db.pworthvdkipwqennqfto.supabase.co:5432`)
* **Default Port:** `3000` (Local) / `10000` (Render)

---

## 🌐 Deploying to Render (Step-by-Step)

Follow these exact steps to deploy CampusIQ on **Render** (free tier supported):

### 1. Create a New Web Service on Render
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository**.
4. Connect and choose your GitHub repository: `https://github.com/omr722217-eng/satyam`.

### 2. Configure Service Settings

| Setting | Value to Enter |
|---|---|
| **Name** | `campusiq` (or any preferred name) |
| **Region** | `Oregon (US West)` or `Frankfurt` (closest to your DB) |
| **Branch** | `main` |
| **Root Directory** | *(leave blank)* |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

---

## 🔐 Environment Variables for Render

In the Render Web Service setup, expand the **Environment Variables** section and add the following keys and values:

| Key Name | Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:XhBQsukJTXMFX4uT@db.pworthvdkipwqennqfto.supabase.co:5432/postgres` | Your live Supabase PostgreSQL connection string |
| `GEMINI_API_KEY` | *(Paste your Google Gemini API Key here)* | Your Google AI Studio API Key for live AI briefings |
| `NODE_ENV` | `production` | Production environment flag |
| `PORT` | `10000` | Render standard port (handled automatically if omitted) |

> 💡 **Where to get your `GEMINI_API_KEY`:**
> 1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
> 2. Click **Create API Key**.
> 3. Copy the key and paste it as the value for `GEMINI_API_KEY` in Render.

---

## 🔑 Login Credentials

The live database has been initialized with the following verified test accounts:

| Role | Email | Password | Full Name & ID |
|---|---|---|---|
| **Student** | `student@campusiq.edu` | `CampusIQ@2026` | Aarav Sharma (`CIQ-2026-401`) |
| **Faculty / Admin** | `admin@campusiq.edu` | `AdminIQ@2026` | Dr. Rajiv Menon (`ADM-2026-001`) |

* **⚡ Instant Login:** Click the **⚡ Instant Student Login (Demo)** button in the sign-in modal for 1-click access.
* **New Registrations:** You can also click **Create account** to register any new student account. Passwords are encrypted with PBKDF2 and salted before saving to Supabase.

---

## 📦 How to Push Code to Your GitHub Repository

If you want to sync changes from your local folder to your GitHub repo (`https://github.com/omr722217-eng/satyam`), run these commands in your terminal:

```bash
# 1. Check status
git status

# 2. Stage all updated files
git add .

# 3. Commit changes
git commit -m "feat: complete UI polish, Supabase PostgreSQL backend, and Render deployment config"

# 4. Push to main branch
git branch -M main
git push -u origin main
```

*(If prompted for credentials, use your GitHub username and a [Personal Access Token (classic)](https://github.com/settings/tokens) with `repo` permissions).*

---

## 🏗️ Architecture & Database Schema

```mermaid
graph TD
    User["Student / Faculty Browser"] -->|HTTP / REST| App["Node.js + Express Server (server.js)"]
    App -->|pg Connection Pool| Postgres[("Supabase PostgreSQL Database")]
    App -->|generateContent| Gemini["Google Gemini 1.5 Flash API"]
    
    subgraph "PostgreSQL Tables"
        Users["public.users (Auth & Profiles)"]
        Courses["public.courses (Academics)"]
        Enrollments["public.enrollments (Live Attendance)"]
        Assignments["public.assignments (Coursework)"]
        StudyPlans["public.study_plans (Planner)"]
        Events["public.events & registrations"]
        Facilities["public.facilities & bookings"]
        Insights["public.ai_insights (AI Co-pilot)"]
        Notifications["public.notifications (Alerts)"]
    end
    
    Postgres --- Users
    Postgres --- Courses
    Postgres --- Enrollments
    Postgres --- Assignments
    Postgres --- StudyPlans
    Postgres --- Events
    Postgres --- Facilities
    Postgres --- Insights
    Postgres --- Notifications
```

---

## 💻 Local Development

To run the application locally on your computer:

```bash
# 1. Install dependencies
npm install

# 2. Start the local server
npm start
```

Visit **http://localhost:3000** in your web browser.

To re-seed or reset sample tables in the database at any time:
```bash
npm run init-db
```
