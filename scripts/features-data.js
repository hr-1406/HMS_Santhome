// Overview Stats
async function loadOverviewStats() {
  const [hostels, rooms, students, complaints, payments] = await Promise.all([
    sb.from('hostel').select('hostel_id', { count: 'exact', head: true }),
    sb.from('room').select('room_no', { count: 'exact', head: true }),
    sb.from('student').select('reg_no', { count: 'exact', head: true }),
    sb.from('complaint').select('complaint_id', { count: 'exact', head: true }).eq('status', 'Pending'),
    sb.from('payment').select('payment_id', { count: 'exact', head: true }),
  ]);

  let movements = await sb.from('movement_request').select('request_id', { count: 'exact', head: true }).eq('warden_approval', 'Pending');
  if (movements.error && (movements.error.message || '').toLowerCase().includes("could not find the 'warden_approval' column")) {
    movements = await sb.from('movement_request').select('request_id', { count: 'exact', head: true }).eq('admin_approval', 'Pending');
  }

  document.getElementById('stat-hostels').textContent = hostels.count ?? 0;
  document.getElementById('stat-rooms').textContent = rooms.count ?? 0;
  document.getElementById('stat-students').textContent = students.count ?? 0;
  document.getElementById('stat-complaints').textContent = complaints.count ?? 0;
  document.getElementById('stat-movements').textContent = movements.count ?? 0;
  document.getElementById('stat-payments').textContent = payments.count ?? 0;
}

// Rooms
async function loadRooms() {
  const { data: rooms } = await sb.from('room').select('room_no, capacity, hostel_id, hostel(hostel_name)');
  const { data: students } = await sb.from('student').select('room_no');
  const occupancy = {};
  (students || []).forEach(s => { occupancy[s.room_no] = (occupancy[s.room_no] || 0) + 1; });
  const roomGrid = document.getElementById('room-grid');
  if (!rooms || rooms.length === 0) { roomGrid.innerHTML = '<p class="text-gray-400 text-sm col-span-full">No rooms found.</p>'; return; }
  roomGrid.innerHTML = rooms.map(r => {
    const used = occupancy[r.room_no] || 0;
    const remaining = r.capacity - used;
    const pct = Math.round((used / r.capacity) * 100);
    const color = occupancyColor(remaining, r.capacity);
    const floor = Math.floor((r.room_no % 1000) / 100);
    const hostelName = r.hostel?.hostel_name || 'Hostel ' + r.hostel_id;
    return `<div class="border-2 rounded-xl p-4 ${color} transition-all hover:shadow-md">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold text-indigo-500 uppercase">Floor ${floor}</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">${esc(hostelName)}</span>
      </div>
      <h4 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Room ${esc(String(r.room_no % 1000))}</h4>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div class="h-2 rounded-full ${remaining <= 0 ? 'bg-red-500' : remaining <= Math.ceil(r.capacity/3) ? 'bg-amber-500' : 'bg-emerald-500'}" style="width:${pct}%"></div>
      </div>
      <div class="flex justify-between text-xs text-gray-600 dark:text-gray-300">
        <span>${used} / ${r.capacity} occupied</span>
        <span class="font-semibold">${remaining} bed${remaining !== 1 ? 's' : ''} left</span>
      </div>
    </div>`;
  }).join('');
}

// Students
async function loadStudents() {
  const { data } = await sb.from('student').select('*, room(hostel(hostel_name))');
  allStudents = data || [];
  renderStudents(allStudents);
  populateRegDropdowns(allStudents);
}

