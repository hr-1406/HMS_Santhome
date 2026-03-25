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
