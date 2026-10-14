const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Database Connection to Supabase PostgreSQL (IPv4 Pooler for Render compatibility)
const defaultDbUrl = 'postgresql://postgres.pworthvdkipwqennqfto:XhBQsukJTXMFX4uT@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
const connectionString = process.env.DATABASE_URL || defaultDbUrl;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// In-memory session store (backed by user IDs)
const sessions = new Map();

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// Authentication Middleware
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    req.user = null;
    return next();
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, full_name, student_id, role, department, semester, created_at FROM public.users WHERE id = $1',
      [session.userId]
    );
    req.user = rows[0] || null;
  } catch (err) {
    console.error('Auth lookup error:', err);
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}

app.use(authenticate);

// ===================== AUTH ROUTES =====================

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM public.users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    const { salt, hash } = hashPassword(password);
    const displayName = full_name?.trim() || cleanEmail.split('@')[0];
    const studentId = 'CIQ-2026-' + Math.floor(100 + Math.random() * 900);

    const userRes = await pool.query(`
      INSERT INTO public.users (email, password_hash, salt, full_name, student_id, role, department, semester)
      VALUES ($1, $2, $3, $4, $5, 'student', 'Computer Science & Engineering', 4)
      RETURNING id, email, full_name, student_id, role, department, semester, created_at;
    `, [cleanEmail, hash, salt, displayName, studentId]);

    const newUser = userRes.rows[0];

    // Seed enrollments for new student
    const coursesRes = await pool.query('SELECT id FROM public.courses LIMIT 4');
    for (const c of coursesRes.rows) {
      await pool.query(`
        INSERT INTO public.enrollments (user_id, course_id, classes_held, classes_attended)
        VALUES ($1, $2, 20, 18)
        ON CONFLICT DO NOTHING;
      `, [newUser.id, c.id]);
    }

    // Seed a welcome notification
    await pool.query(`
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES ($1, 'Welcome to CampusIQ!', 'Your student portal is fully connected to Supabase PostgreSQL. Explore your timetable, track attendance, and register for campus events.', 'success');
    `, [newUser.id]);

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
      userId: newUser.id,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      message: 'Account created successfully.',
      user: newUser,
      token
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account: ' + err.message });
  }
});

// Sign In
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, salt, full_name, student_id, role, department, semester FROM public.users WHERE email = $1',
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'No account found with this email. Please check your spelling or create an account.' });
    }

    const user = rows[0];
    const computedHash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex');
    if (computedHash !== user.password_hash) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
      userId: user.id,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    const userProfile = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      student_id: user.student_id,
      role: user.role,
      department: user.department,
      semester: user.semester
    };

    res.json({
      message: 'Signed in successfully.',
      user: userProfile,
      token
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Failed to sign in: ' + err.message });
  }
});

// Current User Profile
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ user: null });
  }
  res.json({ user: req.user });
});

// Sign Out
app.post('/api/auth/signout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    sessions.delete(token);
  }
  res.json({ message: 'Signed out successfully.' });
});

// Helper to get fallback student ID if anonymous
async function getEffectiveUserId(req) {
  if (req.user) return req.user.id;
  const { rows } = await pool.query("SELECT id FROM public.users WHERE role = 'student' LIMIT 1");
  return rows[0]?.id;
}