function renderStudents(list) {
  const tbody = document.getElementById('student-tbody');
  if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-gray-400">No students found.</td></tr>'; return; }
  tbody.innerHTML = list.map(s => {
    const hostelName = s.room?.hostel?.hostel_name || '';
    return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td class="px-4 py-3 font-medium dark:text-white">${esc(String(s.reg_no))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(s.name)}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(s.branch)}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(String(s.year ?? ''))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(s.mobile || '—')}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(s.email_id || '—')}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(String(s.room_no ?? ''))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(hostelName)}</td>
    </tr>`;
  }).join('');
}

function populateRegDropdowns(students) {
  const opts = '<option value="">Select student...</option>' + students.map(s => `<option value="${esc(String(s.reg_no))}">${esc(String(s.reg_no))} — ${esc(s.name)}</option>`).join('');
  ['comp-reg','mv-reg','mess-reg','pay-reg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

document.getElementById('student-search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderStudents(allStudents.filter(s => String(s.reg_no).toLowerCase().includes(q) || (s.name||'').toLowerCase().includes(q)));
});

// Complaints
async function loadComplaints() {
  const { data } = await sb.from('complaint').select('*, student(name)').order('complaint_id', { ascending: false });
  renderComplaints(data || []);
}

function renderComplaints(list) {
  const container = document.getElementById('complaints-list');
  const overview = document.getElementById('overview-complaints');
  if (list.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm">No complaints yet.</p>';
    overview.innerHTML = '<p class="text-gray-400 text-sm">No complaints yet.</p>';
    return;
  }
  const canManageComplaints = currentRole === 'admin' || currentRole === 'warden';
  const isDoneStatus = status => {
    const value = String(status || '').toLowerCase();
    return value === 'done' || value === 'resolved' || value === 'completed';
  };
  const renderCard = c => `
    <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-sm transition-shadow dark:bg-gray-700">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">${esc(c.description || '')}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">By <span class="font-medium">${esc(c.student?.name || String(c.reg_no))}</span> &middot; #${esc(String(c.complaint_id))}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          ${statusBadge(c.status)}
          ${canManageComplaints ? `<select onchange="updateComplaintStatus(${c.complaint_id}, this.value)" class="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none">
            <option value="">Update...</option>
            <option value="Pending" ${c.status==='Pending'?'selected':''}>Pending</option>
            <option value="In Progress" ${c.status==='In Progress'?'selected':''}>In Progress</option>
            <option value="Done" ${String(c.status||'').toLowerCase()==='done'?'selected':''}>Done</option>
          </select>` : ''}
          ${canManageComplaints && isDoneStatus(c.status) ? `<button onclick="deleteComplaint(${c.complaint_id})" class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors">Delete</button>` : ''}
        </div>
      </div>
    </div>`;
  container.innerHTML = list.map(renderCard).join('');
  overview.innerHTML = list.slice(0, 5).map(renderCard).join('');
}

async function updateComplaintStatus(id, status) {
  if (currentRole !== 'admin' && currentRole !== 'warden') {
    showMsg('comp-msg', 'Only warden/admin can update complaint status.', false);
    return;
  }
  if (!status) return;
  const { error } = await sb.from('complaint').update({ status }).eq('complaint_id', id);
  if (!error) { loadComplaints(); loadOverviewStats(); }
}

async function deleteComplaint(id) {
  if (currentRole !== 'admin' && currentRole !== 'warden') {
    showMsg('comp-msg', 'Only warden/admin can delete complaints.', false);
    return;
  }

  const { data: complaint, error: fetchError } = await sb
    .from('complaint')
    .select('status')
    .eq('complaint_id', id)
    .single();

  if (fetchError) {
    showMsg('comp-msg', 'Error: ' + fetchError.message, false);
    return;
  }

  const status = String(complaint?.status || '').toLowerCase();
  if (status !== 'done' && status !== 'resolved' && status !== 'completed') {
    showMsg('comp-msg', 'Only complaints marked done can be deleted.', false);
    return;
  }

  if (!confirm('Delete complaint #' + id + '?')) return;

  const { error } = await sb.from('complaint').delete().eq('complaint_id', id);
  if (error) {
    showMsg('comp-msg', 'Error: ' + error.message, false);
    return;
  }

  showMsg('comp-msg', 'Complaint deleted.', true);
  loadComplaints();
  loadOverviewStats();
}

document.getElementById('complaint-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('comp-submit');
  let regNo = document.getElementById('comp-reg').value;

  // If student is logged in, use their reg_no
  if (currentStudentReg) {
    regNo = currentStudentReg;
  }

  const desc = document.getElementById('comp-desc').value.trim();
  if (!regNo || !desc) return;
  btn.disabled = true; btn.textContent = 'Submitting...';
  const { error } = await sb.from('complaint').insert([{ reg_no: regNo, description: desc, status: 'Pending' }]);
  btn.disabled = false; btn.textContent = 'Submit Complaint';
  showMsg('comp-msg', error ? 'Error: ' + error.message : 'Complaint submitted successfully!', !error);
  if (!error) { document.getElementById('complaint-form').reset(); if (currentStudentReg) document.getElementById('comp-reg').value = currentStudentReg; loadOverviewStats(); }
});

// Movement Requests
async function loadMovements() {
  const { data } = await sb.from('movement_request').select('*, student(name)').order('request_id', { ascending: false });
  let rows = data || [];
  if (currentRole === 'parent' && currentParentReg) {
    rows = rows.filter(r => String(r.reg_no) === String(currentParentReg));
  }
  renderMovements(rows);
}

function renderMovements(list) {
  const tbody = document.getElementById('movement-tbody');
  const isWardenActor = currentRole === 'admin' || currentRole === 'warden';
  const isParent = currentRole === 'parent';
  const canAct = isWardenActor || isParent;
  if (list.length === 0) { tbody.innerHTML = `<tr><td colspan="${canAct?6:5}" class="px-4 py-6 text-center text-gray-400">No movement requests yet.</td></tr>`; return; }
  tbody.innerHTML = list.map(r => `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td class="px-4 py-3 font-medium dark:text-white">${esc(r.student?.name || String(r.reg_no))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(r.out_date || '')}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(r.in_date || '')}</td>
      <td class="px-4 py-3">${statusBadge(r.parent_approval || 'Pending')}</td>
      <td class="px-4 py-3">${statusBadge(r.warden_approval ?? r.admin_approval ?? 'Pending')}</td>
      ${canAct ? `<td class="px-4 py-3 text-center">${isWardenActor ? (isApprovedStatus(r.parent_approval)
        ? `<div class="flex gap-1 justify-center">
          <button onclick="approveMovement(${r.request_id},'Approved')" class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors">Approve</button>
          <button onclick="approveMovement(${r.request_id},'Rejected')" class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors">Reject</button>
        </div>`
        : `<span class="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Awaiting parent approval</span>`) : `<div class="flex gap-1 justify-center">
          <button onclick="parentReviewMovement(${r.request_id}, true)" class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors">Approve</button>
          <button onclick="parentReviewMovement(${r.request_id}, false)" class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors">Reject</button>
        </div>`}</td>` : ''}
    </tr>`).join('');
}

async function parentReviewMovement(id, isApproved) {
  if (currentRole !== 'parent') return;
  const candidates = [
    { parent_approval: isApproved },
    { parent_approval: isApproved ? 'Approved' : 'Rejected' },
  ];

  let error = null;
  for (const patch of candidates) {
    const res = await sb.from('movement_request').update(patch).eq('request_id', id).eq('reg_no', currentParentReg);
    error = res.error;
    if (!error) break;
    const msg = (error.message || '').toLowerCase();
    if (!msg.includes('invalid input syntax for type boolean')) break;
  }
  if (error) {
    alert('Error: ' + error.message);
    return;
  }
  loadMovements();
  loadOverviewStats();
  loadRecentActivity();
}

async function approveMovement(id, status) {
  if (currentRole !== 'admin' && currentRole !== 'warden') {
    alert('Only warden/admin can approve movement requests.');
    return;
  }
  const { data: req, error: fetchError } = await sb.from('movement_request').select('parent_approval').eq('request_id', id).single();
  if (fetchError) {
    alert('Error: ' + fetchError.message);
    return;
  }
  if (!isApprovedStatus(req?.parent_approval)) {
    alert('Parent approval is required before warden approval.');
    return;
  }

  const candidates = [
    { warden_approval: status === 'Approved' },
    { warden_approval: status },
    { admin_approval: status === 'Approved' },
    { admin_approval: status },
  ];

  let error = null;
  for (const patch of candidates) {
    const res = await sb.from('movement_request').update(patch).eq('request_id', id);
    error = res.error;
    if (!error) break;
    const msg = (error.message || '').toLowerCase();
    if (!msg.includes('invalid input syntax for type boolean')) break;
  }
  if (!error) { loadMovements(); loadOverviewStats(); loadRecentActivity(); }
}

async function getNextMovementRequestId() {
  const { data, error } = await sb
    .from('movement_request')
    .select('request_id')
    .order('request_id', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return 1;
  const lastId = Number(data[0].request_id) || 0;
  return lastId + 1;
}

document.getElementById('movement-form').addEventListener('submit', async e => {
  e.preventDefault();
  let reg = document.getElementById('mv-reg').value;

  // If student is logged in, use their reg_no
  if (currentStudentReg) {
    reg = currentStudentReg;
  } else if (currentRole === 'parent' && currentParentReg) {
    reg = currentParentReg;
  }

  const outDate = document.getElementById('mv-out').value;
  const inDate = document.getElementById('mv-in').value;
  const reason = document.getElementById('mv-reason').value.trim();
  if (!reg || !outDate || !inDate) return;
  const base = { reg_no: reg, out_date: outDate, in_date: inDate };
  const candidates = [
    { ...base, reason, parent_approval: false, warden_approval: false },
    { ...base, parent_approval: false, warden_approval: false },
    { ...base, reason, parent_approval: 'Pending', warden_approval: 'Pending' },
    { ...base, parent_approval: 'Pending', warden_approval: 'Pending' },
    { ...base, reason, parent_approval: false, admin_approval: false },
    { ...base, parent_approval: false, admin_approval: false },
    { ...base, reason, parent_approval: 'Pending', admin_approval: 'Pending' },
    { ...base, parent_approval: 'Pending', admin_approval: 'Pending' },
    { ...base, reason },
    { ...base },
  ];

  let error = null;
  let nextRequestId = null;
  for (const row of candidates) {
    const res = await sb.from('movement_request').insert([row]);
    error = res.error;
    if (!error) break;

    const msg = (error.message || '').toLowerCase();
    const needsManualId = msg.includes('null value in column') && msg.includes('request_id');
    if (needsManualId) {
      if (nextRequestId === null) nextRequestId = await getNextMovementRequestId();
      const retry = await sb.from('movement_request').insert([{ ...row, request_id: nextRequestId }]);
      error = retry.error;
      if (!error) break;
      nextRequestId += 1;
    }

    const isSchemaMismatch =
      msg.includes('schema cache') ||
      msg.includes('column') ||
      msg.includes('unknown') ||
      msg.includes('does not exist') ||
      msg.includes('invalid input syntax for type boolean');
    if (!isSchemaMismatch) break;
  }

  const details = error?.details ? ` (${error.details})` : '';
  const hint = error?.hint ? ` Hint: ${error.hint}` : '';
  showMsg('mv-msg', error ? 'Error: ' + error.message + details + hint : 'Request submitted!', !error);
  if (!error) { document.getElementById('movement-form').reset(); if (currentStudentReg) document.getElementById('mv-reg').value = currentStudentReg; loadMovements(); loadOverviewStats(); }
});

// Mess
async function loadMess() {
  const { data } = await sb.from('mess').select('*, student(name)').order('mess_id', { ascending: false });
  renderMess(data || []);
}

function renderMess(list) {
  const tbody = document.getElementById('mess-tbody');
  if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">No mess registrations yet.</td></tr>'; return; }
  tbody.innerHTML = list.map(m => `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td class="px-4 py-3 font-medium dark:text-white">${esc(m.student?.name || String(m.reg_no))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(m.menu_type || '')}</td>
      <td class="px-4 py-3 dark:text-gray-300">₹${esc(String(m.monthly_fee || 0))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(m.apply_date || '')}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(m.reply_date || '—')}</td>
      <td class="px-4 py-3">${statusBadge(m.status || 'Pending')}</td>
    </tr>`).join('');
}

document.getElementById('mess-form').addEventListener('submit', async e => {
  e.preventDefault();
  const reg = document.getElementById('mess-reg').value;
  const menu = document.getElementById('mess-menu').value;
  const fee = parseInt(document.getElementById('mess-fee').value);
  const applyDate = document.getElementById('mess-apply').value;
  if (!reg || !menu || !fee || !applyDate) return;
  const { error } = await sb.from('mess').insert([{ reg_no: reg, menu_type: menu, monthly_fee: fee, apply_date: applyDate, status: 'Pending' }]);
  showMsg('mess-msg', error ? 'Error: ' + error.message : 'Mess application submitted!', !error);
  if (!error) { document.getElementById('mess-form').reset(); loadMess(); }
});

// Payments
async function loadPayments() {
  const { data } = await sb.from('payment').select('*, student(name)').order('payment_id', { ascending: false });
  renderPayments(data || []);
}

function renderPayments(list) {
  const tbody = document.getElementById('payment-tbody');
  if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">No payments recorded.</td></tr>'; return; }
  tbody.innerHTML = list.map(p => `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td class="px-4 py-3 font-medium dark:text-white">#${esc(String(p.payment_id))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(p.student?.name || String(p.reg_no))}</td>
      <td class="px-4 py-3 dark:text-gray-300 font-semibold text-emerald-600 dark:text-emerald-400">₹${esc(String(p.amount))}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(p.payment_mode || '')}</td>
      <td class="px-4 py-3 dark:text-gray-300">${esc(p.payment_date || '')}</td>
    </tr>`).join('');
}

document.getElementById('payment-form').addEventListener('submit', async e => {
  e.preventDefault();
  const reg = document.getElementById('pay-reg').value;
  const amount = parseInt(document.getElementById('pay-amount').value);
  const date = document.getElementById('pay-date').value;
  const mode = document.getElementById('pay-mode').value;
  if (!reg || !amount || !date || !mode) return;
  const { error } = await sb.from('payment').insert([{ reg_no: reg, amount, payment_date: date, payment_mode: mode }]);
  showMsg('pay-msg', error ? 'Error: ' + error.message : 'Payment recorded!', !error);
  if (!error) { document.getElementById('payment-form').reset(); loadPayments(); loadOverviewStats(); }
});

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

// Dropdowns
async function populateHostelDropdown(selId) {
  const { data: hostels } = await sb.from('hostel').select('hostel_id');
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Select hostel...</option>' + (hostels||[]).map(h => `<option value="${esc(String(h.hostel_id))}">${esc(String(h.hostel_id))}</option>`).join('');
}

async function populateRoomDropdown() {
  const { data: rooms } = await sb.from('room').select('room_no, capacity');
  const { data: students } = await sb.from('student').select('room_no');
  const occupancy = {};
  (students||[]).forEach(s => { occupancy[s.room_no] = (occupancy[s.room_no]||0) + 1; });
  const sel = document.getElementById('as-room');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select</option>' + (rooms||[]).filter(r => (r.capacity-(occupancy[r.room_no]||0)) > 0).map(r => {
    const left = r.capacity - (occupancy[r.room_no]||0);
    return `<option value="${r.room_no}">Room ${r.room_no} (${left} bed${left!==1?'s':''} left)</option>`;
  }).join('');
}

// Recent Activity
async function loadRecentActivity() {
  const container = document.getElementById('overview-activity');
  const titleEl = document.getElementById('overview-activity-title');

  if (currentRole === 'warden') {
    if (titleEl) titleEl.textContent = 'Awaiting Warden Approval';

    let rows = null;
    {
      const res = await sb
        .from('movement_request')
        .select('request_id, reg_no, out_date, in_date, parent_approval, warden_approval, student(name)')
        .order('request_id', { ascending: false });
      if (!res.error) {
        rows = res.data || [];
      } else if ((res.error.message || '').toLowerCase().includes("could not find the 'warden_approval' column")) {
        const fallback = await sb
          .from('movement_request')
          .select('request_id, reg_no, out_date, in_date, parent_approval, admin_approval, student(name)')
          .order('request_id', { ascending: false });
        if (fallback.error) {
          container.innerHTML = '<p class="text-red-500 text-sm py-4">Failed to load awaiting requests.</p>';
          return;
        }
        rows = fallback.data || [];
      } else {
        container.innerHTML = '<p class="text-red-500 text-sm py-4">Failed to load awaiting requests.</p>';
        return;
      }
    }

    const awaiting = (rows || []).filter(r => {
      const parentApproved = isApprovedStatus(r.parent_approval);
      const wardenField = r.warden_approval ?? r.admin_approval;
      const wardenPending = typeof wardenField === 'boolean'
        ? wardenField === false
        : String(wardenField || 'pending').toLowerCase() === 'pending';
      return parentApproved && wardenPending;
    });

    if (awaiting.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-sm py-4 text-center">No requests awaiting warden approval.</p>';
      return;
    }

    container.innerHTML = awaiting.map(r => `
      <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-3">
        <p class="text-sm font-medium text-gray-900 dark:text-white">${esc(r.student?.name || String(r.reg_no))}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Out: ${esc(r.out_date || '—')} &middot; In: ${esc(r.in_date || '—')}</p>
        <div class="mt-3 flex gap-2">
          <button onclick="approveMovement(${r.request_id},'Approved')" class="text-xs px-2.5 py-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors">Approve</button>
          <button onclick="approveMovement(${r.request_id},'Rejected')" class="text-xs px-2.5 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors">Reject</button>
        </div>
      </div>
    `).join('');
    return;
  }

  if (currentRole === 'parent' && currentParentReg) {
    if (titleEl) titleEl.textContent = 'Pending Movement Requests';

    const { data, error } = await sb
      .from('movement_request')
      .select('request_id, reg_no, out_date, in_date, parent_approval, student(name)')
      .eq('reg_no', currentParentReg)
      .order('request_id', { ascending: false });

    if (error) {
      container.innerHTML = '<p class="text-red-500 text-sm py-4">Failed to load pending requests.</p>';
      return;
    }

    const pending = (data || []).filter(r => {
      if (typeof r.parent_approval === 'boolean') return r.parent_approval === false;
      const s = String(r.parent_approval || 'pending').toLowerCase();
      return s === 'pending';
    });

    if (pending.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-sm py-4 text-center">No pending movement requests.</p>';
      return;
    }

    container.innerHTML = pending.map(r => `
      <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-3">
        <p class="text-sm font-medium text-gray-900 dark:text-white">${esc(r.student?.name || String(r.reg_no))}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Out: ${esc(r.out_date || '—')} &middot; In: ${esc(r.in_date || '—')}</p>
        <div class="mt-3 flex gap-2">
          <button onclick="parentReviewMovement(${r.request_id}, true)" class="text-xs px-2.5 py-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors">Approve</button>
          <button onclick="parentReviewMovement(${r.request_id}, false)" class="text-xs px-2.5 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors">Reject</button>
        </div>
      </div>
    `).join('');
    return;
  }

  if (titleEl) titleEl.textContent = 'Recent Activity';
  const { data } = await sb.from('student').select('reg_no, name, room_no, created_at').order('created_at', { ascending: false }).limit(5);
  if (!data || data.length === 0) { container.innerHTML = '<p class="text-gray-400 text-sm py-4 text-center">No recent activity.</p>'; return; }
  container.innerHTML = data.map((s, i) => {
    const time = s.created_at ? new Date(s.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown';
    const isLast = i === data.length - 1;
    return `<div class="flex gap-3">
      <div class="flex flex-col items-center">
        <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z"/></svg>
        </div>
        ${!isLast ? '<div class="w-0.5 flex-1 bg-gray-200 dark:bg-gray-600 my-1"></div>' : ''}
      </div>
      <div class="pb-4 flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 dark:text-white">${esc(s.name||'Unknown')}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Registered &middot; Reg #${esc(String(s.reg_no))} &middot; Room ${esc(String(s.room_no??'—'))}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${esc(time)}</p>
      </div>
    </div>`;
  }).join('');
}

// Real-time
sb.channel('hms-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'complaint' }, () => { loadComplaints(); loadOverviewStats(); })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'movement_request' }, () => { loadOverviewStats(); })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'payment' }, () => { loadOverviewStats(); })
  .subscribe();

// Initial Load
(async () => {
  await ensureDemoStudentParentAccounts();
  await purgeAllParentsOnce();
  await Promise.all([loadOverviewStats(), loadRooms(), loadStudents(), loadComplaints(), populateRoomDropdown(), loadRecentActivity()]);
})();
