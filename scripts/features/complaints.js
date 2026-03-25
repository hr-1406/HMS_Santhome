// Complaints
async function loadComplaints() {
  const overview = document.getElementById('overview-complaints');
  const overviewTitle = document.getElementById('overview-secondary-title');

  if (currentRole === 'parent' && currentParentReg) {
    if (overviewTitle) overviewTitle.textContent = 'Payment History';

    const { data, error } = await sb
      .from('payment')
      .select('payment_id, amount, payment_mode, payment_date')
      .eq('reg_no', currentParentReg)
      .order('payment_date', { ascending: false });

    if (!overview) return;
    if (error) {
      overview.innerHTML = '<p class="text-red-500 text-sm">Failed to load payment history.</p>';
      return;
    }

    const rows = data || [];
    if (rows.length === 0) {
      overview.innerHTML = '<p class="text-gray-400 text-sm">No payment history yet.</p>';
      return;
    }

    overview.innerHTML = rows.slice(0, 8).map(p => `
      <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 dark:bg-gray-700">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">Payment #${esc(String(p.payment_id))}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${esc(p.payment_date || '—')} &middot; ${esc(p.payment_mode || '—')}</p>
          </div>
          <span class="text-sm font-semibold text-emerald-600 dark:text-emerald-400">₹${esc(String(p.amount || 0))}</span>
        </div>
      </div>
    `).join('');
    return;
  }

  if (overviewTitle) overviewTitle.textContent = 'Latest Complaints';
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
