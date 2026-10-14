const { Client } = require('pg');
const crypto = require('crypto');

const connectionString = 'postgresql://postgres:XhBQsukJTXMFX4uT@db.pworthvdkipwqennqfto.supabase.co:5432/postgres';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

async function initDB() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    // 1. Create Tables
    const schemaSQL = `
      -- Users table
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        full_name TEXT NOT NULL,
        student_id TEXT UNIQUE,
        role TEXT DEFAULT 'student' CHECK (role IN ('student', 'faculty', 'admin')),
        department TEXT DEFAULT 'Computer Science & Engineering',
        semester INT DEFAULT 4,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Courses table
      CREATE TABLE IF NOT EXISTS public.courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        instructor TEXT NOT NULL,
        room TEXT NOT NULL,
        schedule_time TEXT NOT NULL,
        credits INT NOT NULL DEFAULT 4,
        type TEXT NOT NULL DEFAULT 'CORE',
        color TEXT NOT NULL DEFAULT 'blue',
        progress INT DEFAULT 75,
        search_terms TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Enrollments / Attendance table
      CREATE TABLE IF NOT EXISTS public.enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
        classes_held INT DEFAULT 20,
        classes_attended INT DEFAULT 18,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, course_id)
      );

      -- Today schedule items
      CREATE TABLE IF NOT EXISTS public.today_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
        time_display TEXT NOT NULL,
        ampm TEXT NOT NULL,
        type_label TEXT NOT NULL,
        dot_color TEXT NOT NULL,
        class_class TEXT NOT NULL,
        time_range TEXT NOT NULL,
        order_index INT DEFAULT 1
      );

      -- Assignments table
      CREATE TABLE IF NOT EXISTS public.assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        due_date TIMESTAMPTZ NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'graded')),
        score INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Study Plans table
      CREATE TABLE IF NOT EXISTS public.study_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        duration_mins INT DEFAULT 25,
        target_date DATE DEFAULT CURRENT_DATE,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Course Resources table
      CREATE TABLE IF NOT EXISTS public.course_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Campus Events table
      CREATE TABLE IF NOT EXISTS public.events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        date_str TEXT NOT NULL,
        time_str TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT NOT NULL,
        is_featured BOOLEAN DEFAULT FALSE,
        poster_class TEXT DEFAULT 'hack',
        badge TEXT DEFAULT 'BUILD BEYOND',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Event Registrations table
      CREATE TABLE IF NOT EXISTS public.event_registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        registered_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(event_id, user_id)
      );

      -- Facilities table
      CREATE TABLE IF NOT EXISTS public.facilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        location TEXT NOT NULL,
        hours TEXT NOT NULL,
        description TEXT NOT NULL,
        total_capacity INT NOT NULL,
        occupied_capacity INT NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'Open',
        art_class TEXT DEFAULT 'lib',
        tag TEXT DEFAULT 'FOCUS ZONE',
        search_terms TEXT
      );

      -- Facility Bookings table
      CREATE TABLE IF NOT EXISTS public.facility_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        facility_id UUID REFERENCES public.facilities(id) ON DELETE CASCADE,
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
        slot_time TEXT NOT NULL,
        seat_number TEXT,
        status TEXT DEFAULT 'Confirmed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Notifications table
      CREATE TABLE IF NOT EXISTS public.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- AI Insights table
      CREATE TABLE IF NOT EXISTS public.ai_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        badge TEXT DEFAULT 'JUST GENERATED · CAMPUSIQ AI',
        color TEXT DEFAULT 'lavender',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await client.query(schemaSQL);
    console.log('Tables created successfully.');

    // 2. Seed Default Users
    // Student
    const studentPass = hashPassword('CampusIQ@2026');
    const studentRes = await client.query(`
      INSERT INTO public.users (email, password_hash, salt, full_name, student_id, role, department, semester)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, salt = $3, full_name = $4
      RETURNING id, email, full_name, role;
    `, ['student@campusiq.edu', studentPass.hash, studentPass.salt, 'Aarav Sharma', 'CIQ-2026-401', 'student', 'Computer Science & Engineering', 4]);
    const studentUser = studentRes.rows[0];

    // Admin
    const adminPass = hashPassword('AdminIQ@2026');
    await client.query(`
      INSERT INTO public.users (email, password_hash, salt, full_name, student_id, role, department)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, salt = $3, full_name = $4
      RETURNING id, email, full_name, role;
    `, ['admin@campusiq.edu', adminPass.hash, adminPass.salt, 'Dr. Rajiv Menon', 'ADM-2026-001', 'admin', 'Academic Administration']);

    console.log('Default users seeded: student@campusiq.edu and admin@campusiq.edu');

    // 3. Seed Courses
    const courses = [
      {
        code: 'CS201',
        title: 'Data Structures & Algorithms',
        instructor: 'Dr. Sharma',
        room: 'Room A-204',
        schedule_time: '09:00 AM',
        credits: 4,
        type: 'CORE',
        color: 'blue',
        progress: 78,
        search_terms: 'data structures algorithms room a-204 sharma cs201'
      },
      {
        code: 'CS202',
        title: 'Web Development Lab',
        instructor: 'Prof. Mehta',
        room: 'Lab C-102',
        schedule_time: '10:15 AM',
        credits: 3,
        type: 'PRACTICAL',
        color: 'purple',
        progress: 64,
        search_terms: 'web development lab c-102 mehta cs202'
      },
      {
        code: 'CS203',
        title: 'Database Management Systems',
        instructor: 'Dr. Patil',
        room: 'Room B-110',
        schedule_time: '12:00 PM',
        credits: 4,
        type: 'CORE',
        color: 'orange',
        progress: 71,
        search_terms: 'database management systems b-110 patil cs203'
      },
      {
        code: 'CS204',
        title: 'AI Project Studio',
        instructor: 'CampusIQ Team',
        room: 'Innovation Hub',
        schedule_time: '02:00 PM',
        credits: 2,
        type: 'WORKSHOP',
        color: 'mint',
        progress: 86,
        search_terms: 'ai project studio innovation hub campusiq cs204'
      }
    ];

    const courseMap = {};
    for (const c of courses) {
      const res = await client.query(`
        INSERT INTO public.courses (code, title, instructor, room, schedule_time, credits, type, color, progress, search_terms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (code) DO UPDATE SET title = $2, instructor = $3, room = $4, schedule_time = $5, credits = $6, type = $7, color = $8, progress = $9, search_terms = $10
        RETURNING id, code;
      `, [c.code, c.title, c.instructor, c.room, c.schedule_time, c.credits, c.type, c.color, c.progress, c.search_terms]);
      courseMap[c.code] = res.rows[0].id;
    }
    console.log('Courses seeded.');

    // 4. Seed Today's Schedule
    await client.query('DELETE FROM public.today_schedules;');
    const schedules = [
      { code: 'CS201', time: '09:00', ampm: 'AM', type: 'LECTURE', dot: 'blue-dot', cls: 'cb', range: '09:00 – 10:00', order: 1 },
      { code: 'CS202', time: '10:15', ampm: 'AM', type: 'PRACTICAL', dot: 'purple-dot', cls: 'cp', range: '10:15 – 11:45', order: 2 },
      { code: 'CS203', time: '12:00', ampm: 'PM', type: 'LECTURE', dot: 'orange-dot', cls: 'co', range: '12:00 – 01:00', order: 3 },
      { code: 'CS204', time: '02:00', ampm: 'PM', type: 'WORKSHOP', dot: 'green-dot', cls: 'cg', range: '02:00 – 03:30', order: 4 }
    ];
    for (const s of schedules) {
      await client.query(`
        INSERT INTO public.today_schedules (course_id, time_display, ampm, type_label, dot_color, class_class, time_range, order_index)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [courseMap[s.code], s.time, s.ampm, s.type, s.dot, s.cls, s.range, s.order]);
    }
    console.log('Today schedules seeded.');

    // 5. Seed Enrollments & Attendance for student
    const enrollments = [
      { code: 'CS201', held: 20, attended: 19 },
      { code: 'CS202', held: 15, attended: 12 },
      { code: 'CS203', held: 18, attended: 13 },
      { code: 'CS204', held: 10, attended: 10 }
    ];
    for (const e of enrollments) {
      await client.query(`
        INSERT INTO public.enrollments (user_id, course_id, classes_held, classes_attended)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, course_id) DO UPDATE SET classes_held = $3, classes_attended = $4;
      `, [studentUser.id, courseMap[e.code], e.held, e.attended]);
    }
    console.log('Enrollments seeded.');

    // 6. Seed Assignments
    await client.query('DELETE FROM public.assignments WHERE user_id = $1;', [studentUser.id]);
    const assignments = [
      { code: 'CS201', title: 'Binary Search Tree & AVL Balancing', desc: 'Implement insertion, deletion, and rotation algorithms in C++.', due: new Date(Date.now() + 86400000 * 3), status: 'pending' },
      { code: 'CS202', title: 'Responsive Student Portal Dashboard', desc: 'Build modern responsive layouts with CSS Grid and vanilla JS.', due: new Date(Date.now() + 86400000 * 5), status: 'submitted', score: 92 },
      { code: 'CS203', title: 'Relational Normalization to BCNF', desc: 'Analyze anomaly cases and perform loss-less join decomposition.', due: new Date(Date.now() + 86400000 * 2), status: 'pending' },
      { code: 'CS204', title: 'AI Co-pilot Prompt Engineering Spec', desc: 'Design context injection pipelines for intelligent study helpers.', due: new Date(Date.now() + 86400000 * 7), status: 'pending' }
    ];
    for (const a of assignments) {
      await client.query(`
        INSERT INTO public.assignments (course_id, user_id, title, description, due_date, status, score)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [courseMap[a.code], studentUser.id, a.title, a.desc, a.due, a.status, a.score || null]);
    }
    console.log('Assignments seeded.');

    // 7. Seed Study Plans
    await client.query('DELETE FROM public.study_plans WHERE user_id = $1;', [studentUser.id]);
    const studyPlans = [
      { title: 'DSA: Revise Graph BFS & Dijkstra algorithms', mins: 45, completed: false },
      { title: 'DBMS: Practice SQL Group By & Window queries', mins: 30, completed: true },
      { title: 'Web Lab: Review Flexbox & CSS Grid breakpoints', mins: 25, completed: false }
    ];
    for (const sp of studyPlans) {
      await client.query(`
        INSERT INTO public.study_plans (user_id, title, duration_mins, target_date, completed)
        VALUES ($1, $2, $3, CURRENT_DATE, $4);
      `, [studentUser.id, sp.title, sp.mins, sp.completed]);
    }
    console.log('Study plans seeded.');

    // 8. Seed Course Resources
    await client.query('DELETE FROM public.course_resources;');
    const resources = [
      { code: 'CS201', title: 'DSA Complete Lecture Notes & Cheat Sheet', type: 'PDF Document', url: '#' },
      { code: 'CS202', title: 'Modern JavaScript & DOM Manipulation Guide', type: 'Code Lab Kit', url: '#' },
      { code: 'CS203', title: 'Database Schema Design Best Practices', type: 'Slides', url: '#' },
      { code: 'CS204', title: 'AI Project Studio Starter Repo & Docs', type: 'GitHub Kit', url: '#' }
    ];
    for (const r of resources) {
      await client.query(`
        INSERT INTO public.course_resources (course_id, title, type, url)
        VALUES ($1, $2, $3, $4);
      `, [courseMap[r.code], r.title, r.type, r.url]);
    }
    console.log('Course resources seeded.');

    // 9. Seed Events
    const events = [
      {
        title: 'Innovation Day 2026',
        category: 'tech',
        date_str: 'October 22, 2026',
        time_str: '10:00 AM onwards',
        location: 'Innovation Hub',
        description: 'One day. Fresh ideas. A campus full of possibility. Share a project, join a team, or come get inspired.',
        is_featured: true,
        poster_class: 'hack',
        badge: 'MAKE IT HAPPEN.'
      },
      {
        title: 'Campus Hack Night',
        category: 'tech',
        date_str: 'October 18, 2026',
        time_str: '5:00 PM – 10:00 PM',
        location: 'Lab C',
        description: 'Bring an idea, find your team, and build something useful in one evening.',
        is_featured: false,
        poster_class: 'hack',
        badge: 'BUILD BEYOND.'
      },
      {
        title: 'Mindful Campus Hour',
        category: 'community',
        date_str: 'October 20, 2026',
        time_str: '4:00 PM – 5:00 PM',
        location: 'Reflection Garden',
        description: 'Take a breather with a guided reset and a little space to recharge.',
        is_featured: false,
        poster_class: 'wellness',
        badge: 'RESET. REFRESH.'
      },
      {
        title: 'AI Project Showcase',
        category: 'tech',
        date_str: 'October 25, 2026',
        time_str: '11:00 AM – 1:00 PM',
        location: 'Hall B',
        description: 'Explore student experiments and see how ideas become working prototypes.',
        is_featured: false,
        poster_class: 'ai',
        badge: 'THINK IN AI.'
      }
    ];

    for (const ev of events) {
      await client.query(`
        INSERT INTO public.events (title, category, date_str, time_str, location, description, is_featured, poster_class, badge)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING;
      `, [ev.title, ev.category, ev.date_str, ev.time_str, ev.location, ev.description, ev.is_featured, ev.poster_class, ev.badge]);
    }
    console.log('Events seeded.');

    // 10. Seed Facilities
    await client.query('DELETE FROM public.facilities;');
    const facilities = [
      {
        name: 'Central Library',
        category: 'study',
        location: 'Block A · Floor 2',
        hours: '8 AM – 8 PM',
        description: 'A calm place for deep work, reading, and research with high-speed campus Wi-Fi.',
        total_capacity: 16,
        occupied_capacity: 4,
        status: 'Open',
        art_class: 'lib',
        tag: 'FOCUS ZONE',
        search: 'central library silent study books reading block a floor 2'
      },
      {
        name: 'Innovation Hub',
        category: 'study',
        location: 'Block C · Ground',
        hours: '9 AM – 6 PM',
        description: 'Collaborate, prototype, and turn ambitious ideas into reality with dual-monitor docks.',
        total_capacity: 10,
        occupied_capacity: 3,
        status: 'Open',
        art_class: 'hub',
        tag: 'MAKE & BUILD',
        search: 'innovation hub project teamwork lab block c ground workstations'
      },
      {
        name: 'Student Commons',
        category: 'social',
        location: 'Main Building',
        hours: '8 AM – 7 PM',
        description: 'A welcoming spot for quick bites, chats, and casual teamwork between lectures.',
        total_capacity: 8,
        occupied_capacity: 5,
        status: 'Busy',
        art_class: 'commons',
        tag: 'TAKE A BREATHER',
        search: 'student commons cafe food social coffee main building open tables'
      },
      {
        name: 'Reflection Garden',
        category: 'social',
        location: 'East Courtyard',
        hours: 'Open campus hours',
        description: 'Fresh air, a little quiet, and room to think between classes with open canopy seating.',
        total_capacity: 12,
        occupied_capacity: 4,
        status: 'Open',
        art_class: 'garden',
        tag: 'OUTDOOR RESET',
        search: 'green garden outdoor relaxation east courtyard seating fresh air'
      }
    ];

    for (const f of facilities) {
      await client.query(`
        INSERT INTO public.facilities (name, category, location, hours, description, total_capacity, occupied_capacity, status, art_class, tag, search_terms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `, [f.name, f.category, f.location, f.hours, f.description, f.total_capacity, f.occupied_capacity, f.status, f.art_class, f.tag, f.search]);
    }
    console.log('Facilities seeded.');

    // 11. Seed Notifications
    await client.query('DELETE FROM public.notifications WHERE user_id = $1;', [studentUser.id]);
    const notifications = [
      { title: 'Upcoming Class Reminder', message: 'Data Structures & Algorithms starts at 09:00 AM in Room A-204 with Dr. Sharma.', type: 'info' },
      { title: 'Attendance Alert', message: 'Your attendance in Database Management Systems is 72.2%. Attend upcoming classes to stay above 75%.', type: 'warning' },
      { title: 'Assignment Due Soon', message: 'Binary Search Tree & AVL Balancing is due in 3 days.', type: 'alert' },
      { title: 'Campus Event', message: 'Campus Hack Night registrations are closing soon. Reserve your spot!', type: 'success' }
    ];
    for (const n of notifications) {
      await client.query(`
        INSERT INTO public.notifications (user_id, title, message, type, is_read)
        VALUES ($1, $2, $3, $4, false);
      `, [studentUser.id, n.title, n.message, n.type]);
    }
    console.log('Notifications seeded.');

    // 12. Seed AI Insights
    await client.query('DELETE FROM public.ai_insights WHERE user_id = $1;', [studentUser.id]);
    const insights = [
      {
        category: 'TIME MANAGEMENT',
        title: 'Protect your focus window.',
        content: 'Your sample timetable has a gap after lunch. Use 25 minutes to review DSA notes before the afternoon workshop.',
        color: 'lavender'
      },
      {
        category: 'CAMPUS SPACES',
        title: 'Try a change of scenery.',
        content: 'The Central Library currently has 12 available seats. A quiet space can make focused assignment work easier.',
        color: 'mint'
      },
      {
        category: 'CAMPUS LIFE',
        title: 'Make room for curiosity.',
        content: 'Innovation Day 2026 is scheduled for Oct 22 in Innovation Hub. Consider sharing a project or joining a hackathon team.',
        color: 'peach'
      }
    ];
    for (const ins of insights) {
      await client.query(`
        INSERT INTO public.ai_insights (user_id, category, title, content, color)
        VALUES ($1, $2, $3, $4, $5);
      `, [studentUser.id, ins.category, ins.title, ins.content, ins.color]);
    }
    console.log('AI Insights seeded.');

    console.log('=== DATABASE INITIALIZATION COMPLETED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Database initialization error:', err);
  } finally {
    await client.end();
  }
}

initDB();
