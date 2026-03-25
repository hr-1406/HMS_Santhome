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