// ===================== OVERVIEW ROUTE =====================
app.get('/api/overview', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);

    // Attendance rate
    const attRes = await pool.query(`
      SELECT SUM(classes_held) as total_held, SUM(classes_attended) as total_attended
      FROM public.enrollments WHERE user_id = $1;
    `, [userId]);
    const held = parseInt(attRes.rows[0]?.total_held) || 20;
    const attended = parseInt(attRes.rows[0]?.total_attended) || 18;
    const rate = Math.round((attended / held) * 1000) / 10;

    // Study spaces
    const facRes = await pool.query('SELECT SUM(total_capacity) as total, SUM(occupied_capacity) as occupied FROM public.facilities;');
    const totalSpaces = parseInt(facRes.rows[0]?.total) || 30;
    const occupiedSpaces = parseInt(facRes.rows[0]?.occupied) || 6;
    const availableSpaces = totalSpaces - occupiedSpaces;

    // Events count
    const evRes = await pool.query('SELECT COUNT(*) as count FROM public.events;');
    const eventCount = parseInt(evRes.rows[0]?.count) || 4;

    // Today schedule
    const schedRes = await pool.query(`
      SELECT ts.*, c.title, c.instructor, c.room
      FROM public.today_schedules ts
      JOIN public.courses c ON ts.course_id = c.id
      ORDER BY ts.order_index ASC;
    `);

    // Notifications count
    const notifRes = await pool.query(
      'SELECT COUNT(*) as unread FROM public.notifications WHERE user_id = $1 AND is_read = false;',
      [userId]
    );

    res.json({
      attendance: {
        rate,
        held,
        attended
      },
      spaces: {
        total: totalSpaces,
        occupied: occupiedSpaces,
        available: availableSpaces
      },
      eventsCount: eventCount,
      schedule: schedRes.rows,
      unreadNotifications: parseInt(notifRes.rows[0]?.unread) || 0
    });
  } catch (err) {
    console.error('Overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===================== ACADEMICS & COURSES =====================
app.get('/api/academics', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM public.courses ORDER BY code ASC;');
    res.json({ courses: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== ASSIGNMENTS =====================
app.get('/api/assignments', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    let { rows } = await pool.query(`
      SELECT a.*, c.title as course_title, c.code as course_code
      FROM public.assignments a
      JOIN public.courses c ON a.course_id = c.id
      WHERE a.user_id = $1
      ORDER BY a.due_date ASC;
    `, [userId]);

    // If none exist for this student, auto-populate standard assignments
    if (rows.length === 0) {
      const coursesRes = await pool.query('SELECT id, code FROM public.courses ORDER BY code ASC');
      const sampleAssigns = [
        { code: 'CS201', title: 'Binary Search Tree & AVL Balancing', desc: 'Implement insertion, deletion, and rotation algorithms in C++.', days: 3 },
        { code: 'CS202', title: 'Responsive Student Portal Dashboard', desc: 'Build modern responsive layouts with CSS Grid and vanilla JS.', days: 5 },
        { code: 'CS203', title: 'Relational Normalization to BCNF', desc: 'Analyze anomaly cases and perform loss-less join decomposition.', days: 2 },
        { code: 'CS204', title: 'AI Co-pilot Prompt Engineering Spec', desc: 'Design context injection pipelines for intelligent study helpers.', days: 7 }
      ];
      for (const sa of sampleAssigns) {
        const c = coursesRes.rows.find(x => x.code === sa.code) || coursesRes.rows[0];
        if (c) {
          await pool.query(`
            INSERT INTO public.assignments (course_id, user_id, title, description, due_date, status)
            VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${sa.days} days', 'pending');
          `, [c.id, userId, sa.title, sa.desc]);
        }
      }

      const refetch = await pool.query(`
        SELECT a.*, c.title as course_title, c.code as course_code
        FROM public.assignments a
        JOIN public.courses c ON a.course_id = c.id
        WHERE a.user_id = $1
        ORDER BY a.due_date ASC;
      `, [userId]);
      rows = refetch.rows;
    }

    res.json({ assignments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/assignments/:id/toggle', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { id } = req.params;
    const check = await pool.query('SELECT status FROM public.assignments WHERE id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    const current = check.rows[0].status;
    const newStatus = current === 'submitted' ? 'pending' : 'submitted';
    const score = newStatus === 'submitted' ? 95 : null;

    const { rows } = await pool.query(`
      UPDATE public.assignments
      SET status = $1, score = $2
      WHERE id = $3 AND user_id = $4
      RETURNING *;
    `, [newStatus, score, id, userId]);

    res.json({ assignment: rows[0], message: `Assignment marked as ${newStatus}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== STUDY PLANS =====================
app.get('/api/study-plans', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { rows } = await pool.query('SELECT * FROM public.study_plans WHERE user_id = $1 ORDER BY created_at ASC;', [userId]);
    res.json({ studyPlans: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/study-plans/:id/toggle', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { id } = req.params;
    const { rows } = await pool.query(`
      UPDATE public.study_plans
      SET completed = NOT completed
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `, [id, userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Study plan not found' });
    res.json({ studyPlan: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/study-plans/add', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { title, duration_mins } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const { rows } = await pool.query(`
      INSERT INTO public.study_plans (user_id, title, duration_mins, target_date, completed)
      VALUES ($1, $2, $3, CURRENT_DATE, false)
      RETURNING *;
    `, [userId, title.trim(), parseInt(duration_mins) || 25]);

    res.json({ studyPlan: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== COURSE RESOURCES =====================
app.get('/api/resources', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, c.title as course_title, c.code as course_code
      FROM public.course_resources r
      JOIN public.courses c ON r.course_id = c.id
      ORDER BY c.code, r.title;
    `);
    res.json({ resources: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== ATTENDANCE =====================
app.get('/api/attendance', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { rows } = await pool.query(`
      SELECT e.id, e.classes_held, e.classes_attended, c.id as course_id, c.code, c.title, c.instructor, c.room
      FROM public.enrollments e
      JOIN public.courses c ON e.course_id = c.id
      WHERE e.user_id = $1
      ORDER BY c.code ASC;
    `, [userId]);

    const breakdown = rows.map(r => {
      const rate = r.classes_held > 0 ? Math.round((r.classes_attended / r.classes_held) * 100) : 100;
      let status = 'Excellent';
      let pill = 'good-pill';
      if (rate < 75) {
        status = 'Needs focus';
        pill = 'warn-pill';
      } else if (rate < 85) {
        status = 'On track';
        pill = 'good-pill';
      }
      return {
        ...r,
        rate,
        status,
        pill
      };
    });

    const totalHeld = breakdown.reduce((sum, b) => sum + b.classes_held, 0);
    const totalAttended = breakdown.reduce((sum, b) => sum + b.classes_attended, 0);
    const overallRate = totalHeld > 0 ? (Math.round((totalAttended / totalHeld) * 1000) / 10) : 0;

    res.json({
      breakdown,
      overallRate,
      totalHeld,
      totalAttended
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/mark', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { course_id, present } = req.body;
    if (!course_id) return res.status(400).json({ error: 'course_id is required' });

    const attendedIncrement = present ? 1 : 0;
    const { rows } = await pool.query(`
      UPDATE public.enrollments
      SET classes_held = classes_held + 1,
          classes_attended = classes_attended + $1,
          updated_at = NOW()
      WHERE user_id = $2 AND course_id = $3
      RETURNING *;
    `, [attendedIncrement, userId, course_id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Enrollment record not found' });

    res.json({
      message: present ? 'Class marked as Present ✓' : 'Class marked as Absent',
      enrollment: rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== EVENTS =====================
app.get('/api/events', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const eventsQuery = await pool.query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM public.event_registrations r WHERE r.event_id = e.id) as registration_count,
        EXISTS(SELECT 1 FROM public.event_registrations r WHERE r.event_id = e.id AND r.user_id = $1) as is_registered
      FROM public.events e
      ORDER BY e.is_featured DESC, e.created_at ASC;
    `, [userId]);

    res.json({ events: eventsQuery.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:id/register', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { id } = req.params;

    // Check existing
    const existing = await pool.query(
      'SELECT id FROM public.event_registrations WHERE event_id = $1 AND user_id = $2',
      [id, userId]
    );

    let registered = false;
    if (existing.rows.length > 0) {
      // Unregister
      await pool.query('DELETE FROM public.event_registrations WHERE id = $1', [existing.rows[0].id]);
      registered = false;
    } else {
      // Register
      await pool.query(
        'INSERT INTO public.event_registrations (event_id, user_id) VALUES ($1, $2)',
        [id, userId]
      );
      registered = true;
    }

    const countRes = await pool.query('SELECT COUNT(*) as count FROM public.event_registrations WHERE event_id = $1', [id]);

    res.json({
      registered,
      registrationCount: parseInt(countRes.rows[0]?.count) || 0,
      message: registered ? 'Successfully registered for event!' : 'Registration cancelled.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== FACILITIES & BOOKINGS =====================
app.get('/api/facilities', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { rows } = await pool.query(`
      SELECT f.*,
        EXISTS(SELECT 1 FROM public.facility_bookings b WHERE b.facility_id = f.id AND b.user_id = $1 AND b.booking_date = CURRENT_DATE) as has_booking
      FROM public.facilities f
      ORDER BY f.name ASC;
    `, [userId]);

    res.json({ facilities: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/facilities/:id/book', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { id } = req.params;
    const { slot_time } = req.body;

    const fac = await pool.query('SELECT * FROM public.facilities WHERE id = $1', [id]);
    if (fac.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });

    const facility = fac.rows[0];
    if (facility.occupied_capacity >= facility.total_capacity) {
      return res.status(400).json({ error: 'This facility is currently fully occupied.' });
    }

    const seatNum = 'Seat #' + (facility.occupied_capacity + 1);
    const slot = slot_time || 'Next 2 Hours';

    // Insert booking
    await pool.query(`
      INSERT INTO public.facility_bookings (facility_id, user_id, booking_date, slot_time, seat_number, status)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, 'Confirmed')
    `, [id, userId, slot, seatNum]);

    // Increment occupied
    const updated = await pool.query(`
      UPDATE public.facilities
      SET occupied_capacity = occupied_capacity + 1,
          status = CASE WHEN occupied_capacity + 1 >= total_capacity THEN 'Busy' ELSE status END
      WHERE id = $1
      RETURNING *;
    `, [id]);

    res.json({
      message: `Reservation confirmed at ${facility.name}! Assigned ${seatNum} for ${slot}.`,
      facility: updated.rows[0],
      seat: seatNum
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== NOTIFICATIONS =====================
app.get('/api/notifications', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { rows } = await pool.query(
      'SELECT * FROM public.notifications WHERE user_id = $1 ORDER BY created_at DESC;',
      [userId]
    );
    res.json({ notifications: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    await pool.query('UPDATE public.notifications SET is_read = true WHERE user_id = $1;', [userId]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== AI INSIGHTS =====================
app.get('/api/insights', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);
    const { rows } = await pool.query(
      'SELECT * FROM public.ai_insights WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10;',
      [userId]
    );
    res.json({ insights: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/insights/generate', async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req);

    // Fetch user context: lowest attendance subject, next assignment due, and study spaces
    const attRes = await pool.query(`
      SELECT c.title, e.classes_held, e.classes_attended,
             ROUND((e.classes_attended::numeric / NULLIF(e.classes_held, 0)) * 100) as rate
      FROM public.enrollments e
      JOIN public.courses c ON e.course_id = c.id
      WHERE e.user_id = $1
      ORDER BY rate ASC LIMIT 1;
    `, [userId]);

    const assignRes = await pool.query(`
      SELECT a.title, c.title as course_title, a.due_date
      FROM public.assignments a
      JOIN public.courses c ON a.course_id = c.id
      WHERE a.user_id = $1 AND a.status = 'pending'
      ORDER BY a.due_date ASC LIMIT 1;
    `, [userId]);

    const facRes = await pool.query(`
      SELECT name, total_capacity - occupied_capacity as avail
      FROM public.facilities WHERE total_capacity > occupied_capacity
      ORDER BY avail DESC LIMIT 1;
    `);

    // Intelligent generation based on real data
    const lowCourse = attRes.rows[0];
    const nextAssign = assignRes.rows[0];
    const bestSpace = facRes.rows[0];

    // Check if Google Gemini API key is configured
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const userPrompt = `You are CampusIQ AI Co-pilot for student ${req.user?.full_name || 'Student'}.
Current academic context:
- Lowest attendance subject: ${lowCourse ? `${lowCourse.title} (${lowCourse.rate}%)` : 'All subjects above 85%'}
- Next pending assignment: ${nextAssign ? `${nextAssign.title} for ${nextAssign.course_title}` : 'None pending'}
- Best available quiet study space: ${bestSpace ? `${bestSpace.name} (${bestSpace.avail} seats open)` : 'Central Library'}
Respond ONLY with raw JSON in this exact structure without markdown formatting or codeblocks:
{"category": "ACADEMIC FOCUS", "title": "A concise headline under 8 words", "content": "1-2 practical, personalized sentences advising what to do next.", "color": "lavender"}`;

        const gRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }]
          })
        });

        if (gRes.ok) {
          const gData = await gRes.json();
          const rawText = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleanJson = rawText.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed.title && parsed.content) {
              const { rows } = await pool.query(`
                INSERT INTO public.ai_insights (user_id, category, title, content, badge, color)
                VALUES ($1, $2, $3, $4, 'POWERED BY GOOGLE GEMINI AI', $5)
                RETURNING *;
              `, [userId, parsed.category || 'ACADEMIC FOCUS', parsed.title, parsed.content, parsed.color || 'lavender']);
              return res.json({
                insight: rows[0],
                message: 'Generated by Google Gemini AI based on your live academic records.'
              });
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini API call warning, using database generator:', geminiErr.message);
      }
    }

    const templates = [
      {
        category: 'ACADEMIC FOCUS',
        title: lowCourse ? `Prioritize attendance in ${lowCourse.title}.` : 'Keep up the academic momentum.',
        content: lowCourse
          ? `Your attendance is currently ${lowCourse.rate}%. Attending the next two lectures will raise your score safely above the 75% requirement.`
          : 'All your course attendances are well above 85%. You have earned a balanced study weekend.',
        color: 'lavender'
      },
      {
        category: 'ASSIGNMENT SPRINT',
        title: nextAssign ? `Focus on "${nextAssign.title}".` : 'No urgent assignments pending.',
        content: nextAssign
          ? `Due for ${nextAssign.course_title}. Block a 45-minute focus session today to finish the core requirements ahead of the deadline.`
          : 'You are completely caught up with coursework. Great time to explore an elective or campus hackathon.',
        color: 'mint'
      },
      {
        category: 'STUDY SPACES',
        title: bestSpace ? `Optimal quiet spot: ${bestSpace.name}.` : 'Campus study zones open.',
        content: bestSpace
          ? `Currently has ${bestSpace.avail} workstations open with ideal Wi-Fi connectivity and natural lighting.`
          : 'Central Library and Innovation Hub both have open seating ready for group or solo study.',
        color: 'peach'
      }
    ];

    const chosen = templates[Math.floor(Math.random() * templates.length)];

    const { rows } = await pool.query(`
      INSERT INTO public.ai_insights (user_id, category, title, content, badge, color)
      VALUES ($1, $2, $3, $4, 'JUST GENERATED · LIVE CO-PILOT', $5)
      RETURNING *;
    `, [userId, chosen.category, chosen.title, chosen.content, chosen.color]);

    res.json({
      insight: rows[0],
      message: 'New personalized AI brief generated from your live academic records.'
    });
  } catch (err) {
    console.error('AI insight error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`CampusIQ Server running on: http://localhost:${PORT}`);
  console.log(`Database connected: Supabase PostgreSQL (db.pworthvdkipwqennqfto.supabase.co)`);
  console.log(`Default Student: student@campusiq.edu | CampusIQ@2026`);
  console.log(`Default Admin:   admin@campusiq.edu   | AdminIQ@2026`);
  console.log(`====================================================`);
});
