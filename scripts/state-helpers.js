const { createClient } = supabase;
const sb = createClient(
  'https://lcxwtiiqfmlihrljbhgi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeHd0aWlxZm1saWhybGpiaGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTkxNTMsImV4cCI6MjA4NzQzNTE1M30.RXE7vMAIMmOViovPjwBY2ejtY_YYfD-kK3FDSn0eI0Y'
);

let currentRole = null;
let currentStudentReg = null; // for student login
let currentParentId = null;
let currentParentReg = null;
let currentWardenId = null;
const ADMIN_USER = 'admin', ADMIN_PASS = 'admin123';
const STUDENT_CREDS_KEY = 'hms-student-creds';
const PARENT_CREDS_KEY = 'hms-parent-creds';
const WARDEN_CREDS_KEY = 'hms-warden-creds';
let allStudents = [];

function getStudentCreds() {
  try {
    return JSON.parse(localStorage.getItem(STUDENT_CREDS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStudentCreds(creds) {
  localStorage.setItem(STUDENT_CREDS_KEY, JSON.stringify(creds));
}

function getParentCreds() {
  try {
    return JSON.parse(localStorage.getItem(PARENT_CREDS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveParentCreds(creds) {
  localStorage.setItem(PARENT_CREDS_KEY, JSON.stringify(creds));
}

function getWardenCreds() {
  try {
    return JSON.parse(localStorage.getItem(WARDEN_CREDS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveWardenCreds(creds) {
  localStorage.setItem(WARDEN_CREDS_KEY, JSON.stringify(creds));
}

// Helpers
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str ?? ''));
  return d.innerHTML;
}

function statusBadge(status) {
  const normalized = typeof status === 'boolean'
    ? (status ? 'approved' : 'pending')
    : (status || 'pending');
  const s = String(normalized).toLowerCase();
  const colors = {
    'pending':     'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    'in progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'resolved':    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    'approved':    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    'rejected':    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };
  const cls = colors[s] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  const label = typeof status === 'boolean' ? (status ? 'Approved' : 'Pending') : (status || 'Pending');
  return `<span class="text-xs font-medium px-2.5 py-0.5 rounded-full ${cls}">${esc(label)}</span>`;
}

function isApprovedStatus(value) {
  if (typeof value === 'boolean') return value === true;
  return String(value || '').toLowerCase() === 'approved';
}

function showMsg(id, text, ok) {
  const el = document.getElementById(id);
  el.className = `mt-4 text-sm rounded-lg px-4 py-3 ${ok
    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`;
  el.textContent = text;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function occupancyColor(remaining, capacity) {
  if (remaining <= 0) return 'border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800';
  if (remaining <= Math.ceil(capacity / 3)) return 'border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800';
  return 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800';
}
