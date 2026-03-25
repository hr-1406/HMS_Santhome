// Auth
// Form toggle for login/signup
document.getElementById('form-toggle-login').addEventListener('click', () => {
  document.getElementById('form-toggle-login').classList.add('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
  document.getElementById('form-toggle-login').classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('form-toggle-signup').classList.remove('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
  document.getElementById('form-toggle-signup').classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
});

document.getElementById('form-toggle-signup').addEventListener('click', () => {
  document.getElementById('form-toggle-signup').classList.add('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
  document.getElementById('form-toggle-signup').classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('form-toggle-login').classList.remove('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
  document.getElementById('form-toggle-login').classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.remove('hidden');
});

// Unified Login
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  // Check if admin
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    errEl.classList.add('hidden');
    sessionStorage.setItem('hms-role', 'admin');
    showDashboard('admin');
    return;
  }

  // Check if parent (support both parent_id and legacy patent_id)
  let parent = null;
  {
    const res = await sb.from('parent').select('parent_id, reg_no, mobile').eq('parent_id', user).single();
    if (!res.error) {
      parent = res.data;
    } else if ((res.error.message || '').toLowerCase().includes("could not find the 'parent_id' column")) {
      const legacyRes = await sb.from('parent').select('patent_id, reg_no, mobile').eq('patent_id', user).single();
      if (!legacyRes.error) parent = legacyRes.data;
    }
  }
  if (parent) {
    const parentCreds = getParentCreds();
    const fallbackPass = String(parent.mobile || '').trim();
    const expectedPass = Object.prototype.hasOwnProperty.call(parentCreds, user) ? parentCreds[user] : fallbackPass;

    if (!expectedPass) {
      errEl.textContent = 'No parent credentials are set. Ask admin to set parent login password.';
      errEl.classList.remove('hidden');
      return;
    }
    if (pass !== expectedPass) {
      errEl.textContent = 'Incorrect parent password.';
      errEl.classList.remove('hidden');
      return;
    }

    errEl.classList.add('hidden');
    currentParentId = user;
    currentParentReg = String(parent.reg_no || '');
    sessionStorage.setItem('hms-role', 'parent');
    sessionStorage.setItem('parent-id', currentParentId);
    sessionStorage.setItem('parent-reg', currentParentReg);
    await loadStudents();
    showDashboard('parent');
    return;
  }

  // Check if student
  const { data: student } = await sb.from('student').select('reg_no').eq('reg_no', user).single();
  if (!student) {
    errEl.textContent = 'Invalid username or password.';
    errEl.classList.remove('hidden');
    return;
  }

  // Validate student password from in-app credentials store
  const creds = getStudentCreds();
  if (!Object.prototype.hasOwnProperty.call(creds, user)) {
    errEl.textContent = 'No password set for this registration number yet. Use Sign Up first.';
    errEl.classList.remove('hidden');
    return;
  }
  if (creds[user] !== pass) {
    errEl.textContent = 'Incorrect password for this registration number.';
    errEl.classList.remove('hidden');
    return;
  }

  errEl.classList.add('hidden');
  currentStudentReg = user;
  sessionStorage.setItem('hms-role', 'student');
  sessionStorage.setItem('student-reg', user);
  await loadStudents();
  showDashboard('student');
});

// Student Signup
document.getElementById('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const reg = document.getElementById('signup-reg').value.trim();
  const pass = document.getElementById('signup-pass').value;
  const pass2 = document.getElementById('signup-pass2').value;
  const errEl = document.getElementById('signup-error');

  if (pass !== pass2) {
    errEl.textContent = 'Passwords do not match.';
    errEl.classList.remove('hidden');
    return;
  }
  if (!pass) {
    errEl.textContent = 'Password is required.';
    errEl.classList.remove('hidden');
    return;
  }

  // Check if student reg exists
  const { data: student } = await sb.from('student').select('reg_no').eq('reg_no', reg).single();
  if (!student) {
    errEl.textContent = 'Registration number not found. Contact admin to register.';
    errEl.classList.remove('hidden');
    return;
  }

  const creds = getStudentCreds();
  if (Object.prototype.hasOwnProperty.call(creds, reg)) {
    errEl.textContent = 'Account already exists. Use Login.';
    errEl.classList.remove('hidden');
    return;
  }

  creds[reg] = pass;
  saveStudentCreds(creds);

  errEl.classList.add('hidden');
  currentStudentReg = reg;
  sessionStorage.setItem('hms-role', 'student');
  sessionStorage.setItem('student-reg', reg);
  await loadStudents();
  showDashboard('student');
});

