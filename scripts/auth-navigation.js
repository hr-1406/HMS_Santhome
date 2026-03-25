// Sidebar Navigation
const links = document.querySelectorAll('.sidebar-link');
const sections = document.querySelectorAll('.section');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

function autoFillStudentForms() {
  if (currentStudentReg) {
    const student = allStudents.find(s => String(s.reg_no) === currentStudentReg);
    if (!student) return;

    const compRegEl = document.getElementById('comp-reg');
    if (compRegEl) {
      compRegEl.value = currentStudentReg;
      compRegEl.disabled = true;
      document.getElementById('comp-reg-wrapper').style.display = 'none';
      document.getElementById('lodge-student-info').classList.remove('hidden');
      document.getElementById('lodge-student-name').textContent = student.name;
      document.getElementById('lodge-student-reg').textContent = student.reg_no;
    }

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

async function setSection(sectionId) {
  links.forEach(l => l.classList.toggle('active', l.dataset.section === sectionId));
  sections.forEach(s => s.classList.toggle('active', s.id === 'section-' + sectionId));

  const titleMap = {
    overview: ['Overview', 'Welcome to the Hostel Management Dashboard'],
    rooms: ['Room Status', 'Current occupancy and availability'],
    students: ['Student Directory', 'Browse all registered students'],
    lodge: ['Lodge Complaint', 'Submit a hostel complaint'],
    complaints: ['Recent Complaints', 'Track and resolve complaint tickets'],
    movement: ['Movement Requests', 'Review outing and gate-pass requests'],
    mess: ['Mess', 'Today\'s menu and meal feedback'],
    payments: ['Payments', 'View and manage student payments'],
    manage: ['Manage Students', 'Add, update, and remove student records'],
    'manage-rooms': ['Manage Rooms', 'Create and delete room inventory'],
    'manage-wardens': ['Manage Wardens', 'Add and maintain warden accounts'],
    'manage-parents': ['Manage Parents', 'Link parent profiles to students'],
  };

  const [title, subtitle] = titleMap[sectionId] || ['Dashboard', ''];
  pageTitle.textContent = title;
  pageSubtitle.textContent = subtitle;

  autoFillStudentForms();

  if (sectionId === 'overview') {
    await loadOverviewStats();
    if (typeof loadRecentActivity === 'function') {
      await loadRecentActivity();
    }
    if (typeof loadOverviewComplaints === 'function') {
      await loadOverviewComplaints();
    }
  }
  if (sectionId === 'rooms') await loadRooms();
  if (sectionId === 'students') await loadStudents();
  if (sectionId === 'complaints') await loadComplaints();
  if (sectionId === 'movement') await loadMovements();
  if (sectionId === 'mess') {
    await loadMessMenu();
    await loadMealFeedback();
  }
  if (sectionId === 'payments') await loadPayments();
  if (sectionId === 'manage') {
    await loadStudents();
    await loadAdminStudents();
    await populateRoomDropdown();
  }
  if (sectionId === 'manage-rooms') {
    await loadRooms();
    await loadAdminRooms();
    await populateHostelDropdown('ar-hostel');
  }
  if (sectionId === 'manage-wardens') {
    await loadWardens();
    await populateHostelDropdown('aw-hostel');
  }
  if (sectionId === 'manage-parents') {
    await loadParents();
    await loadStudents();
  }
}

links.forEach(link => {
  link.addEventListener('click', async e => {
    e.preventDefault();
    const section = link.dataset.section;
    await setSection(section);
  });
});

// Dark mode toggle
const darkToggle = document.getElementById('dark-toggle');
const iconSun = document.getElementById('icon-sun');
const iconMoon = document.getElementById('icon-moon');
const darkLabel = document.getElementById('dark-label');

function syncDarkUI() {
  const isDark = document.documentElement.classList.contains('dark');
  iconSun.classList.toggle('hidden', !isDark);
  iconMoon.classList.toggle('hidden', isDark);
  darkLabel.textContent = isDark ? 'Light' : 'Dark';
}

if (darkToggle) {
  darkToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('hms-dark', String(document.documentElement.classList.contains('dark')));
    syncDarkUI();
  });
}
syncDarkUI();

// Initial data load
(async function init() {
  await loadOverviewStats();
  await loadRooms();
  await loadStudents();
  await loadComplaints();
  await loadMovements();
  await loadMessMenu();
  await loadMealFeedback();
  await loadPayments();
  await loadAdminStudents();
  await loadAdminRooms();
  await loadWardens();
  await loadParents();
  await populateHostelDropdown('ar-hostel');
  await populateHostelDropdown('aw-hostel');
  await populateRoomDropdown();

  if (typeof loadRecentActivity === 'function') {
    await loadRecentActivity();
  }
  if (typeof loadOverviewComplaints === 'function') {
    await loadOverviewComplaints();
  }
})();
