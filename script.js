(()=>{
  // CampusIQ — Fully Connected Application (Supabase PostgreSQL & Render)
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // Relative API_BASE for all HTTP/HTTPS deployments (Render, localhost, etc.)
  const API_BASE = window.location.protocol.startsWith('http') ? '' : 'https://satyam-i24x.onrender.com';

  let currentUser = null;
  let authToken = localStorage.getItem('campusiq_token') || null;
  let authMode = 'signin';
  let toastTimer, tipIndex = 0;

  // Generic API Helper
  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    try {
      const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
      return data;
    } catch (err) {
      console.warn(`API [${path}] warning:`, err.message);
      throw err;
    }
  }

  // Toast Helper
  function toast(msg) {
    const el = $('#toastText');
    if (!el) return;
    el.textContent = msg;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2800);
  }

  // Simple Notice Modal
  function modal(title, text) {
    $('#modalTitle').textContent = title;
    $('#modalText').textContent = text;
    $('#backdrop').classList.add('open');
  }
  function closeModal() {
    $('#backdrop').classList.remove('open');
  }
  $('#closeModal').onclick = closeModal;
  $('#okay').onclick = closeModal;
  $('#backdrop').onclick = e => { if (e.target === $('#backdrop')) closeModal(); };

  // Rich Feature Modal (Assignments, Study Planner, Resources, Booking, Notifications, Profile)
  const featureBackdrop = $('#featureBackdrop');
  function openFeatureModal(title, subtitle, htmlContent) {
    $('#featureTitle').textContent = title;
    $('#featureSubtitle').textContent = subtitle;
    $('#featureBody').innerHTML = htmlContent;
    featureBackdrop.classList.add('open');
    featureBackdrop.setAttribute('aria-hidden', 'false');
  }
  function closeFeatureModal() {
    featureBackdrop.classList.remove('open');
    featureBackdrop.setAttribute('aria-hidden', 'true');
  }
  $('#featureClose').onclick = closeFeatureModal;
  featureBackdrop.onclick = e => { if (e.target === featureBackdrop) closeFeatureModal(); };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeFeatureModal();
      closeAuth();
    }
  });

  // ===================== VIEW SWITCHER: LANDING PAGE vs WORKSPACE =====================
  function showLandingView() {
    const landing = $('#view-landing');
    const app = $('#view-app');
    if (landing) landing.style.display = 'block';
    if (app) app.style.display = 'none';
    history.replaceState(null, '', '#landing');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showAppView(page = 'overview') {
    const landing = $('#view-landing');
    const app = $('#view-app');
    if (landing) landing.style.display = 'none';
    if (app) app.style.display = 'block';
    go(page);
  }

  // Bind Landing Page CTAs
  const landingSignIn = $('#landingSignInBtn');
  if (landingSignIn) landingSignIn.onclick = () => openAuth('signin');

  const landingPortal = $('#landingPortalBtn');
  if (landingPortal) landingPortal.onclick = () => {
    if (currentUser) showAppView('overview');
    else openAuth('signin');
  };

  const heroPortal = $('#heroPortalBtn');
  if (heroPortal) heroPortal.onclick = () => {
    if (currentUser) showAppView('overview');
    else openAuth('signin');
  };

  const heroSignIn = $('#heroSignInBtn');
  if (heroSignIn) heroSignIn.onclick = () => openAuth('signin');

  const dashPortal = $('#dashPortalBtn');
  if (dashPortal) dashPortal.onclick = () => {
    if (currentUser) showAppView('overview');
    else openAuth('signin');
  };

  // Bind Workspace Return to Landing buttons
  const sideToLand = $('#sidebarToLanding');
  if (sideToLand) sideToLand.onclick = showLandingView;

  const topToLand = $('#topbarToLanding');
  if (topToLand) topToLand.onclick = showLandingView;

  // ===================== WORKSPACE NAVIGATION =====================
  const pages = ['overview', 'academics', 'attendance', 'events', 'facilities', 'insights'];
  const names = {
    overview: 'Overview',
    academics: 'Academics',
    attendance: 'Attendance',
    events: 'Campus events',
    facilities: 'Facilities',
    insights: 'AI insights'
  };

  function go(page) {
    if (!pages.includes(page)) return;
    const app = $('#view-app');
    const landing = $('#view-landing');
    if (app && app.style.display === 'none') {
      if (landing) landing.style.display = 'none';
      app.style.display = 'block';
    }

    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    $$('.nav').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    $('#crumb').textContent = names[page];
    $('#sidebar').classList.remove('open');
    history.replaceState(null, '', '#' + page);
    window.scrollTo({ top: 0, behavior: 'auto' });

    // Refresh live page data
    if (page === 'attendance') loadAttendance();
    if (page === 'events') loadEvents();
    if (page === 'facilities') loadFacilities();
    if (page === 'academics') loadAcademics();
    if (page === 'overview') loadOverview();
  }

  document.addEventListener('click', e => {
    const n = e.target.closest('[data-page]');
    const g = e.target.closest('[data-go]');
    if (n) { e.preventDefault(); showAppView(n.dataset.page); }
    if (g) { e.preventDefault(); showAppView(g.dataset.go); }
  });

  // Sidebar toggle on mobile
  $('#hamb').onclick = () => $('#sidebar').classList.toggle('open');
  document.addEventListener('click', e => {
    if (innerWidth <= 850 && $('#sidebar').classList.contains('open') && !$('#sidebar').contains(e.target) && !e.target.closest('#hamb')) {
      $('#sidebar').classList.remove('open');
    }
  });

  // Theme toggle
  const savedTheme = localStorage.getItem('campusiq_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    $('#theme').textContent = '☀';
  }
  $('#theme').onclick = () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    $('#theme').textContent = isDark ? '☀' : '◐';
    localStorage.setItem('campusiq_theme', isDark ? 'dark' : 'light');
    toast(isDark ? 'Dark mode enabled' : 'Light mode enabled');
  };

  // Date formatting
  $('#today').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Tips
  const tips = [
    ['Small steps. Big progress.', 'Try a 25-minute focus session before your next class. Consistency beats cramming.'],
    ['Make tomorrow easier.', 'Spend two minutes checking your next day’s timetable before logging off.'],
    ['Learn out loud.', 'Explaining one concept to a friend can reveal what you understand best.'],
    ['Give your brain a reset.', 'A short walk can help you return to a task with fresh focus.']
  ];
  $('#newTip').onclick = () => {
    tipIndex = (tipIndex + 1) % tips.length;
    $('#tipTitle').textContent = tips[tipIndex][0];
    $('#tipText').textContent = tips[tipIndex][1];
    toast('A fresh CampusIQ tip is ready');
  };

  // ===================== AUTHENTICATION =====================
  const authBackdrop = $('#authBackdrop');
  const authForm = $('#signInForm');
  const authEmail = $('#authEmail');
  const authPassword = $('#authPassword');
  const authName = $('#authName');
  const nameFieldGroup = $('#nameFieldGroup');

  function updateAuthUI() {
    const signedIn = Boolean(currentUser);
    $('#signInBtn').textContent = signedIn ? 'Sign out' : 'Sign in';
    $('#signInBtn').setAttribute('aria-label', signedIn ? 'Sign out of CampusIQ' : 'Sign in to CampusIQ');
    
    const initials = currentUser?.full_name 
      ? currentUser.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
      : signedIn ? 'ST' : 'SS';
    
    $('#profile').textContent = initials;
    const sideAvatar = $('.user .avatar');
    if (sideAvatar) sideAvatar.textContent = initials;

    const nameEl = $('.user b');
    if (nameEl) nameEl.textContent = signedIn ? currentUser.full_name : 'Student Space';

    const smallEl = $('.user small');
    if (smallEl) smallEl.textContent = signedIn ? `${currentUser.role.toUpperCase()} · ${currentUser.student_id || 'Verified'}` : 'Guest session';

    const dbStatus = $('#dbStatus');
    if (dbStatus) dbStatus.textContent = signedIn ? 'Supabase Connected' : 'Supabase Live';

    const landSignIn = $('#landingSignInBtn');
    if (landSignIn) landSignIn.textContent = signedIn ? `Hi, ${currentUser.full_name.split(' ')[0]}` : 'Sign in';
  }

  function openAuth(mode = 'signin') {
    authMode = mode;
    $('#authTitle').textContent = mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back';
    $('#authSubtitle').textContent = mode === 'signup' 
      ? 'Register as a verified student or faculty member.' 
      : mode === 'reset' ? 'Enter your registered email to receive recovery instructions.' : 'Sign in to access your synchronized campus data.';
    
    if (nameFieldGroup) nameFieldGroup.hidden = mode !== 'signup';
    authPassword.closest('.password-field').hidden = mode === 'reset';
    $('#rememberMe').closest('label').hidden = mode !== 'signin';
    $('#authSubmit').textContent = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in securely';
    
    $('#authFoot').innerHTML = mode === 'signup'
      ? 'Already registered? <button type="button" id="createAccount">Sign in</button>'
      : mode === 'reset'
      ? 'Remembered your password? <button type="button" id="createAccount">Back to sign in</button>'
      : 'New to CampusIQ? <button type="button" id="createAccount">Create account</button>';

    $('#authError').textContent = '';
    authBackdrop.classList.add('open');
    authBackdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('auth-open');

    $('#createAccount').onclick = () => openAuth(authMode === 'signup' ? 'signin' : 'signup');
    setTimeout(() => (mode === 'signup' && authName ? authName.focus() : authEmail.focus()), 60);
  }

  function closeAuth() {
    authBackdrop.classList.remove('open');
    authBackdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-open');
    if (nameFieldGroup) nameFieldGroup.hidden = true;
    $('#authPassword').closest('.password-field').hidden = false;
    $('#rememberMe').closest('label').hidden = false;
  }

  function authError(msg) {
    $('#authError').textContent = msg;
  }

  function setBusy(busy) {
    const b = $('#authSubmit');
    b.disabled = busy;
    b.textContent = busy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : authMode === 'reset' ? 'Send reset link' : 'Sign in securely';
  }

  $('#signInBtn').onclick = async () => {
    if (currentUser) {
      try {
        await api('/api/auth/signout', { method: 'POST' });
      } catch (e) {}
      currentUser = null;
      authToken = null;
      localStorage.removeItem('campusiq_token');
      updateAuthUI();
      toast('Signed out successfully.');
      showLandingView();
    } else {
      openAuth('signin');
    }
  };

  $('#authClose').onclick = closeAuth;
  authBackdrop.onclick = e => { if (e.target === authBackdrop) closeAuth(); };

  $('#togglePassword').onclick = () => {
    const show = authPassword.type === 'password';
    authPassword.type = show ? 'text' : 'password';
    $('#togglePassword').textContent = show ? 'Hide' : 'Show';
    $('#togglePassword').setAttribute('aria-pressed', String(show));
  };

  $('#forgotPassword').onclick = () => openAuth('reset');

  // Submit Sign In / Sign Up
  authForm.onsubmit = async e => {
    e.preventDefault();
    if (!authForm.reportValidity()) return;
    const email = authEmail.value.trim();
    const password = authPassword.value;
    const fullName = authName?.value?.trim() || '';

    if (authMode !== 'reset' && password.length < 8) {
      authError('Password must be at least 8 characters long.');
      return;
    }

    setBusy(true);
    authError('');

    try {
      if (authMode === 'signup') {
        const res = await api('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, full_name: fullName })
        });
        currentUser = res.user;
        authToken = res.token;
        localStorage.setItem('campusiq_token', authToken);
        toast(`Account created! Welcome, ${currentUser.full_name}.`);
      } else if (authMode === 'signin') {
        const res = await api('/api/auth/signin', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        currentUser = res.user;
        authToken = res.token;
        localStorage.setItem('campusiq_token', authToken);
        toast(`Signed in successfully as ${currentUser.full_name}.`);
      } else if (authMode === 'reset') {
        toast(`Password reset instructions sent to ${email} (Demo).`);
      }

      updateAuthUI();
      closeAuth();
      authForm.reset();
      showAppView('overview');
    } catch (err) {
      authError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  // Demo Login Quick-Action
  $('#demoLogin').onclick = async () => {
    setBusy(true);
    authError('');
    try {
      const res = await api('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email: 'student@campusiq.edu', password: 'CampusIQ@2026' })
      });
      currentUser = res.user;
      authToken = res.token;
      localStorage.setItem('campusiq_token', authToken);
      updateAuthUI();
      closeAuth();
      toast(`Signed in as demo student (${currentUser.full_name})`);
      showAppView('overview');
    } catch (err) {
      authError('Demo login error: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  // Profile Modal
  $('#profile').onclick = () => {
    if (!currentUser) {
      openAuth('signin');
      return;
    }
    const html = `
      <div class="feature-card" style="margin-bottom:15px;background:#f0edff;border-color:#ded8ff">
        <div class="avatar" style="width:45px;height:45px;font-size:16px">${$('#profile').textContent}</div>
        <div class="feature-card-content" style="margin-left:12px">
          <h3 style="margin:0;font:800 16px Manrope">${currentUser.full_name}</h3>
          <p style="margin:2px 0;font-size:12px;color:#7a6be6">${currentUser.role.toUpperCase()} · ${currentUser.department || 'Engineering'}</p>
        </div>
      </div>
      <table class="profile-table">
        <tr><td>Email</td><td>${currentUser.email}</td></tr>
        <tr><td>Student ID</td><td>${currentUser.student_id || 'CIQ-2026-401'}</td></tr>
        <tr><td>Semester</td><td>Semester ${currentUser.semester || 4}</td></tr>
        <tr><td>Database Sync</td><td><span style="color:#28a981;font-weight:700">● Live Connected</span></td></tr>
      </table>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn-action-sm secondary" style="flex:1;padding:11px" onclick="document.getElementById('featureClose').click()">Close</button>
        <button class="btn-action-sm" style="flex:1;padding:11px;background:#e53935" id="profileSignOutBtn">Sign Out</button>
      </div>
    `;
    openFeatureModal('Your Student Profile', 'Verified credentials from Supabase PostgreSQL', html);
    const signoutBtn = document.getElementById('profileSignOutBtn');
    if (signoutBtn) {
      signoutBtn.onclick = () => {
        closeFeatureModal();
        $('#signInBtn').click();
      };
    }
  };

  // Help Button
  $('#helpBtn').onclick = () => {
    const html = `
      <p style="font-size:13px;line-height:1.7;color:var(--muted);margin-bottom:15px">
        Welcome to <b>CampusIQ</b> — connected directly to your <b>Supabase PostgreSQL database</b>.
      </p>
      <div class="feature-card" style="margin-bottom:10px">
        <div class="feature-card-content">
          <b>◈ Overview:</b> Live attendance stats, timetable schedules, and quick actions.<br>
          <b>▤ Academics:</b> Course search, assignments manager, and study plans.<br>
          <b>◷ Attendance:</b> Live records with <b>+ Present</b> / <b>+ Absent</b> logger.<br>
          <b>✦ Events:</b> Real event registrations stored directly in PostgreSQL.<br>
          <b>⌂ Facilities:</b> Live space availability and instant seat booking.<br>
          <b>⌁ AI Insights:</b> Context-aware daily briefings based on your actual records.
        </div>
      </div>
      <div style="background:#f4f3fb;padding:12px;border-radius:10px;font-size:11px;margin-top:12px;color:#555">
        <b>Default Login Credentials:</b><br>
        • Student: <code>student@campusiq.edu</code> / <code>CampusIQ@2026</code><br>
        • Admin: <code>admin@campusiq.edu</code> / <code>AdminIQ@2026</code>
      </div>
      <button class="primary" style="width:100%;margin-top:18px" onclick="document.getElementById('featureClose').click()">Start Exploring ↗</button>
    `;
    openFeatureModal('CampusIQ System Guide', 'Architecture & live features overview', html);
  };

  // Notifications Bell
  $('#notify').onclick = async () => {
    try {
      const res = await api('/api/notifications');
      const list = res.notifications || [];
      const html = list.length === 0 ? '<div class="empty">No notifications at this time.</div>' : `
        <div class="feature-list">
          ${list.map(n => `
            <div class="feature-card" style="${n.is_read ? 'opacity:0.75;' : 'border-left:4px solid #7c6cf0;'}">
              <div class="feature-card-content">
                <div class="feature-card-title">${n.title}</div>
                <div class="feature-card-desc">${n.message}</div>
                <div class="feature-card-meta">${new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · ${n.type.toUpperCase()}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="btn-action-sm secondary" style="width:100%;margin-top:15px;padding:10px" id="markAllReadBtn">Mark all as read ✓</button>
      `;
      openFeatureModal('Campus Notifications', `${list.length} recent notification${list.length===1?'':'s'}`, html);
      const markBtn = document.getElementById('markAllReadBtn');
      if (markBtn) {
        markBtn.onclick = async () => {
          await api('/api/notifications/read-all', { method: 'POST' });
          toast('All notifications marked as read.');
          $('#notifBadge').hidden = true;
          $('#notifDot').style.display = 'none';
          closeFeatureModal();
        };
      }
    } catch (e) {
      modal('Notifications', 'Could not load notifications from server.');
    }
  };

  // ===================== DATA LOADERS =====================

  // Load Overview Data
  async function loadOverview() {
    try {
      const data = await api('/api/overview');
      if (data.attendance) {
        const rateEl = document.querySelector('.s-blue strong');
        if (rateEl) rateEl.innerHTML = `${data.attendance.rate}<small>%</small>`;
        const f1 = document.querySelector('.f1 b');
        if (f1) f1.textContent = `${data.attendance.rate}%`;
      }
      if (data.spaces) {
        const spaceEl = document.querySelector('.s-green strong');
        if (spaceEl) spaceEl.innerHTML = `${data.spaces.available}<small class="muted"> / ${data.spaces.total}</small>`;
        const spaceSub = document.querySelector('.s-green small');
        if (spaceSub) spaceSub.textContent = `${data.spaces.occupied} spaces currently occupied`;
      }
      if (data.eventsCount !== undefined) {
        const evEl = document.querySelector('.s-orange strong');
        if (evEl) evEl.textContent = String(data.eventsCount).padStart(2, '0');
      }
      if (data.unreadNotifications > 0) {
        $('#notifBadge').hidden = false;
        $('#notifBadge').textContent = data.unreadNotifications;
        $('#notifDot').style.display = 'block';
      } else {
        $('#notifBadge').hidden = true;
        $('#notifDot').style.display = 'none';
      }
    } catch (err) {
      console.log('Using static overview fallback');
    }
  }

  // Load Academics
  async function loadAcademics() {
    try {
      const { courses } = await api('/api/academics');
      if (!courses || courses.length === 0) return;
      const subjectsEl = $('#subjects');
      if (subjectsEl) {
        subjectsEl.innerHTML = courses.map(c => `
          <article class="subject" data-search="${c.search_terms || (c.title + ' ' + c.instructor + ' ' + c.room).toLowerCase()}">
            <div class="subject-icon ${c.color === 'blue' ? 'blue-bg' : c.color === 'purple' ? 'purple-bg' : c.color === 'orange' ? 'orange-bg' : 'mint-bg'}">⌘</div>
            <label>${c.type}</label>
            <h3>${c.title}</h3>
            <p>${c.instructor} · ${c.room}</p>
            <div class="meta">◷ ${c.schedule_time} <span>${c.credits} credits</span></div>
            <div class="progress ${c.color}"><i style="width:${c.progress}%"></i></div>
            <small>Course progress <b>${c.progress}%</b></small>
          </article>
        `).join('');
      }
    } catch (err) {
      console.log('Academics loaded from static fallback');
    }
  }

  // Academics Search
  $('#classSearch').addEventListener('input', e => {
    let q = e.target.value.toLowerCase().trim(), count = 0;
    $$('.subject').forEach(c => {
      let ok = c.dataset.search.includes(q);
      c.hidden = !ok;
      if (ok) count++;
    });
    $('#subjectCount').textContent = count + ' subject' + (count === 1 ? '' : 's');
    let empty = $('.subject-empty');
    if (!count && !empty) {
      empty = document.createElement('div');
      empty.className = 'empty subject-empty';
      empty.textContent = 'No subjects found. Try another search.';
      $('#subjects').append(empty);
    } else if (count && empty) empty.remove();
  });

  // ACADEMIC SHORTCUT 1: ASSIGNMENTS
  async function openAssignmentsModal() {
    try {
      const { assignments } = await api('/api/assignments');
      const html = assignments.length === 0 ? '<div class="empty">No assignments due.</div>' : `
        <div class="feature-list">
          ${assignments.map(a => `
            <div class="feature-card">
              <div class="feature-card-content">
                <div class="feature-card-title">
                  <b>${a.course_code}:</b> ${a.title}
                  <span class="badge-tag" style="background:${a.status === 'submitted' ? '#e7faf3;color:#28a981' : '#fff4e5;color:#e88a38'};font-size:9px;padding:3px 6px;border-radius:5px;font-weight:700">
                    ${a.status.toUpperCase()} ${a.score ? `(${a.score}%)` : ''}
                  </span>
                </div>
                <div class="feature-card-desc">${a.description || 'Course assignment task'}</div>
                <div class="feature-card-meta">
                  📅 Due: ${new Date(a.due_date).toLocaleDateString()}
                </div>
              </div>
              <button class="btn-action-sm ${a.status === 'submitted' ? 'done' : ''}" data-assign-id="${a.id}">
                ${a.status === 'submitted' ? 'Submitted ✓' : 'Submit Task ↗'}
              </button>
            </div>
          `).join('')}
        </div>
      `;
      openFeatureModal('Assignments Tracker', 'Manage coursework and deliverables', html);

      $$('[data-assign-id]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.assignId;
          btn.disabled = true;
          try {
            const res = await api(`/api/assignments/${id}/toggle`, { method: 'POST' });
            toast(res.message);
            openAssignmentsModal();
          } catch (err) {
            toast('Failed: ' + err.message);
            btn.disabled = false;
          }
        };
      });
    } catch (e) {
      toast('Could not load assignments.');
    }
  }

  // ACADEMIC SHORTCUT 2: STUDY PLANNER
  async function openStudyPlannerModal() {
    try {
      const { studyPlans } = await api('/api/study-plans');
      const html = `
        <div style="display:flex;gap:8px;margin-bottom:15px">
          <input id="newPlanInput" type="text" placeholder="Add study target (e.g. Revise Chapter 4)..." style="flex:1;height:38px;border:1px solid var(--line);border-radius:9px;padding:0 12px;font-size:12px">
          <input id="newPlanMins" type="number" value="25" min="10" max="180" style="width:65px;height:38px;border:1px solid var(--line);border-radius:9px;padding:0 8px;font-size:12px" title="Duration in minutes">
          <button class="btn-action-sm" id="addPlanBtn" style="height:38px;padding:0 14px">+ Add Goal</button>
        </div>
        <div class="feature-list">
          ${studyPlans.map(p => `
            <div class="feature-card" style="${p.completed ? 'opacity:0.6;' : ''}">
              <div class="feature-card-content">
                <div class="feature-card-title" style="${p.completed ? 'text-decoration:line-through' : ''}">
                  ${p.title}
                </div>
                <div class="feature-card-meta">◷ ${p.duration_mins} Minutes Target Focus</div>
              </div>
              <button class="btn-action-sm ${p.completed ? 'done' : 'secondary'}" data-plan-id="${p.id}">
                ${p.completed ? 'Completed ✓' : 'Mark Done'}
              </button>
            </div>
          `).join('')}
        </div>
      `;
      openFeatureModal('Study Focus Planner', 'Daily study blocks & focus goals', html);

      $$('[data-plan-id]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.planId;
          await api(`/api/study-plans/${id}/toggle`, { method: 'POST' });
          openStudyPlannerModal();
          toast('Study goal updated.');
        };
      });

      $('#addPlanBtn').onclick = async () => {
        const title = $('#newPlanInput').value.trim();
        const mins = $('#newPlanMins').value;
        if (!title) return;
        await api('/api/study-plans/add', {
          method: 'POST',
          body: JSON.stringify({ title, duration_mins: mins })
        });
        toast('Study session added!');
        openStudyPlannerModal();
      };
    } catch (e) {
      toast('Could not load study plans.');
    }
  }

  // ACADEMIC SHORTCUT 3: RESOURCES
  async function openResourcesModal() {
    try {
      const { resources } = await api('/api/resources');
      const html = `
        <div class="feature-list">
          ${resources.map(r => `
            <div class="feature-card">
              <div class="feature-card-content">
                <div class="feature-card-title">${r.title}</div>
                <div class="feature-card-desc">${r.course_code}: ${r.course_title}</div>
                <div class="feature-card-meta">📁 ${r.type}</div>
              </div>
              <button class="btn-action-sm" onclick="alert('Viewing material: ${r.title}')">Open Material ↗</button>
            </div>
          `).join('')}
        </div>
      `;
      openFeatureModal('Course Resources', 'Official lecture slides and notes', html);
    } catch (e) {
      toast('Could not load course resources.');
    }
  }

  // Bind Shortcuts
  $$('.shortcuts button').forEach((b, idx) => {
    b.onclick = () => {
      if (idx === 0) openAssignmentsModal();
      else if (idx === 1) openStudyPlannerModal();
      else if (idx === 2) openResourcesModal();
    };
  });

  // ===================== ATTENDANCE =====================
  async function loadAttendance() {
    try {
      const data = await api('/api/attendance');
      if (!data.breakdown) return;

      const ringText = $('.att-ring b');
      if (ringText) ringText.innerHTML = `${data.overallRate}<small>%</small>`;

      const overallHeld = data.totalHeld;
      const overallAttended = data.totalAttended;
      const attRate = data.overallRate;

      const attContentP = $('.att-content p');
      if (attContentP) {
        attContentP.textContent = attRate >= 75
          ? `You're comfortably above the 75% target (${overallAttended} of ${overallHeld} classes attended). Keep the consistency going.`
          : `Attention: Your attendance is currently at ${attRate}%. Mark upcoming classes as Present to recover.`;
      }

      const tbody = $('#attendanceRows');
      if (tbody) {
        tbody.innerHTML = data.breakdown.map(r => `
          <tr data-rate="${r.rate}" data-course-id="${r.course_id}">
            <td><b>⌘ &nbsp; ${r.title}</b> <small style="display:block;color:#999;font-size:9px">${r.instructor} · ${r.room}</small></td>
            <td>${r.classes_held}</td>
            <td>${r.classes_attended}</td>
            <td><span class="rate">${r.rate}% <i><em style="width:${Math.min(100, r.rate)}%"></em></i></span></td>
            <td><label class="${r.pill}">${r.status}</label></td>
            <td>
              <div class="att-actions">
                <button class="att-btn att-btn-p" title="Log Present class" data-mark="present" data-id="${r.course_id}">+ Present</button>
                <button class="att-btn att-btn-a" title="Log Absent class" data-mark="absent" data-id="${r.course_id}">+ Absent</button>
              </div>
            </td>
          </tr>
        `).join('');

        const thead = $('table thead tr');
        if (thead && thead.children.length === 5) {
          const th = document.createElement('th');
          th.textContent = 'LOG ATTENDANCE';
          thead.appendChild(th);
        }

        $$('[data-mark]').forEach(btn => {
          btn.onclick = async () => {
            const course_id = btn.dataset.id;
            const isPresent = btn.dataset.mark === 'present';
            try {
              const res = await api('/api/attendance/mark', {
                method: 'POST',
                body: JSON.stringify({ course_id, present: isPresent })
              });
              toast(res.message);
              loadAttendance();
              loadOverview();
            } catch (err) {
              toast('Could not update attendance: ' + err.message);
            }
          };
        });
      }

      $('#attendanceCount').textContent = `Showing live database records for ${data.breakdown.length} subjects`;
    } catch (err) {
      console.log('Attendance static fallback used');
    }
  }

  // Attendance Filter Buttons
  $$('[data-att]').forEach(b => b.onclick = () => {
    $$('[data-att]').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    let n = 0;
    $$('#attendanceRows tr').forEach(r => {
      let ok = b.dataset.att === 'all' || +r.dataset.rate < 75;
      r.hidden = !ok;
      if (ok) n++;
    });
    $('#attendanceCount').textContent = 'Showing ' + n + ' subject' + (n === 1 ? '' : 's');
  });

  // ===================== CAMPUS EVENTS =====================
  async function loadEvents() {
    try {
      const { events } = await api('/api/events');
      if (!events || events.length === 0) return;

      const featured = events.find(e => e.is_featured) || events[0];
      const registerHeroBtn = $('#register');
      if (registerHeroBtn && featured) {
        registerHeroBtn.textContent = featured.is_registered ? 'Registered ✓' : 'Register interest ↗';
        registerHeroBtn.style.background = featured.is_registered ? '#28a981' : '';
        registerHeroBtn.onclick = async () => {
          try {
            const res = await api(`/api/events/${featured.id}/register`, { method: 'POST' });
            toast(res.message);
            loadEvents();
          } catch (e) {
            toast('Failed to register: ' + e.message);
          }
        };
      }

      const grid = $('#eventGrid');
      if (grid) {
        const gridEvents = events.filter(e => !e.is_featured);
        grid.innerHTML = gridEvents.map(e => `
          <article class="event-card" data-kind="${e.category}">
            <div class="poster ${e.poster_class || 'hack'}">
              <span>${e.badge || 'CAMPUS EVENT'}</span><i>⌘</i>
            </div>
            <div class="event-card-body">
              <label>${e.category.toUpperCase()} · ${e.date_str}</label>
              <h3>${e.title}</h3>
              <p>${e.description}</p>
              <div>
                ◷ ${e.time_str} · ${e.location}
                <button class="btn-action-sm ${e.is_registered ? 'done' : ''}" data-event-id="${e.id}">
                  ${e.is_registered ? 'Registered ✓' : 'I\'m interested ↗'}
                </button>
              </div>
            </div>
          </article>
        `).join('');

        $$('[data-event-id]').forEach(btn => {
          btn.onclick = async () => {
            const id = btn.dataset.eventId;
            try {
              const res = await api(`/api/events/${id}/register`, { method: 'POST' });
              toast(res.message);
              loadEvents();
            } catch (err) {
              toast('Registration error: ' + err.message);
            }
          };
        });
      }
    } catch (err) {
      console.log('Events static fallback');
    }
  }

  // Events Category Filters
  $$('[data-event]').forEach(b => b.onclick = () => {
    $$('[data-event]').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    $$('#eventGrid .event-card').forEach(c => {
      c.hidden = b.dataset.event !== 'all' && c.dataset.kind !== b.dataset.event;
    });
  });

  // ===================== FACILITIES & BOOKINGS =====================
  let facilitiesData = [];

  async function loadFacilities() {
    try {
      const { facilities } = await api('/api/facilities');
      if (!facilities || facilities.length === 0) return;
      facilitiesData = facilities;

      const totalCap = facilities.reduce((sum, f) => sum + f.total_capacity, 0);
      const occupiedCap = facilities.reduce((sum, f) => sum + f.occupied_capacity, 0);
      const availCap = totalCap - occupiedCap;

      const heroB = document.querySelector('.facility-hero>div+div>b');
      if (heroB) heroB.innerHTML = `${availCap}<span>/${totalCap}</span>`;

      const grid = $('#facilityGrid');
      if (grid) {
        grid.innerHTML = facilities.map(f => {
          const avail = f.total_capacity - f.occupied_capacity;
          const pct = Math.round((f.occupied_capacity / f.total_capacity) * 100);
          return `
            <article class="facility-card" data-kind="${f.category}" data-search="${f.search_terms || f.name.toLowerCase()}">
              <div class="facility-art ${f.art_class || 'lib'}">
                <span>▤</span><label>${f.tag || 'FOCUS ZONE'}</label>
              </div>
              <div class="facility-body">
                <div>
                  <h3>${f.name}</h3>
                  <label class="${f.occupied_capacity >= f.total_capacity ? 'busy' : 'open'}">
                    ● ${f.occupied_capacity >= f.total_capacity ? 'Full' : f.status}
                  </label>
                </div>
                <p>${f.description}</p>
                <small>⌖ ${f.location}<br>◷ ${f.hours}</small>
                <div class="capacity">
                  Seat availability <b>${avail} / ${f.total_capacity}</b>
                  <i><em style="width:${Math.max(10, 100 - pct)}%"></em></i>
                </div>
                <button class="primary" style="margin-top:12px;width:100%" data-book-facility="${f.id}">
                  Book Space ↗
                </button>
              </div>
            </article>
          `;
        }).join('');

        $$('[data-book-facility]').forEach(btn => {
          btn.onclick = () => {
            const fac = facilitiesData.find(x => x.id === btn.dataset.bookFacility);
            if (!fac) return;
            openBookingModal(fac);
          };
        });
      }
    } catch (err) {
      console.log('Facilities static fallback');
    }
  }

  function openBookingModal(facility) {
    const avail = facility.total_capacity - facility.occupied_capacity;
    const html = `
      <div class="feature-card" style="margin-bottom:15px;background:#f0edff;border-color:#ded8ff">
        <div class="feature-card-content">
          <h3 style="margin:0;font:800 15px Manrope">${facility.name}</h3>
          <p style="margin:3px 0 0;font-size:11px;color:#7869ec">⌖ ${facility.location} · ◷ ${facility.hours}</p>
        </div>
        <span class="badge-tag" style="background:#28a981;color:#fff;font-weight:700;font-size:10px;padding:4px 8px;border-radius:6px">
          ${avail} Seats Free
        </span>
      </div>
      <p style="font-size:12px;color:var(--muted);margin:0 0 8px">Select your preferred focus time window:</p>
      <div class="slot-grid">
        <button class="slot-btn selected" data-slot="Next 2 Hours">Next 2 Hours</button>
        <button class="slot-btn" data-slot="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</button>
        <button class="slot-btn" data-slot="Afternoon (2 PM - 5 PM)">Afternoon (2 PM - 5 PM)</button>
        <button class="slot-btn" data-slot="Evening (5 PM - 8 PM)">Evening (5 PM - 8 PM)</button>
      </div>
      <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;font-size:11px;color:var(--muted);margin-bottom:15px">
        ✓ High-speed Campus Wi-Fi &nbsp;•&nbsp; Power Outlets &nbsp;•&nbsp; Desk Reservation
      </div>
      <button class="primary" style="width:100%;padding:13px;font-size:13px" id="confirmBookingBtn">
        Confirm Seat Reservation ↗
      </button>
    `;
    openFeatureModal('Reserve Focus Seat', `Instant confirmation at ${facility.name}`, html);

    let chosenSlot = 'Next 2 Hours';
    $$('.slot-btn').forEach(btn => {
      btn.onclick = () => {
        $$('.slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        chosenSlot = btn.dataset.slot;
      };
    });

    $('#confirmBookingBtn').onclick = async () => {
      const btn = $('#confirmBookingBtn');
      btn.disabled = true;
      btn.textContent = 'Reserving seat…';
      try {
        const res = await api(`/api/facilities/${facility.id}/book`, {
          method: 'POST',
          body: JSON.stringify({ slot_time: chosenSlot })
        });
        toast(res.message);
        closeFeatureModal();
        loadFacilities();
        loadOverview();
      } catch (err) {
        toast('Booking failed: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Confirm Seat Reservation ↗';
      }
    };
  }

  // Facility Filters & Search
  $('#facilitySearch').addEventListener('input', filterFacilitiesUI);
  $$('[data-facility]').forEach(b => b.onclick = () => {
    $$('[data-facility]').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    filterFacilitiesUI();
  });

  function filterFacilitiesUI() {
    let q = $('#facilitySearch').value.toLowerCase().trim();
    let type = $('.facility-filter.selected')?.dataset.facility || 'all';
    let n = 0;
    $$('#facilityGrid .facility-card').forEach(c => {
      let ok = (!q || c.dataset.search.includes(q)) && (type === 'all' || c.dataset.kind === type);
      c.hidden = !ok;
      if (ok) n++;
    });
    let empty = $('.facility-empty');
    if (!n && !empty) {
      empty = document.createElement('div');
      empty.className = 'empty facility-empty';
      empty.textContent = 'No spaces found. Try a different search or filter.';
      $('#facilityGrid').append(empty);
    } else if (n && empty) empty.remove();
  }

  // ===================== AI INSIGHTS =====================
  $('#generate').onclick = async () => {
    const b = $('#generate');
    b.disabled = true;
    b.textContent = 'Consulting CampusIQ Co-Pilot…';

    try {
      const res = await api('/api/insights/generate', { method: 'POST' });
      const d = res.insight;

      const c = document.createElement('article');
      c.className = `insight-card ${d.color || 'lavender'}`;
      c.style.animation = 'pagein .3s ease';

      const label = document.createElement('label');
      label.textContent = '✦  ' + d.category;

      const h = document.createElement('h3');
      h.textContent = d.title;

      const p = document.createElement('p');
      p.textContent = d.content;

      const f = document.createElement('small');
      f.textContent = d.badge || 'JUST GENERATED · LIVE AI';
      f.style.color = '#8c7af0';

      c.append(label, h, p, f);
      $('#insightGrid').prepend(c);

      toast('New context-aware AI brief added!');
    } catch (err) {
      toast('AI generation fallback: ' + err.message);
    } finally {
      b.disabled = false;
      b.textContent = 'Generate another brief ✦';
    }
  };

  // Toast data attribute binding
  $$('[data-toast]').forEach(b => b.onclick = () => toast(b.dataset.toast));

  // ===================== APP INITIALIZATION =====================
  async function initApp() {
    if (authToken) {
      try {
        const res = await api('/api/auth/me');
        if (res.user) {
          currentUser = res.user;
          updateAuthUI();
        }
      } catch (e) {
        localStorage.removeItem('campusiq_token');
        authToken = null;
      }
    }
    updateAuthUI();

    // Data Loaders
    loadOverview();
    loadAcademics();
    loadAttendance();
    loadEvents();
    loadFacilities();

    // Handle initial routing:
    const hash = location.hash.slice(1);
    if (pages.includes(hash)) {
      showAppView(hash);
    } else if (authToken) {
      showAppView('overview');
    } else {
      showLandingView();
    }
  }

  initApp();
})();