// Auth form toggle behavior
(function initAuthFormToggle() {
  const loginToggle = document.getElementById('form-toggle-login');
  const signupToggle = document.getElementById('form-toggle-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  if (!loginToggle || !signupToggle || !loginForm || !signupForm) return;

  function showLogin() {
    loginToggle.classList.add('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
    loginToggle.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
    signupToggle.classList.remove('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
    signupToggle.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  }

  function showSignup() {
    signupToggle.classList.add('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
    signupToggle.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
    loginToggle.classList.remove('active', 'bg-indigo-100', 'dark:bg-indigo-900', 'text-indigo-700', 'dark:text-indigo-300');
    loginToggle.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
  }

  loginToggle.addEventListener('click', showLogin);
  signupToggle.addEventListener('click', showSignup);

  window.hmsAuthUi = window.hmsAuthUi || {};
  window.hmsAuthUi.showLogin = showLogin;
  window.hmsAuthUi.showSignup = showSignup;
})();