function showDashboard(role) {
  currentRole = role;
  if (role !== 'student') currentStudentReg = null;
  if (role !== 'parent') { currentParentId = null; currentParentReg = null; }
  document.getElementById('login-screen').classList.add('hidden');
  const roleText = document.getElementById('role-text');
  const roleBadge = document.getElementById('role-badge');
  const logoutBtn = document.getElementById('logout-btn');
  const movementActionsHead = document.getElementById('movement-actions-head');
  if (role === 'admin') {
    roleText.textContent = 'Admin';
    roleBadge.className = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    logoutBtn.classList.remove('hidden');
    movementActionsHead.classList.remove('hidden');
  } else if (role === 'parent') {
    roleText.textContent = 'Parent (' + currentParentId + ')';
    roleBadge.className = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    logoutBtn.classList.remove('hidden');
    movementActionsHead.classList.remove('hidden');
  } else if (role === 'student') {
    roleText.textContent = 'Student (' + currentStudentReg + ')';
    roleBadge.className = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    logoutBtn.classList.remove('hidden');
    movementActionsHead.classList.add('hidden');
  } else {
    roleText.textContent = 'Guest';
    roleBadge.className = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    logoutBtn.classList.remove('hidden');
    movementActionsHead.classList.add('hidden');
  }
}

document.getElementById('guest-btn').addEventListener('click', () => {
  currentStudentReg = null;
  currentParentId = null;
  currentParentReg = null;
  sessionStorage.setItem('hms-role', 'guest');
  sessionStorage.removeItem('student-reg');
  sessionStorage.removeItem('parent-id');
  sessionStorage.removeItem('parent-reg');
  showDashboard('guest');
});

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('hms-role');
  sessionStorage.removeItem('student-reg');
  sessionStorage.removeItem('parent-id');
  sessionStorage.removeItem('parent-reg');
  currentRole = null;
  currentStudentReg = null;
  currentParentId = null;
  currentParentReg = null;
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('signup-reg').value = '';
  document.getElementById('signup-pass').value = '';
  document.getElementById('signup-pass2').value = '';
  document.getElementById('signup-error').classList.add('hidden');
  document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  document.getElementById('logout-btn').classList.add('hidden');
  document.getElementById('form-toggle-login').classList.add('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
  document.getElementById('form-toggle-login').classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('form-toggle-signup').classList.remove('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
  document.getElementById('form-toggle-signup').classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
  links.forEach(l => l.classList.remove('active'));
  document.querySelector('[data-section="overview"]').classList.add('active');
  sections.forEach(s => s.classList.remove('active'));
  document.getElementById('section-overview').classList.add('active');
  pageTitle.textContent = 'Overview';
  pageSubtitle.textContent = 'Welcome to the Hostel Management Dashboard';
});

const savedRole = sessionStorage.getItem('hms-role');
const savedStudentReg = sessionStorage.getItem('student-reg');
const savedParentId = sessionStorage.getItem('parent-id');
const savedParentReg = sessionStorage.getItem('parent-reg');
if (savedRole === 'student' && savedStudentReg) {
  currentStudentReg = savedStudentReg;
  showDashboard('student');
} else if (savedRole === 'parent' && savedParentId) {
  currentParentId = savedParentId;
  currentParentReg = savedParentReg;
  showDashboard('parent');
} else if (savedRole) {
  showDashboard(savedRole);
}

// Sidebar Navigation
const links = document.querySelectorAll('.sidebar-link');
const sections = document.querySelectorAll('.section');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

