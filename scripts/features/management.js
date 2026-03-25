// Wardens
const WARDEN_HOSTEL_MAP_KEY = 'hms-warden-hostel-map';

function getWardenHostelMap() {
  try {
    return JSON.parse(localStorage.getItem(WARDEN_HOSTEL_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveWardenHostelMap(map) {
  localStorage.setItem(WARDEN_HOSTEL_MAP_KEY, JSON.stringify(map));
}

function inferHostelValue(wardenRow) {
  const direct = wardenRow.hostel_id ?? wardenRow.hostel_no ?? wardenRow.host_id ?? wardenRow.hostel;
  if (direct !== undefined && direct !== null && String(direct) !== '') return direct;

  const key = Object.keys(wardenRow).find(k => /hostel|host/i.test(k));
  if (!key) return null;
  const val = wardenRow[key];
  if (val === undefined || val === null || String(val) === '') return null;
  return val;
}

async function fetchWardensCompat() {
  const variants = [
    { id: 'warden_id', hostel: 'hostel_id' },
    { id: 'id', hostel: 'hostel_id' },
    { id: 'warden_id', hostel: 'hostel_no' },
    { id: 'id', hostel: 'hostel_no' },
  ];

  for (const v of variants) {
    const { data, error } = await sb.from('warden').select('*').order(v.id);
    if (!error) return { data: data || [], map: v };
    const msg = (error.message || '').toLowerCase();
    const missingColumn = msg.includes('could not find') || msg.includes('does not exist');
    if (!missingColumn) return { data: null, map: v, error };
  }
  return { data: null, map: { id: 'warden_id', hostel: 'hostel_id' } };
}

async function loadWardens() {
  const { data, map, error } = await fetchWardensCompat();
  const hostelMap = getWardenHostelMap();
  const tbody = document.getElementById('warden-tbody');
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-red-500">Error: ${esc(error.message)}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">No wardens added yet.</td></tr>'; return; }
  tbody.innerHTML = data.map(w => `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td class="px-4 py-3 font-medium dark:text-white">${esc(String(w[map.id] ?? ''))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(w.name)}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(w.mobile || '—')}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(String(w[map.hostel] ?? inferHostelValue(w) ?? hostelMap[String(w[map.id] ?? '')] ?? '—'))}</td>
      <td class="px-4 py-3 text-center">
        <button onclick="deleteWarden('${esc(String(w[map.id] ?? ''))}')" class="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors">Delete</button>
      </td>
    </tr>`).join('');
}

async function deleteWarden(id) {
  if (!confirm('Delete warden ' + id + '?')) return;
  let error = null;
  {
    const byWardenId = await sb.from('warden').delete().eq('warden_id', id);
    error = byWardenId.error;
    const msg = (error?.message || '').toLowerCase();
    if (error && msg.includes("could not find the 'warden_id' column")) {
      const byId = await sb.from('warden').delete().eq('id', id);
      error = byId.error;
    }
  }
  if (error) {
    alert('Error: ' + error.message);
  } else {
    const hostelMap = getWardenHostelMap();
    delete hostelMap[String(id)];
    saveWardenHostelMap(hostelMap);

    const wardenCreds = getWardenCreds();
    delete wardenCreds[String(id)];
    saveWardenCreds(wardenCreds);

    loadWardens();
  }
}

document.getElementById('add-warden-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('aw-id').value.trim();
  const name = document.getElementById('aw-name').value.trim();
  const mobile = document.getElementById('aw-mobile').value.trim();
  const pass = document.getElementById('aw-pass')?.value || '';
  const hostelId = document.getElementById('aw-hostel').value.trim();
  if (!id || !name || !mobile || !hostelId) return;
  let error = null;
  {
    const attempts = [
      { warden_id: id, name, mobile, hostel_id: hostelId },
      { id, name, mobile, hostel_id: hostelId },
      { warden_id: id, name, mobile, hostel_no: hostelId },
      { id, name, mobile, hostel_no: hostelId },
      { warden_id: id, name, mobile, host_id: hostelId },
      { id, name, mobile, host_id: hostelId },
      { warden_id: id, name, mobile, hostel: hostelId },
      { id, name, mobile, hostel: hostelId },
      { warden_id: id, name, mobile },
      { id, name, mobile },
    ];
    for (const row of attempts) {
      const res = await sb.from('warden').insert([row]);
      error = res.error;
      if (!error) break;
      const msg = (error.message || '').toLowerCase();
      const isMissingColumn = msg.includes('schema cache') || msg.includes('could not find') || msg.includes('does not exist');
      if (!isMissingColumn) break;
    }
  }

  if (!error) {
    const hostelMap = getWardenHostelMap();
    hostelMap[String(id)] = hostelId;
    saveWardenHostelMap(hostelMap);

    const wardenCreds = getWardenCreds();
    wardenCreds[String(id)] = pass || mobile;
    saveWardenCreds(wardenCreds);
  }
  showMsg('aw-msg', error ? 'Error: ' + error.message : 'Warden added!', !error);
  if (!error) { document.getElementById('add-warden-form').reset(); loadWardens(); }
});

// Parents
async function loadParents() {
  let data = null;
  {
    const res = await sb.from('parent').select('*, student(name)').order('parent_id');
    if (!res.error) {
      data = res.data;
    } else if ((res.error.message || '').toLowerCase().includes("could not find the 'parent_id' column")) {
      const legacyRes = await sb.from('parent').select('*, student(name)').order('patent_id');
      data = legacyRes.data;
    }
  }
  const tbody = document.getElementById('parent-tbody');
  if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">No parents added yet.</td></tr>'; return; }
  tbody.innerHTML = data.map(p => `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td class="px-4 py-3 font-medium dark:text-white">${esc(String(p.parent_id ?? p.patent_id ?? ''))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(p.name)}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(p.mobile || '—')}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(p.email_id || '—')}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(p.student?.name || String(p.reg_no))}</td>
      <td class="px-4 py-3 text-center">
        <button onclick="deleteParent('${esc(String(p.parent_id ?? p.patent_id ?? ''))}')" class="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors">Delete</button>
      </td>
    </tr>`).join('');
}

async function deleteParent(id) {
  if (!confirm('Delete parent ' + id + '?')) return;
  let error = null;
  {
    const res = await sb.from('parent').delete().eq('parent_id', id);
    error = res.error;
    if (error && (error.message || '').toLowerCase().includes("could not find the 'parent_id' column")) {
      const legacyRes = await sb.from('parent').delete().eq('patent_id', id);
      error = legacyRes.error;
    }
  }
  if (error) alert('Error: ' + error.message); else loadParents();
}

document.getElementById('add-parent-form').addEventListener('submit', async e => {
  e.preventDefault();
  const idRaw = document.getElementById('ap-id').value.trim();
  const name = document.getElementById('ap-name').value.trim();
  const mobile = document.getElementById('ap-mobile').value.trim();
  const email = document.getElementById('ap-email').value.trim();
  const pass = document.getElementById('ap-pass').value;
  const reg = document.getElementById('ap-reg').value;
  if (!idRaw || !name || !mobile || !email || !reg) return;

  const isNumericId = /^\d+$/.test(idRaw);
  const numericId = isNumericId ? parseInt(idRaw, 10) : null;
  const credentialKey = isNumericId ? String(numericId) : idRaw;

  let error = null;
  {
    const parentIdValue = isNumericId ? numericId : idRaw;
    const res = await sb.from('parent').insert([{ parent_id: parentIdValue, name, mobile, email_id: email, reg_no: reg }]);
    error = res.error;
    const msg = (error?.message || '').toLowerCase();

    if (error && msg.includes('invalid input syntax for type integer')) {
      showMsg('ap-msg', 'Parent ID must be numeric in your current database schema (example: 111).', false);
      return;
    }

    if (error && msg.includes("could not find the 'parent_id' column")) {
      const legacyRes = await sb.from('parent').insert([{ patent_id: idRaw, name, mobile, email_id: email, reg_no: reg }]);
      error = legacyRes.error;
    }
  }
  if (!error) {
    const parentCreds = getParentCreds();
    parentCreds[credentialKey] = pass || mobile;
    saveParentCreds(parentCreds);
  }
  showMsg('ap-msg', error ? 'Error: ' + error.message : 'Parent added!', !error);
  if (!error) { document.getElementById('add-parent-form').reset(); loadParents(); }
});

function populateParentStudentDropdown() {
  const opts = '<option value="">Select student...</option>' + allStudents.map(s => `<option value="${esc(String(s.reg_no))}">${esc(String(s.reg_no))} — ${esc(s.name)}</option>`).join('');
  document.getElementById('ap-reg').innerHTML = opts;
}

// Demo Seed: 10 student-parent login pairs
const DEMO_ACCOUNTS_VERSION = 'v2';
const DEMO_ACCOUNTS_SEED_KEY = 'hms-demo-student-parent-seed';
const PARENT_PASSWORD_RESET_KEY = 'hms-parent-password-reset-v1';
const PARENT_PURGE_ONCE_KEY = 'hms-parent-purge-once-v1';

async function purgeAllParentsOnce() {
  if (localStorage.getItem(PARENT_PURGE_ONCE_KEY) === 'done') return;

  let error = null;

  // Try broad delete by a common column first.
  {
    const res = await sb.from('parent').delete().neq('reg_no', '');
    error = res.error;
  }

  // Fallbacks for schema drift.
  if (error) {
    const msg = (error.message || '').toLowerCase();
    const schemaIssue = msg.includes('could not find') || msg.includes('does not exist') || msg.includes('schema cache');
    if (schemaIssue) {
      const byParentId = await sb.from('parent').delete().not('parent_id', 'is', null);
      error = byParentId.error;
      if (error) {
        const msg2 = (error.message || '').toLowerCase();
        if (msg2.includes('could not find') || msg2.includes('does not exist') || msg2.includes('schema cache')) {
          const byLegacyId = await sb.from('parent').delete().not('patent_id', 'is', null);
          error = byLegacyId.error;
        }
      }
    }
  }

  if (!error) {
    saveParentCreds({});
    localStorage.setItem(PARENT_PURGE_ONCE_KEY, 'done');
  }
}

async function ensureDemoStudentParentAccounts() {
  const seedState = localStorage.getItem(DEMO_ACCOUNTS_SEED_KEY);
  const shouldEnsureDbRows = seedState !== DEMO_ACCOUNTS_VERSION;

  const demoPairs = [
    { regNo: '112', studentName: 'Arjun Kumar', branch: 'CSE', year: 1, studentMobile: '9000001112', parentId: '112', parentName: 'Ravi Kumar', parentMobile: '9100001112' },
    { regNo: '113', studentName: 'Divya R', branch: 'ECE', year: 2, studentMobile: '9000001113', parentId: '113', parentName: 'Lakshmi R', parentMobile: '9100001113' },
    { regNo: '114', studentName: 'Karthik S', branch: 'EEE', year: 1, studentMobile: '9000001114', parentId: '114', parentName: 'Suresh S', parentMobile: '9100001114' },
    { regNo: '115', studentName: 'Meera P', branch: 'IT', year: 3, studentMobile: '9000001115', parentId: '115', parentName: 'Priya P', parentMobile: '9100001115' },
    { regNo: '116', studentName: 'Naveen B', branch: 'MECH', year: 2, studentMobile: '9000001116', parentId: '116', parentName: 'Balaji B', parentMobile: '9100001116' },
    { regNo: '117', studentName: 'Sneha V', branch: 'CIVIL', year: 4, studentMobile: '9000001117', parentId: '117', parentName: 'Vasanthi V', parentMobile: '9100001117' },
    { regNo: '118', studentName: 'Rahul T', branch: 'CSE', year: 2, studentMobile: '9000001118', parentId: '118', parentName: 'Thangaraj T', parentMobile: '9100001118' },
    { regNo: '119', studentName: 'Ananya M', branch: 'ECE', year: 1, studentMobile: '9000001119', parentId: '119', parentName: 'Mohan M', parentMobile: '9100001119' },
    { regNo: '120', studentName: 'Vikram N', branch: 'AIDS', year: 3, studentMobile: '9000001120', parentId: '120', parentName: 'Nirmala N', parentMobile: '9100001120' },
    { regNo: '121', studentName: 'Keerthi A', branch: 'BME', year: 2, studentMobile: '9000001121', parentId: '121', parentName: 'Arun A', parentMobile: '9100001121' },
  ];

  let roomNos = [];
  if (shouldEnsureDbRows) {
    const { data: rooms } = await sb.from('room').select('room_no').order('room_no');
    roomNos = (rooms || []).map(r => r.room_no).filter(v => v !== null && v !== undefined);
  }

  const studentCreds = getStudentCreds();
  const parentCreds = getParentCreds();

  // One-time bulk reset for easier parent login during testing.
  if (localStorage.getItem(PARENT_PASSWORD_RESET_KEY) !== 'done') {
    Object.keys(parentCreds).forEach(id => {
      parentCreds[id] = '12345';
    });
    localStorage.setItem(PARENT_PASSWORD_RESET_KEY, 'done');
  }

  for (let i = 0; i < demoPairs.length; i += 1) {
    const pair = demoPairs[i];
    const roomNo = roomNos.length > 0 ? roomNos[i % roomNos.length] : null;

    if (shouldEnsureDbRows) {
      // Ensure student exists
      const studentCheck = await sb.from('student').select('reg_no').eq('reg_no', pair.regNo).maybeSingle();
      if (!studentCheck.error && !studentCheck.data) {
        const studentRow = {
          reg_no: pair.regNo,
          name: pair.studentName,
          branch: pair.branch,
          year: pair.year,
          room_no: roomNo,
          mobile: pair.studentMobile,
          email_id: `student${pair.regNo}@hms.local`,
        };
        await sb.from('student').insert([studentRow]);
      }

      // Ensure parent exists (support parent_id and legacy patent_id)
      let parentExists = false;
      {
        const byParentId = await sb.from('parent').select('parent_id').eq('parent_id', pair.parentId).maybeSingle();
        if (!byParentId.error && byParentId.data) {
          parentExists = true;
        } else {
          const byLegacyId = await sb.from('parent').select('patent_id').eq('patent_id', pair.parentId).maybeSingle();
          if (!byLegacyId.error && byLegacyId.data) parentExists = true;
        }
      }

      if (!parentExists) {
        const parentNumeric = parseInt(pair.parentId, 10);
        let insertError = null;
        {
          const res = await sb.from('parent').insert([{
            parent_id: Number.isNaN(parentNumeric) ? pair.parentId : parentNumeric,
            name: pair.parentName,
            mobile: pair.parentMobile,
            email_id: `parent${pair.parentId}@hms.local`,
            reg_no: pair.regNo,
          }]);
          insertError = res.error;
        }

        if (insertError) {
          const msg = (insertError.message || '').toLowerCase();
          if (msg.includes("could not find the 'parent_id' column")) {
            await sb.from('parent').insert([{
              patent_id: pair.parentId,
              name: pair.parentName,
              mobile: pair.parentMobile,
              email_id: `parent${pair.parentId}@hms.local`,
              reg_no: pair.regNo,
            }]);
          }
        }
      }
    }

    studentCreds[pair.regNo] = `${pair.regNo}${pair.regNo}`;
    parentCreds[pair.parentId] = '12345';
  }

  saveStudentCreds(studentCreds);
  saveParentCreds(parentCreds);
  if (shouldEnsureDbRows) {
    localStorage.setItem(DEMO_ACCOUNTS_SEED_KEY, DEMO_ACCOUNTS_VERSION);
  }
}

// Admin: Manage Students
function renderAdminStudents(list) {
  const tbody = document.getElementById('admin-student-tbody');
  if (!list || list.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">No students found.</td></tr>'; return; }
  tbody.innerHTML = list.map(s => `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td class="px-4 py-3 font-medium dark:text-white">${esc(String(s.reg_no))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(s.name)}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(s.branch)}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(String(s.year ?? ''))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(String(s.room_no ?? ''))}</td>
      <td class="px-4 py-3 text-center">
        <button onclick="deleteStudent('${esc(String(s.reg_no))}')" class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors">Delete</button>
      </td>
    </tr>`).join('');
}

document.getElementById('admin-student-search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderAdminStudents(allStudents.filter(s => String(s.reg_no).toLowerCase().includes(q) || (s.name||'').toLowerCase().includes(q)));
});

document.getElementById('add-student-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (currentRole !== 'admin' && currentRole !== 'warden') {
    showMsg('as-msg', 'Only warden/admin can manage room members.', false);
    return;
  }
  const btn = document.getElementById('as-submit');
  const regNo = document.getElementById('as-reg').value.trim();
  const name = document.getElementById('as-name').value.trim();
  const branch = document.getElementById('as-branch').value.trim();
  const mobile = document.getElementById('as-mobile').value.trim();
  const email = document.getElementById('as-email').value.trim();
  const year = parseInt(document.getElementById('as-year').value);
  const roomVal = document.getElementById('as-room').value.trim();
  const roomNo = roomVal ? parseInt(roomVal) : null;
  if (!regNo || !name || !branch || !year) return;
  btn.disabled = true; btn.textContent = 'Adding...';
  const { error } = await sb.from('student').insert([{ reg_no: regNo, name, branch, year, room_no: roomNo, mobile: mobile || null, email_id: email || null }]);
  btn.disabled = false; btn.textContent = 'Add Student';
  showMsg('as-msg', error ? 'Error: ' + error.message : 'Student added!', !error);
  if (!error) { document.getElementById('add-student-form').reset(); await loadStudents(); renderAdminStudents(allStudents); loadRooms(); loadOverviewStats(); populateRoomDropdown(); loadRecentActivity(); }
});

async function deleteStudent(regNo) {
  if (currentRole !== 'admin' && currentRole !== 'warden') {
    alert('Only warden/admin can manage room members.');
    return;
  }
  if (!confirm('Delete student ' + regNo + '?')) return;
  const { error } = await sb.from('student').delete().eq('reg_no', regNo);
  if (error) { alert('Error: ' + error.message); return; }
  await loadStudents(); renderAdminStudents(allStudents); loadRooms(); loadOverviewStats(); populateRoomDropdown(); loadRecentActivity();
}

async function deleteAllStudents() {
  if (currentRole !== 'admin' && currentRole !== 'warden') {
    alert('Only warden/admin can manage room members.');
    return;
  }
  if (!allStudents || allStudents.length === 0) { alert('No students to delete.'); return; }
  if (!confirm('Delete ALL ' + allStudents.length + ' students? This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure?')) return;
  const { error } = await sb.from('student').delete().neq('reg_no', '');
  if (error) { alert('Error: ' + error.message); return; }
  await loadStudents(); renderAdminStudents(allStudents); loadRooms(); loadOverviewStats(); populateRoomDropdown(); loadRecentActivity();
}

// Admin: Manage Rooms
async function renderAdminRooms() {
  const { data: rooms } = await sb.from('room').select('room_no, capacity, hostel_id');
  const { data: students } = await sb.from('student').select('room_no');
  const occupancy = {};
  (students || []).forEach(s => { occupancy[s.room_no] = (occupancy[s.room_no] || 0) + 1; });
  const tbody = document.getElementById('admin-room-tbody');
  if (!rooms || rooms.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">No rooms found.</td></tr>'; return; }
  tbody.innerHTML = rooms.map(r => {
    const used = occupancy[r.room_no] || 0;
    const avail = r.capacity - used;
    const canDelete = used === 0;
    return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td class="px-4 py-3 font-medium dark:text-white">${esc(String(r.room_no))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(String(r.hostel_id))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${r.capacity}</td>
      <td class="px-4 py-3 dark:text-gray-300">${used}</td>
      <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-full ${avail<=0?'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300':'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'}">${avail} bed${avail!==1?'s':''}</span></td>
      <td class="px-4 py-3 text-center">
        ${canDelete ? `<button onclick="deleteRoom(${r.room_no})" class="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors">Delete</button>` : '<span class="text-xs text-gray-400">Occupied</span>'}
      </td>
    </tr>`;
  }).join('');
}

document.getElementById('add-room-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('ar-submit');
  const roomNo = parseInt(document.getElementById('ar-roomno').value);
  const capacity = parseInt(document.getElementById('ar-capacity').value);
  const hostelId = document.getElementById('ar-hostel').value.trim();
  if (!roomNo || !capacity || !hostelId) return;
  btn.disabled = true; btn.textContent = 'Creating...';
  const { error } = await sb.from('room').insert([{ room_no: roomNo, capacity, hostel_id: hostelId }]);
  btn.disabled = false; btn.textContent = 'Create Room';
  showMsg('ar-msg', error ? 'Error: ' + error.message : 'Room created!', !error);
  if (!error) { document.getElementById('add-room-form').reset(); await loadRooms(); renderAdminRooms(); populateRoomDropdown(); loadOverviewStats(); }
});

async function deleteRoom(roomNo) {
  if (!confirm('Delete room ' + roomNo + '?')) return;
  const { error } = await sb.from('room').delete().eq('room_no', roomNo);
  if (error) { alert('Error: ' + error.message); return; }
  await loadRooms(); renderAdminRooms(); populateRoomDropdown(); loadOverviewStats();
}
