// Login and signup flows
(function initAuthHandlers() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const user = document.getElementById('login-user').value.trim();
      const pass = document.getElementById('login-pass').value;
      const selectedRole = document.getElementById('login-role')?.value || 'student';
      const errEl = document.getElementById('login-error');

      if (selectedRole === 'admin') {
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
          errEl.classList.add('hidden');
          sessionStorage.setItem('hms-role', 'admin');
          showDashboard('admin');
        } else {
          errEl.textContent = 'Invalid admin username or password.';
          errEl.classList.remove('hidden');
        }
        return;
      }

      if (selectedRole === 'parent') {
        let parent = null;
        {
          const res = await sb.from('parent').select('parent_id, reg_no, mobile').eq('parent_id', user).single();
          if (!res.error) {
            parent = res.data;
          } else if ((res.error.message || '').toLowerCase().includes("could not find the 'parent_id' column")) {
            const legacyRes = await sb.from('parent').select('patent_id, reg_no, mobile').eq('patent_id', user).single();
            if (!legacyRes.error) parent = legacyRes.data;
          }
        }

        if (!parent) {
          errEl.textContent = 'Parent account not found for this Parent ID.';
          errEl.classList.remove('hidden');
          return;
        }

        const parentCreds = getParentCreds();
        const fallbackPass = String(parent.mobile || '').trim();
        const isDemoParent = /^\d+$/.test(user) && Number(user) >= 112 && Number(user) <= 121;
        if (isDemoParent) {
          parentCreds[user] = '12345';
          saveParentCreds(parentCreds);
        }

        const expectedPass = isDemoParent
          ? '12345'
          : (Object.prototype.hasOwnProperty.call(parentCreds, user) ? parentCreds[user] : fallbackPass);

        if (!expectedPass) {
          errEl.textContent = 'No parent credentials are set. Ask admin to set parent login password.';
          errEl.classList.remove('hidden');
          return;
        }

        if (pass !== expectedPass) {
          errEl.textContent = 'Incorrect parent password.';
          errEl.classList.remove('hidden');
          return;
        }

        errEl.classList.add('hidden');
        currentParentId = user;
        currentParentReg = String(parent.reg_no || '');
        sessionStorage.setItem('hms-role', 'parent');
        sessionStorage.setItem('parent-id', currentParentId);
        sessionStorage.setItem('parent-reg', currentParentReg);
        await loadStudents();
        showDashboard('parent');
        return;
      }

      if (selectedRole === 'warden') {
        let warden = null;
        {
          const byWardenId = await sb.from('warden').select('warden_id, id, name, mobile').eq('warden_id', user).maybeSingle();
          if (!byWardenId.error && byWardenId.data) warden = byWardenId.data;

          if (!warden) {
            const byLegacyId = await sb.from('warden').select('id, name, mobile').eq('id', user).maybeSingle();
            if (!byLegacyId.error && byLegacyId.data) warden = byLegacyId.data;
          }

          if (!warden) {
            const byOnlyWardenId = await sb.from('warden').select('warden_id, name, mobile').eq('warden_id', user).maybeSingle();
            if (!byOnlyWardenId.error && byOnlyWardenId.data) warden = byOnlyWardenId.data;
          }
        }

        if (!warden) {
          errEl.textContent = 'Warden account not found for this Warden ID.';
          errEl.classList.remove('hidden');
          return;
        }

        const resolvedId = String(warden.warden_id ?? warden.id ?? user);
        const wardenCreds = getWardenCreds();
        const fallbackPass = String(warden.mobile || '').trim();
        const expectedPass = Object.prototype.hasOwnProperty.call(wardenCreds, resolvedId)
          ? wardenCreds[resolvedId]
          : (Object.prototype.hasOwnProperty.call(wardenCreds, user) ? wardenCreds[user] : fallbackPass);

        if (!expectedPass) {
          errEl.textContent = 'No warden credentials are set. Ask admin to set warden login password.';
          errEl.classList.remove('hidden');
          return;
        }

        if (pass !== expectedPass) {
          errEl.textContent = 'Incorrect warden password.';
          errEl.classList.remove('hidden');
          return;
        }

        errEl.classList.add('hidden');
        currentWardenId = resolvedId;
        sessionStorage.setItem('hms-role', 'warden');
        sessionStorage.setItem('warden-id', currentWardenId);
        await loadStudents();
        showDashboard('warden');
        return;
      }

      const { data: student } = await sb.from('student').select('reg_no').eq('reg_no', user).single();
      if (!student) {
        errEl.textContent = 'Student registration number not found.';
        errEl.classList.remove('hidden');
        return;
      }

      const creds = getStudentCreds();
      if (!Object.prototype.hasOwnProperty.call(creds, user)) {
        errEl.textContent = 'No password set for this registration number yet. Use Sign Up first.';
        errEl.classList.remove('hidden');
        return;
      }

      if (creds[user] !== pass) {
        errEl.textContent = 'Incorrect password for this registration number.';
        errEl.classList.remove('hidden');
        return;
      }

      errEl.classList.add('hidden');
      currentStudentReg = user;
      sessionStorage.setItem('hms-role', 'student');
      sessionStorage.setItem('student-reg', user);
      await loadStudents();
      showDashboard('student');
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async e => {
      e.preventDefault();
      const reg = document.getElementById('signup-reg').value.trim();
      const pass = document.getElementById('signup-pass').value;
      const pass2 = document.getElementById('signup-pass2').value;
      const errEl = document.getElementById('signup-error');

      if (pass !== pass2) {
        errEl.textContent = 'Passwords do not match.';
        errEl.classList.remove('hidden');
        return;
      }

      if (!pass) {
        errEl.textContent = 'Password is required.';
        errEl.classList.remove('hidden');
        return;
      }

      const { data: student } = await sb.from('student').select('reg_no').eq('reg_no', reg).single();
      if (!student) {
        errEl.textContent = 'Registration number not found. Contact admin to register.';
        errEl.classList.remove('hidden');
        return;
      }

      const creds = getStudentCreds();
      if (Object.prototype.hasOwnProperty.call(creds, reg)) {
        errEl.textContent = 'Account already exists. Use Login.';
        errEl.classList.remove('hidden');
        return;
      }

      creds[reg] = pass;
      saveStudentCreds(creds);

      errEl.classList.add('hidden');
      currentStudentReg = reg;
      sessionStorage.setItem('hms-role', 'student');
      sessionStorage.setItem('student-reg', reg);
      await loadStudents();
      showDashboard('student');
    });
  }
})();
