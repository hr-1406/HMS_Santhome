// Role/session presentation behavior
(function initAuthSession() {
  function showDashboard(role) {
    currentRole = role;
    if (role !== 'student') currentStudentReg = null;
    if (role !== 'parent') {
      currentParentId = null;
      currentParentReg = null;
    }
    if (role !== 'warden') currentWardenId = null;

    const loginScreen = document.getElementById('login-screen');
    const roleText = document.getElementById('role-text');
    const roleBadge = document.getElementById('role-badge');
    const logoutBtn = document.getElementById('logout-btn');
    const movementActionsHead = document.getElementById('movement-actions-head');

    if (loginScreen) loginScreen.classList.add('hidden');

    const sidebarLink = sec => document.querySelector('.sidebar-link[data-section="' + sec + '"]');
    const setLinkHidden = (sec, hidden) => {
      const el = sidebarLink(sec);
      if (!el) return;
      el.classList.toggle('hidden', hidden);
    };

    ['overview', 'rooms', 'students', 'lodge', 'complaints', 'movement', 'mess', 'payments'].forEach(sec => setLinkHidden(sec, false));
    ['manage', 'manage-rooms', 'manage-wardens', 'manage-parents'].forEach(sec => setLinkHidden(sec, true));

    if (role === 'admin') {
      roleText.textContent = 'Admin';
      roleBadge.className = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300';
      document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
      setLinkHidden('manage', false);
      setLinkHidden('manage-rooms', false);
      setLinkHidden('manage-wardens', false);
      setLinkHidden('manage-parents', false);
      logoutBtn.classList.remove('hidden');
      movementActionsHead.classList.remove('hidden');
    } else if (role === 'warden') {
      roleText.textContent = 'Warden (' + currentWardenId + ')';
      roleBadge.className = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300';
      document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
      setLinkHidden('manage', false);
      setLinkHidden('manage-rooms', false);
      logoutBtn.classList.remove('hidden');
      movementActionsHead.classList.remove('hidden');
    } else if (role === 'parent') {
      roleText.textContent = 'Parent (' + currentParentId + ')';
      roleBadge.className = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300';
      document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
      setLinkHidden('rooms', true);
      setLinkHidden('students', true);
      setLinkHidden('lodge', true);
      setLinkHidden('mess', true);
      setLinkHidden('complaints', true);
      logoutBtn.classList.remove('hidden');
      movementActionsHead.classList.remove('hidden');
    } else if (role === 'student') {
      roleText.textContent = 'Student (' + currentStudentReg + ')';
      roleBadge.className = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300';
      document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
      setLinkHidden('rooms', true);
      setLinkHidden('students', true);
      setLinkHidden('payments', true);
      logoutBtn.classList.remove('hidden');
      movementActionsHead.classList.add('hidden');
    } else {
      roleText.textContent = 'Guest';
      roleBadge.className = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
      document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
      logoutBtn.classList.remove('hidden');
      movementActionsHead.classList.add('hidden');
    }

    if (typeof loadRecentActivity === 'function') {
      loadRecentActivity();
    }
  }

  function hydrateSavedSession() {
    const savedRole = sessionStorage.getItem('hms-role');
    const savedStudentReg = sessionStorage.getItem('student-reg');
    const savedParentId = sessionStorage.getItem('parent-id');
    const savedParentReg = sessionStorage.getItem('parent-reg');
    const savedWardenId = sessionStorage.getItem('warden-id');

    if (savedRole === 'student' && savedStudentReg) {
      currentStudentReg = savedStudentReg;
      showDashboard('student');
    } else if (savedRole === 'warden' && savedWardenId) {
      currentWardenId = savedWardenId;
      showDashboard('warden');
    } else if (savedRole === 'parent' && savedParentId) {
      currentParentId = savedParentId;
      currentParentReg = savedParentReg;
      showDashboard('parent');
    } else if (savedRole) {
      showDashboard(savedRole);
    }
  }

  function wireGuestAndLogout() {
    const guestBtn = document.getElementById('guest-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        currentStudentReg = null;
        currentParentId = null;
        currentParentReg = null;
        currentWardenId = null;
        sessionStorage.setItem('hms-role', 'guest');
        sessionStorage.removeItem('student-reg');
        sessionStorage.removeItem('parent-id');
        sessionStorage.removeItem('parent-reg');
        sessionStorage.removeItem('warden-id');
        showDashboard('guest');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('hms-role');
        sessionStorage.removeItem('student-reg');
        sessionStorage.removeItem('parent-id');
        sessionStorage.removeItem('parent-reg');
        sessionStorage.removeItem('warden-id');

        currentRole = null;
        currentStudentReg = null;
        currentParentId = null;
        currentParentReg = null;
        currentWardenId = null;

        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
        if (document.getElementById('login-role')) document.getElementById('login-role').value = 'student';
        document.getElementById('login-error').classList.add('hidden');
        document.getElementById('signup-reg').value = '';
        document.getElementById('signup-pass').value = '';
        document.getElementById('signup-pass2').value = '';
        document.getElementById('signup-error').classList.add('hidden');

        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.getElementById('logout-btn').classList.add('hidden');

        if (window.hmsAuthUi && typeof window.hmsAuthUi.showLogin === 'function') {
          window.hmsAuthUi.showLogin();
        }

        if (typeof links !== 'undefined' && links && typeof sections !== 'undefined' && sections) {
          links.forEach(l => l.classList.remove('active'));
          const overviewLink = document.querySelector('[data-section="overview"]');
          if (overviewLink) overviewLink.classList.add('active');
          sections.forEach(s => s.classList.remove('active'));
          const overviewSection = document.getElementById('section-overview');
          if (overviewSection) overviewSection.classList.add('active');
        }

        const pageTitle = document.getElementById('page-title');
        const pageSubtitle = document.getElementById('page-subtitle');
        if (pageTitle) pageTitle.textContent = 'Overview';
        if (pageSubtitle) pageSubtitle.textContent = 'Welcome to the Hostel Management Dashboard';
      });
    }
  }

  window.showDashboard = showDashboard;
  wireGuestAndLogout();
  hydrateSavedSession();
})();
