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

// Shared Dropdowns
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
