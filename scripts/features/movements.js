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