function autoFillStudentForms() {
  if (currentStudentReg) {
    // Find the student record
    const student = allStudents.find(s => String(s.reg_no) === currentStudentReg);
    if (!student) return;

    // Auto-fill complaint form
    const compRegEl = document.getElementById('comp-reg');
    if (compRegEl) {
      compRegEl.value = currentStudentReg;
      compRegEl.disabled = true;
      document.getElementById('comp-reg-wrapper').style.display = 'none';
      document.getElementById('lodge-student-info').classList.remove('hidden');
      document.getElementById('lodge-student-name').textContent = student.name;
      document.getElementById('lodge-student-reg').textContent = student.reg_no;
    }

    // Auto-fill movement request form
    const mvRegEl = document.getElementById('mv-reg');
    if (mvRegEl) {
      mvRegEl.value = currentStudentReg;
      mvRegEl.disabled = true;
      document.getElementById('mv-reg-wrapper').style.display = 'none';
      document.getElementById('movement-student-info').classList.remove('hidden');
      document.getElementById('movement-student-name').textContent = student.name;
      document.getElementById('movement-student-reg').textContent = student.reg_no;
    }
  } else if (currentRole === 'parent' && currentParentReg) {
    const linkedStudent = allStudents.find(s => String(s.reg_no) === String(currentParentReg));

    const compRegEl = document.getElementById('comp-reg');
    if (compRegEl) {
      compRegEl.disabled = false;
      document.getElementById('comp-reg-wrapper').style.display = 'block';
      document.getElementById('lodge-student-info').classList.add('hidden');
    }

    const mvRegEl = document.getElementById('mv-reg');
    if (mvRegEl) {
      mvRegEl.value = currentParentReg;
      mvRegEl.disabled = true;
      document.getElementById('mv-reg-wrapper').style.display = 'none';
      document.getElementById('movement-student-info').classList.remove('hidden');
      document.getElementById('movement-student-name').textContent = linkedStudent?.name || 'Linked Student';
      document.getElementById('movement-student-reg').textContent = currentParentReg;
    }
  } else {
    // Reset for guest/admin - show the selector
    const compRegEl = document.getElementById('comp-reg');
    if (compRegEl) {
      compRegEl.disabled = false;
      document.getElementById('comp-reg-wrapper').style.display = 'block';
      document.getElementById('lodge-student-info').classList.add('hidden');
    }

    const mvRegEl = document.getElementById('mv-reg');
    if (mvRegEl) {
      mvRegEl.disabled = false;
      document.getElementById('mv-reg-wrapper').style.display = 'block';
      document.getElementById('movement-student-info').classList.add('hidden');
    }
  }
}

const meta = {
  overview:        { title: 'Overview',              subtitle: 'Welcome to the Hostel Management Dashboard' },
  rooms:           { title: 'Room Status',           subtitle: 'View room occupancy and available beds' },
  students:        { title: 'Student Directory',     subtitle: 'Browse all registered students' },
  lodge:           { title: 'Lodge Complaint',       subtitle: 'Submit a complaint to hostel administration' },
  complaints:      { title: 'Recent Complaints',     subtitle: 'Live feed of all complaints' },
  movement:        { title: 'Movement Requests',     subtitle: 'In/out movement approvals' },
  mess:            { title: 'Mess',                  subtitle: 'Mess registration and menu management' },
  payments:        { title: 'Payments',              subtitle: 'Payment history and fee tracking' },
  manage:          { title: 'Manage Students',       subtitle: 'Add or remove students from the system' },
  'manage-rooms':  { title: 'Manage Rooms',          subtitle: 'Create or delete rooms in the hostels' },
  'manage-wardens':{ title: 'Manage Wardens',        subtitle: 'Assign wardens to hostels' },
  'manage-parents':{ title: 'Manage Parents',        subtitle: 'Link parents/guardians to students' },
};

const adminSections = ['manage', 'manage-rooms', 'manage-wardens', 'manage-parents'];

links.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const sec = link.dataset.section;
    if (adminSections.includes(sec) && currentRole !== 'admin') return;
    links.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + sec).classList.add('active');
    pageTitle.textContent = meta[sec].title;
    pageSubtitle.textContent = meta[sec].subtitle;
    if (sec === 'manage') { renderAdminStudents(allStudents); populateRoomDropdown(); }
    if (sec === 'manage-rooms') { renderAdminRooms(); populateHostelDropdown('ar-hostel'); }
    if (sec === 'manage-wardens') { loadWardens(); populateHostelDropdown('aw-hostel'); }
    if (sec === 'manage-parents') { loadParents(); populateParentStudentDropdown(); }
    if (sec === 'movement') { loadMovements(); autoFillStudentForms(); }
    if (sec === 'mess') loadMess();
    if (sec === 'payments') loadPayments();
    if (sec === 'complaints') loadComplaints();
    if (sec === 'lodge') { autoFillStudentForms(); }
  });
});

// Dark Mode
const darkToggle = document.getElementById('dark-toggle');
const iconSun = document.getElementById('icon-sun');
const iconMoon = document.getElementById('icon-moon');
const darkLabel = document.getElementById('dark-label');
function updateDarkIcons() {
  const isDark = document.documentElement.classList.contains('dark');
  iconSun.classList.toggle('hidden', !isDark);
  iconMoon.classList.toggle('hidden', isDark);
  darkLabel.textContent = isDark ? 'Light' : 'Dark';
}
updateDarkIcons();
darkToggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('hms-dark', document.documentElement.classList.contains('dark'));
  updateDarkIcons();
});
