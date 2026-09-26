// Scheme Matcher — Production-Ready Client Logic
// Zero external libraries — Vanilla JavaScript ES6+

const API_URL = '';
let currentAdminToken = localStorage.getItem('admin_token') || null;
let currentStudentToken = localStorage.getItem('student_token') || null;
let currentUser = null;
let currentUserProfile = null;
let bookmarkedSchemeIds = [];
let domainsCache = [];
let statesCache = [];
let globalConfig = { googleClientId: '', hasGoogleAuth: false };

// ---------------------------------------------------------------------------
// DEVICE ID FOR ANONYMOUS SESSIONS
// ---------------------------------------------------------------------------
function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'DEV-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}
const DEVICE_ID = getDeviceId();

// Helper: API Request Headers
function getHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': DEVICE_ID,
    ...extraHeaders,
  };
  const token = currentStudentToken || currentAdminToken;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Helper: Escape HTML to protect against XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ---------------------------------------------------------------------------
// INITIALIZATION ON DOM READY
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initServicesDropdown();
  loadConfig();
  loadReferenceData();
  loadStats();
  initBookmarks();
  initAuth();

  // Questionnaire form submit
  document.getElementById('matcher-form').addEventListener('submit', handleMatchSubmit);

  // Auto-fill from profile and reset buttons
  document.getElementById('btn-autofill-profile').addEventListener('click', autoFillFromProfile);
  document.getElementById('btn-reset-match').addEventListener('click', resetMatcherForm);
  document.getElementById('btn-export-results').addEventListener('click', exportMatchesReport);

  // Browse tab search/filter/sort inputs
  document.getElementById('search-q').addEventListener('input', debounce(handleBrowseFilter, 250));
  document.getElementById('filter-domain').addEventListener('change', handleBrowseFilter);
  document.getElementById('filter-level').addEventListener('change', handleBrowseFilter);
  document.getElementById('browse-sort').addEventListener('change', handleBrowseFilter);

  // Admin login and sub-tabs
  document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
  document.getElementById('btn-logout').addEventListener('click', handleAdminLogout);
  initAdminSubnav();

  // Scheme and Bulk Import forms (Admin)
  document.getElementById('btn-add-scheme').addEventListener('click', () => openSchemeModal());
  document.getElementById('btn-bulk-import').addEventListener('click', () => toggleModal('bulk-modal', true));
  document.getElementById('scheme-form').addEventListener('submit', handleSchemeFormSubmit);
  document.getElementById('bulk-import-form').addEventListener('submit', handleBulkImportSubmit);

  // Secondary Features Modals & Forms
  document.getElementById('btn-login-modal').addEventListener('click', () => toggleModal('auth-modal', true));
  document.getElementById('dev-login-form').addEventListener('submit', handleDevLoginSubmit);
  document.getElementById('btn-user-logout').addEventListener('click', handleStudentLogout);
  document.getElementById('btn-open-profile-pill').addEventListener('click', openProfileModal);
  document.getElementById('profile-form').addEventListener('submit', handleProfileFormSubmit);

  document.getElementById('btn-notif-bell').addEventListener('click', openNotificationsModal);
  document.getElementById('btn-mark-all-read').addEventListener('click', markAllNotificationsRead);

  document.getElementById('quick-app-form').addEventListener('submit', handleQuickAppSubmit);
  document.getElementById('vault-upload-form').addEventListener('submit', handleVaultUploadSubmit);
  document.getElementById('donation-form').addEventListener('submit', handleDonationSubmit);
  document.getElementById('volunteer-form').addEventListener('submit', handleVolunteerSubmit);
  document.getElementById('feedback-form').addEventListener('submit', handleFeedbackSubmit);

  // Modal close handlers
  const closeMappings = [
    ['modal-close', 'scheme-modal'],
    ['bulk-modal-close', 'bulk-modal'],
    ['auth-modal-close', 'auth-modal'],
    ['profile-modal-close', 'profile-modal'],
    ['tracker-modal-close', 'tracker-modal'],
    ['quick-app-close', 'quick-app-modal'],
    ['vault-modal-close', 'vault-modal'],
    ['notif-modal-close', 'notif-modal'],
    ['donation-modal-close', 'donation-modal'],
    ['volunteer-modal-close', 'volunteer-modal'],
    ['feedback-modal-close', 'feedback-modal'],
  ];
  closeMappings.forEach(([btnId, modalId]) => {
    const el = document.getElementById(btnId);
    if (el) el.addEventListener('click', () => toggleModal(modalId, false));
  });

  // Check admin state
  updateAdminView();

  // Login gate
  initLoginGate();

  // AI Chat & Voice Assistant
  initAIAssistant();
});

// ---------------------------------------------------------------------------
// NAVIGATION & TABS
// ---------------------------------------------------------------------------
function initTabs() {
  const buttons = document.querySelectorAll('.nav-btn:not(.services-btn)');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTabId = btn.getAttribute('data-tab');
      const tabs = document.querySelectorAll('.tab-content');
      tabs.forEach(t => t.classList.remove('active'));

      const targetTab = document.getElementById(targetTabId);
      if (targetTab) targetTab.classList.add('active');

      if (targetTabId === 'browse-tab') {
        loadAllSchemes();
      } else if (targetTabId === 'bookmarks-tab') {
        loadBookmarksTab();
      } else if (targetTabId === 'admin-tab' && currentAdminToken) {
        loadAdminDashboard();
      }
    });
  });
}

function switchToTab(tabId) {
  const targetBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (targetBtn) {
    targetBtn.click();
  } else {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
  }
}

// ---------------------------------------------------------------------------
// SERVICES POP-OUT MENU
// ---------------------------------------------------------------------------
function initServicesDropdown() {
  const trigger = document.getElementById('btn-services-menu');
  const menu = document.getElementById('services-menu');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !isHidden);
    trigger.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('svc-match')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    switchToTab('match-tab');
  });
  document.getElementById('svc-vault')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    openVaultModal();
  });
  document.getElementById('svc-tracker')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    openTrackerModal();
  });
  document.getElementById('svc-alerts')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    openNotificationsModal();
  });
  document.getElementById('svc-profile')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    openProfileModal();
  });
  document.getElementById('svc-donation')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    toggleModal('donation-modal', true);
  });
  document.getElementById('svc-volunteer')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    toggleModal('volunteer-modal', true);
  });
  document.getElementById('svc-feedback')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    toggleModal('feedback-modal', true);
  });
}

// ---------------------------------------------------------------------------
// CONFIG & REFERENCE DATA
// ---------------------------------------------------------------------------
async function loadConfig() {
  try {
    const res = await fetch(`${API_URL}/api/config`);
    globalConfig = await res.json();
    initGoogleSignIn();
    initLoginGate(); // re-init gate now that config is loaded (renders Google button)
  } catch (err) {
    console.error('Failed to load server config:', err);
  }
}

function initGoogleSignIn() {
  const note = document.getElementById('google-config-note');
  const slot = document.getElementById('google-btn-slot');
  const modalGoogleBtn = document.getElementById('modal-google-fake-btn');

  if (modalGoogleBtn) {
    modalGoogleBtn.addEventListener('click', () => handleFakeGoogleLogin('modal'));
  }

  if (globalConfig.googleClientId && window.google && window.google.accounts) {
    if (note) note.classList.add('hidden');
    try {
      window.google.accounts.id.initialize({
        client_id: globalConfig.googleClientId,
        callback: handleGoogleCredentialResponse,
      });
      if (slot) {
        window.google.accounts.id.renderButton(slot, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          width: '320',
        });
      }
    } catch (e) {
      console.warn('Google Identity initialization notice:', e);
    }
  } else {
    if (note) note.classList.add('hidden');
  }
}

async function handleGoogleCredentialResponse(response) {
  try {
    const res = await fetch(`${API_URL}/api/auth/google`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google login failed');

    currentStudentToken = data.token;
    localStorage.setItem('student_token', currentStudentToken);
    toggleModal('auth-modal', false);
    dismissLoginGate();
    await checkCurrentUser();
    await initBookmarks();
  } catch (err) {
    alert('Google Login: ' + err.message);
  }
}

async function loadReferenceData() {
  try {
    const [domainsRes, statesRes] = await Promise.all([
      fetch(`${API_URL}/api/domains`),
      fetch(`${API_URL}/api/states`),
    ]);
    domainsCache = await domainsRes.json();
    statesCache = await statesRes.json();

    populateDropdown('state', statesCache, true);
    populateDropdown('prof-state', statesCache, true);
    populateDropdown('domain', domainsCache, false, 'id', 'en');
    populateDropdown('prof-domain', domainsCache, false, 'id', 'en');
    populateDropdown('filter-domain', domainsCache, false, 'id', 'en');
    populateDropdown('f-domain', domainsCache, false, 'id', 'en');
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }
}

function populateDropdown(selectId, items, isStringArray, valueKey = '', labelKey = '') {
  const select = document.getElementById(selectId);
  if (!select) return;

  const firstOption = select.options[0];
  select.innerHTML = '';
  if (firstOption && !isStringArray) {
    select.appendChild(firstOption);
  }

  items.forEach(item => {
    const option = document.createElement('option');
    if (isStringArray) {
      option.value = item;
      option.textContent = item;
    } else {
      option.value = item[valueKey];
      option.textContent = item[labelKey];
    }
    select.appendChild(option);
  });
}

async function loadStats() {
  try {
    const res = await fetch(`${API_URL}/api/stats`);
    const data = await res.json();
    document.getElementById('stat-active-count').textContent = data.totalSchemes;
    document.getElementById('stat-domain-count').textContent = data.domains;
    document.getElementById('stat-last-reviewed').textContent = data.lastReviewed;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ---------------------------------------------------------------------------
// LOGIN GATE
// ---------------------------------------------------------------------------
function initLoginGate() {
  const gate = document.getElementById('login-gate');
  if (!gate) return;

  // Wire gate login form
  const gateForm = document.getElementById('gate-login-form');
  if (gateForm) {
    gateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('gate-email').value.trim();
      const name = document.getElementById('gate-name').value.trim();
      const errEl = document.getElementById('gate-login-error');
      const btn = document.getElementById('gate-login-btn');

      btn.disabled = true;
      btn.textContent = 'Signing in...';
      errEl.classList.add('hidden');

      try {
        const res = await fetch(`${API_URL}/api/auth/dev-login`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ email, name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        currentStudentToken = data.token;
        localStorage.setItem('student_token', currentStudentToken);
        dismissLoginGate();
        await checkCurrentUser();
        await initBookmarks();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Continue to Scheme Matcher →';
      }
    });
  }

  // Setup Google Sign-In inside gate
  const gateGoogleBtn = document.getElementById('gate-google-fake-btn');
  if (gateGoogleBtn) {
    gateGoogleBtn.addEventListener('click', () => handleFakeGoogleLogin('gate'));
  }

  // Continue as Guest button
  const gateSkipBtn = document.getElementById('gate-skip-btn');
  if (gateSkipBtn) {
    gateSkipBtn.addEventListener('click', () => {
      dismissLoginGate();
      showToast('Exploring as guest! You can search schemes and chat with SchemeMitra AI.', 'info');
    });
  }

  const slot = document.getElementById('gate-google-btn-slot');
  const note = document.getElementById('gate-google-note');
  if (note) note.classList.add('hidden');

  if (globalConfig.googleClientId && window.google && window.google.accounts) {
    try {
      window.google.accounts.id.renderButton(slot, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: '376',
      });
    } catch(e) { /* already initialised */ }
  }
}

async function handleFakeGoogleLogin(source = 'gate') {
  if (globalConfig.googleClientId && window.google && window.google.accounts) {
    try {
      window.google.accounts.id.prompt();
      return;
    } catch(e) { /* fallback to instant demo sign-in */ }
  }

  // Realistic instant Google sign-in demo
  let email = '';
  let name = '';

  if (source === 'gate') {
    const emailEl = document.getElementById('gate-email');
    const nameEl = document.getElementById('gate-name');
    email = (emailEl && emailEl.value.trim()) || 'student.google@gmail.com';
    name = (nameEl && nameEl.value.trim()) || 'Demo Student (Google)';
  } else {
    const emailEl = document.getElementById('dev-email');
    const nameEl = document.getElementById('dev-name');
    email = (emailEl && emailEl.value.trim()) || 'student.google@gmail.com';
    name = (nameEl && nameEl.value.trim()) || 'Demo Student (Google)';
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google login failed');

    currentStudentToken = data.token;
    localStorage.setItem('student_token', currentStudentToken);
    dismissLoginGate();
    toggleModal('auth-modal', false);
    await checkCurrentUser();
    await initBookmarks();
    showToast(`Signed in with Google as ${name}!`, 'success');
  } catch (err) {
    alert('Google login failed: ' + err.message);
  }
}

function dismissLoginGate() {
  const gate = document.getElementById('login-gate');
  if (!gate) return;
  gate.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
  gate.style.opacity = '0';
  gate.style.transform = 'scale(0.97)';
  setTimeout(() => gate.classList.add('hidden'), 380);
}

// ---------------------------------------------------------------------------
// AUTHENTICATION & STUDENT ACCOUNT
// ---------------------------------------------------------------------------
async function initAuth() {
  if (currentStudentToken) {
    // Optimistically hide gate immediately to avoid flash while we validate token
    const gate = document.getElementById('login-gate');
    if (gate) gate.classList.add('hidden');
    await checkCurrentUser();
    // If token was invalid, checkCurrentUser clears it and calls updateStudentAuthUI(null)
    // which will re-show the gate
    if (!currentUser) {
      if (gate) gate.classList.remove('hidden');
    }
  } else {
    updateStudentAuthUI(null);
  }
}

async function checkCurrentUser() {
  if (!currentStudentToken) {
    updateStudentAuthUI(null);
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/me`, {
      headers: { 'Authorization': `Bearer ${currentStudentToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      currentUserProfile = data.profile;
      updateStudentAuthUI(currentUser, data.unreadNotifications);
    } else {
      currentStudentToken = null;
      localStorage.removeItem('student_token');
      updateStudentAuthUI(null);
    }
  } catch (e) {
    console.warn('User status check offline:', e);
  }
}

function updateStudentAuthUI(user, unreadCount = 0) {
  const loggedOutBox = document.getElementById('auth-logged-out');
  const loggedInBox = document.getElementById('auth-logged-in');
  const displayName = document.getElementById('user-display-name');
  const avatarImg = document.getElementById('user-avatar-img');
  const avatarFallback = document.getElementById('user-avatar-fallback');
  const bellBadge = document.getElementById('bell-notif-badge');
  const menuBadge = document.getElementById('menu-notif-badge');
  const aiWidget = document.getElementById('ai-assistant-widget');

  if (user) {
    loggedOutBox.classList.add('hidden');
    loggedInBox.classList.remove('hidden');
    // Show AI widget only after login
    displayName.textContent = user.name || user.email.split('@')[0];

    if (user.picture) {
      avatarImg.src = user.picture;
      avatarImg.classList.remove('hidden');
      avatarFallback.classList.add('hidden');
    } else {
      avatarImg.classList.add('hidden');
      avatarFallback.classList.remove('hidden');
      avatarFallback.textContent = (user.name || 'U').charAt(0).toUpperCase();
    }

    if (unreadCount > 0) {
      bellBadge.textContent = unreadCount;
      bellBadge.classList.remove('hidden');
      menuBadge.textContent = unreadCount;
      menuBadge.classList.remove('hidden');
    } else {
      bellBadge.classList.add('hidden');
      menuBadge.classList.add('hidden');
    }
  } else {
    loggedOutBox.classList.remove('hidden');
    loggedInBox.classList.add('hidden');
    bellBadge.classList.add('hidden');
    menuBadge.classList.add('hidden');
  }
  // Ensure AI assistant widget is readily accessible
  if (aiWidget) aiWidget.style.display = '';
}

async function handleDevLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('dev-email').value;
  const name = document.getElementById('dev-name').value;

  try {
    const res = await fetch(`${API_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    currentStudentToken = data.token;
    localStorage.setItem('student_token', currentStudentToken);
    toggleModal('auth-modal', false);
    dismissLoginGate();
    await checkCurrentUser();
    await initBookmarks();
  } catch (err) {
    alert('Login Error: ' + err.message);
  }
}

function handleStudentLogout() {
  currentStudentToken = null;
  currentUser = null;
  currentUserProfile = null;
  localStorage.removeItem('student_token');
  updateStudentAuthUI(null);
  initBookmarks();
  // Re-show login gate on logout
  const gate = document.getElementById('login-gate');
  if (gate) {
    gate.style.opacity = '';
    gate.style.transform = '';
    gate.classList.remove('hidden');
  }
}

// ---------------------------------------------------------------------------
// PROFILE MANAGEMENT
// ---------------------------------------------------------------------------
async function openProfileModal() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  toggleModal('profile-modal', true);
  document.getElementById('profile-success').classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/api/profile`, { headers: getHeaders() });
    if (res.ok) {
      const prof = await res.json();
      currentUserProfile = prof;
      if (prof.state) document.getElementById('prof-state').value = prof.state;
      if (prof.category) document.getElementById('prof-category').value = prof.category;
      if (prof.gender) document.getElementById('prof-gender').value = prof.gender;
      if (prof.age) document.getElementById('prof-age').value = prof.age;
      if (prof.income) document.getElementById('prof-income').value = prof.income;
      if (prof.disability) document.getElementById('prof-disability').value = prof.disability;
      if (prof.occupation) document.getElementById('prof-occupation').value = prof.occupation;
      if (prof.education) document.getElementById('prof-education').value = prof.education;
      if (prof.domain) document.getElementById('prof-domain').value = prof.domain;
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

async function handleProfileFormSubmit(e) {
  e.preventDefault();
  const payload = {
    state: document.getElementById('prof-state').value,
    category: document.getElementById('prof-category').value,
    gender: document.getElementById('prof-gender').value,
    age: document.getElementById('prof-age').value,
    income: document.getElementById('prof-income').value,
    disability: document.getElementById('prof-disability').value,
    occupation: document.getElementById('prof-occupation').value,
    education: document.getElementById('prof-education').value,
    domain: document.getElementById('prof-domain').value,
  };

  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    currentUserProfile = await res.json();
    const succ = document.getElementById('profile-success');
    succ.classList.remove('hidden');
    setTimeout(() => succ.classList.add('hidden'), 2500);
  } catch (err) {
    alert('Error saving profile: ' + err.message);
  }
}

function autoFillFromProfile() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  if (!currentUserProfile) {
    openProfileModal();
    return;
  }
  const prof = currentUserProfile;
  if (prof.state) document.getElementById('state').value = prof.state;
  if (prof.category) document.getElementById('category').value = prof.category;
  if (prof.gender) document.getElementById('gender').value = prof.gender;
  if (prof.age) document.getElementById('age').value = prof.age;
  if (prof.income) document.getElementById('income').value = prof.income;
  if (prof.disability) {
    const rad = document.querySelector(`input[name="disability"][value="${prof.disability}"]`);
    if (rad) rad.checked = true;
  }
  if (prof.occupation) document.getElementById('occupation').value = prof.occupation;
  if (prof.education) document.getElementById('education').value = prof.education;
  if (prof.domain) document.getElementById('domain').value = prof.domain;
}

// ---------------------------------------------------------------------------
// BOOKMARKS
// ---------------------------------------------------------------------------
async function initBookmarks() {
  try {
    const res = await fetch(`${API_URL}/api/bookmarks`, { headers: getHeaders() });
    if (res.ok) {
      bookmarkedSchemeIds = await res.json();
      updateBookmarkCount();
    }
  } catch (err) {
    console.error('Failed to fetch bookmarks:', err);
  }
}

function updateBookmarkCount() {
  const el = document.getElementById('bookmark-count');
  if (el) el.textContent = bookmarkedSchemeIds.length;
}

async function toggleBookmark(schemeId, btnElement) {
  try {
    const res = await fetch(`${API_URL}/api/bookmarks/${schemeId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.bookmarked) {
        if (!bookmarkedSchemeIds.includes(schemeId)) bookmarkedSchemeIds.push(schemeId);
        btnElement.classList.add('saved');
        btnElement.innerHTML = `🔖 Saved`;
      } else {
        bookmarkedSchemeIds = bookmarkedSchemeIds.filter(id => id !== schemeId);
        btnElement.classList.remove('saved');
        btnElement.innerHTML = `🔖 Bookmark`;
      }
      updateBookmarkCount();
    }
  } catch (err) {
    console.error('Failed to toggle bookmark:', err);
  }
}

async function loadBookmarksTab() {
  const container = document.getElementById('bookmarks-list');
  container.innerHTML = '<div class="empty-state">⏳ Loading saved schemes...</div>';

  if (bookmarkedSchemeIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">🔖</span>
        <p>You haven't bookmarked any schemes yet.</p>
      </div>`;
    return;
  }

  try {
    const promises = bookmarkedSchemeIds.map(id =>
      fetch(`${API_URL}/api/schemes/${id}`).then(res => res.ok ? res.json() : null)
    );
    const results = (await Promise.all(promises)).filter(Boolean);

    container.innerHTML = '';
    results.forEach(scheme => {
      const card = renderSchemeCard(scheme, false);
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<div class="empty-state">❌ Error loading bookmarked schemes.</div>';
  }
}

// ---------------------------------------------------------------------------
// MATCHING ENGINE FORM & RESULTS
// ---------------------------------------------------------------------------
let currentMatchResults = [];

async function handleMatchSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  const answers = {
    state: formData.get('state'),
    category: formData.get('category'),
    gender: formData.get('gender'),
    age: formData.get('age'),
    income: formData.get('income'),
    disability: formData.get('disability'),
    occupation: formData.get('occupation'),
    education: formData.get('education'),
    domain: formData.get('domain'),
  };

  const resultsList = document.getElementById('results-list');
  const exportBtn = document.getElementById('btn-export-results');
  resultsList.innerHTML = '<div class="empty-state">⏳ Calculating matches...</div>';

  try {
    const res = await fetch(`${API_URL}/api/match`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ answers }),
    });

    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    currentMatchResults = data.results || [];

    document.getElementById('results-count').textContent = `${data.count} scheme(s) found (${data.eligibleCount} fully eligible)`;
    resultsList.innerHTML = '';

    if (exportBtn) {
      if (currentMatchResults.length > 0) exportBtn.classList.remove('hidden');
      else exportBtn.classList.add('hidden');
    }

    if (data.results.length === 0) {
      resultsList.innerHTML = `
        <div class="empty-state">
          <span class="icon">💡</span>
          <p>No schemes matched your criteria. Try adjusting income thresholds or selection options.</p>
        </div>`;
      return;
    }

    data.results.forEach(scheme => {
      const card = renderSchemeCard(scheme, true);
      resultsList.appendChild(card);
    });
  } catch (err) {
    resultsList.innerHTML = '<div class="empty-state">❌ Failed to compute matches. Please try again.</div>';
  }
}

function resetMatcherForm() {
  const form = document.getElementById('matcher-form');
  if (form) form.reset();
  const resultsList = document.getElementById('results-list');
  if (resultsList) {
    resultsList.innerHTML = `
      <div class="empty-state">
        <span class="icon">🔍</span>
        <p>Fill out the questionnaire and click search to view matching government schemes.</p>
      </div>`;
  }
  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = '0 schemes found';
  const exportBtn = document.getElementById('btn-export-results');
  if (exportBtn) exportBtn.classList.add('hidden');
  currentMatchResults = [];
  showToast('Questionnaire reset.', 'info');
}

function exportMatchesReport() {
  if (!currentMatchResults || currentMatchResults.length === 0) {
    showToast('No matching schemes to export. Run the search first!', 'info');
    return;
  }
  window.print();
}

function shareSchemeLink(schemeId, schemeName) {
  const url = `${window.location.origin}/#scheme-${schemeId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast(`Link copied for "${schemeName}"! 📋`, 'success');
    }).catch(() => {
      showToast(`Scheme: ${url}`, 'info');
    });
  } else {
    showToast(`Scheme: ${url}`, 'info');
  }
}

// ---------------------------------------------------------------------------
// BROWSE SCHEMES
// ---------------------------------------------------------------------------
async function loadAllSchemes() {
  const container = document.getElementById('browse-list');
  container.innerHTML = '<div class="empty-state">⏳ Loading all schemes...</div>';
  await handleBrowseFilter();
}

async function handleBrowseFilter() {
  const q = document.getElementById('search-q').value;
  const domain = document.getElementById('filter-domain').value;
  const levelEl = document.getElementById('filter-level');
  const level = levelEl ? levelEl.value : '';
  const sortEl = document.getElementById('browse-sort');
  const sort = sortEl ? sortEl.value : 'default';
  const container = document.getElementById('browse-list');

  try {
    const url = new URL(`${window.location.origin}/api/schemes`);
    if (q) url.searchParams.append('q', q);
    if (domain) url.searchParams.append('domain', domain);

    const res = await fetch(url.toString(), { headers: getHeaders() });
    let schemes = await res.json();

    if (level) {
      schemes = schemes.filter(s => s.level === level);
    }

    if (sort === 'name-asc') {
      schemes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'deadline') {
      schemes.sort((a, b) => {
        if (a.deadline === 'Rolling') return 1;
        if (b.deadline === 'Rolling') return -1;
        return (a.deadline || '').localeCompare(b.deadline || '');
      });
    } else if (sort === 'income') {
      schemes.sort((a, b) => (a.incomeMax || Infinity) - (b.incomeMax || Infinity));
    }

    container.innerHTML = '';
    if (schemes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="icon">ℹ️</span>
          <p>No schemes found matching the filters.</p>
        </div>`;
      return;
    }

    schemes.forEach(scheme => {
      const card = renderSchemeCard(scheme, false);
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<div class="empty-state">❌ Error loading schemes.</div>';
  }
}

// ---------------------------------------------------------------------------
// SCHEME CARD RENDERING (FULL EXPLANATION & DETERMINISTIC REASONS)
// ---------------------------------------------------------------------------
function renderSchemeCard(scheme, hasScore) {
  const card = document.createElement('div');
  const isFullyEligible = scheme.isFullyEligible ?? true;
  card.className = `scheme-card ${hasScore ? (isFullyEligible ? 'full-match' : 'partial-match') : ''}`;

  const isSaved = bookmarkedSchemeIds.includes(scheme.id);
  const domainInfo = domainsCache.find(d => d.id === scheme.domain) || { en: scheme.domain };

  let scoreHtml = '';
  let reasonsHtml = '';
  let missingHtml = '';

  if (hasScore) {
    const badgeClass = isFullyEligible ? 'full' : 'partial';
    const label = isFullyEligible ? `⭐ ${scheme.score}% Match (Eligible)` : `⚡ ${scheme.score}% Match (Partial)`;
    scoreHtml = `<span class="score-badge ${badgeClass}">${label}</span>`;

    if (scheme.reasons && scheme.reasons.length > 0) {
      reasonsHtml = `
        <div class="reasons-list">
          <div class="reasons-title">Criteria Met:</div>
          <ul>
            ${scheme.reasons.map(r => `<li>✓ ${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>`;
    }

    if (scheme.missing && scheme.missing.length > 0) {
      missingHtml = `
        <div class="missing-list">
          <div class="missing-title">Missing / Unmet Requirements:</div>
          <ul>
            ${scheme.missing.map(m => `<li>⚠️ ${escapeHtml(m)}</li>`).join('')}
          </ul>
        </div>`;
    }
  }

  const cleanDesc = escapeHtml(scheme.shortDesc || '');
  const cleanMinistry = escapeHtml(scheme.ministry || '');
  const cleanBenefit = escapeHtml(scheme.benefit || '');
  const cleanBenefitType = escapeHtml(scheme.benefitType || 'Benefit');
  const cleanLevel = escapeHtml(scheme.level || 'Central');
  const cleanDomain = escapeHtml(domainInfo.en);
  const cleanDeadline = escapeHtml(scheme.deadline || 'Rolling');

  card.innerHTML = `
    <div class="scheme-card-header">
      <div>
        <div class="scheme-ministry">${cleanLevel} • ${cleanMinistry}</div>
        <h3 class="scheme-title">${escapeHtml(scheme.name)}</h3>
      </div>
      ${scoreHtml}
    </div>
    
    <p class="scheme-desc">${cleanDesc}</p>
    
    <div class="scheme-meta">
      <span class="meta-badge benefit-badge">${cleanBenefitType}: ${cleanBenefit}</span>
      <span class="meta-badge">${cleanDomain}</span>
      <span class="meta-badge">Deadline: ${cleanDeadline}</span>
    </div>

    ${reasonsHtml}
    ${missingHtml}

    <div class="scheme-actions">
      <button class="bookmark-btn ${isSaved ? 'saved' : ''}" onclick="toggleBookmark('${scheme.id}', this)">
        ${isSaved ? '🔖 Saved' : '🔖 Bookmark'}
      </button>

      <button class="btn btn-secondary btn-sm" onclick="openQuickAppModal('${scheme.id}', '${escapeHtml(scheme.name).replace(/'/g, "\\'")}')">
        📝 Track Application
      </button>

      <button class="btn btn-secondary btn-sm" onclick="shareSchemeLink('${scheme.id}', '${escapeHtml(scheme.name).replace(/'/g, "\\'")}')" title="Copy shareable link">
        🔗 Share
      </button>
      
      <button class="collapsible-trigger" onclick="toggleDetailsCollapse(this)">Show Requirements ↓</button>
      
      <a href="${scheme.applyUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" title="Go directly to scheme page">Apply Now ↗</a>
    </div>

    <div class="scheme-details-content hidden">
      <div class="detail-section">
        <h4>📋 Eligibility Scope</h4>
        <p><strong>States:</strong> ${Array.isArray(scheme.states) ? scheme.states.join(', ') : scheme.states}</p>
        <p><strong>Social Category:</strong> ${Array.isArray(scheme.category) ? scheme.category.join(', ') : scheme.category}</p>
        <p><strong>Gender:</strong> ${scheme.gender}</p>
        <p><strong>Disability Constraint:</strong> ${scheme.disability === 'true' ? '40%+ Disability Required' : 'None'}</p>
        ${scheme.minAge || scheme.maxAge ? `<p><strong>Age Scope:</strong> ${scheme.minAge || 0} to ${scheme.maxAge || 'no limit'} years</p>` : ''}
        ${scheme.incomeMax ? `<p><strong>Income Cap:</strong> Under ₹${scheme.incomeMax.toLocaleString()}/year</p>` : ''}
        <p><strong>Education:</strong> ${Array.isArray(scheme.education) ? scheme.education.join(', ') : scheme.education}</p>
        <p><strong>Occupation:</strong> ${Array.isArray(scheme.occupation) ? scheme.occupation.join(', ') : scheme.occupation}</p>
      </div>
      
      ${scheme.documents && scheme.documents.length > 0 ? `
        <div class="detail-section">
          <h4>📂 Required Documents</h4>
          <ul>
            ${scheme.documents.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
          </ul>
        </div>` : ''}

      ${scheme.steps && scheme.steps.length > 0 ? `
        <div class="detail-section">
          <h4>🚶 Steps to Apply</h4>
          <ol>
            ${scheme.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ol>
        </div>` : ''}
      
      <div class="detail-section">
        <p style="font-size: 0.75rem; color: var(--text-muted);">
          <strong>Official Source:</strong> <a href="${scheme.applyUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(scheme.sourceUrl || scheme.applyUrl)}</a> (Verified: ${escapeHtml(scheme.lastVerified || '')})
        </p>
      </div>
    </div>
  `;

  return card;
}

function toggleDetailsCollapse(btn) {
  const card = btn.closest('.scheme-card');
  const details = card.querySelector('.scheme-details-content');
  if (details.classList.contains('hidden')) {
    details.classList.remove('hidden');
    btn.textContent = 'Hide Requirements ↑';
  } else {
    details.classList.add('hidden');
    btn.textContent = 'Show Requirements ↓';
  }
}

// ---------------------------------------------------------------------------
// APPLICATION TRACKER MODAL & OPERATIONS
// ---------------------------------------------------------------------------
async function openTrackerModal() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  toggleModal('tracker-modal', true);
  loadUserApplications();
}

async function loadUserApplications() {
  const tbody = document.getElementById('tracker-tbody');
  tbody.innerHTML = '<tr><td colspan="5">⏳ Loading your applications...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/applications`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load applications');
    const apps = await res.json();

    tbody.innerHTML = '';
    if (apps.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No tracked applications yet. Click "📝 Track Application" on any scholarship to monitor progress!</td></tr>';
      return;
    }

    apps.forEach(app => {
      const tr = document.createElement('tr');
      const statusClass = 'status-' + (app.status || 'not-started').toLowerCase().replace(/\s+/g, '-');
      tr.innerHTML = `
        <td>
          <strong>${escapeHtml(app.scheme_name || 'Scholarship')}</strong>
          <br><span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(app.scheme_ministry || '')}</span>
        </td>
        <td>
          <select onchange="updateApplicationStatus('${app.id}', this.value)" style="font-size: 0.8rem; padding: 4px;">
            ${['Not Started', 'Preparing', 'Applied', 'Under Review', 'Approved', 'Rejected', 'Completed']
              .map(st => `<option value="${st}" ${app.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
          <br><span class="status-badge ${statusClass}">${escapeHtml(app.status)}</span>
        </td>
        <td style="font-size: 0.8rem;">${app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '—'}</td>
        <td style="font-size: 0.8rem;">${escapeHtml(app.notes || '—')}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteApplication('${app.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

function openQuickAppModal(schemeId, schemeName) {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  document.getElementById('quick-app-scheme-id').value = schemeId;
  document.getElementById('quick-app-id').value = '';
  document.getElementById('quick-app-scheme-name').textContent = schemeName;
  document.getElementById('quick-app-notes').value = '';
  document.getElementById('quick-app-status').value = 'Preparing';
  toggleModal('quick-app-modal', true);
}

async function handleQuickAppSubmit(e) {
  e.preventDefault();
  const schemeId = document.getElementById('quick-app-scheme-id').value;
  const status = document.getElementById('quick-app-status').value;
  const notes = document.getElementById('quick-app-notes').value;

  try {
    const res = await fetch(`${API_URL}/api/applications`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ scheme_id: schemeId, status, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create application record');
    }
    toggleModal('quick-app-modal', false);
    alert('Application added to your tracker!');
    checkCurrentUser();
  } catch (err) {
    alert('Tracker Error: ' + err.message);
  }
}

async function updateApplicationStatus(appId, newStatus) {
  try {
    const res = await fetch(`${API_URL}/api/applications/${appId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error('Failed to update status');
    loadUserApplications();
    checkCurrentUser();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteApplication(appId) {
  if (!confirm('Remove this application from your tracker?')) return;
  try {
    const res = await fetch(`${API_URL}/api/applications/${appId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Delete failed');
    loadUserApplications();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// DOCUMENT VAULT (GENUINE FILE STORAGE & METADATA)
// ---------------------------------------------------------------------------
async function openVaultModal() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  toggleModal('vault-modal', true);
  loadVaultDocuments();
}

async function loadVaultDocuments() {
  const tbody = document.getElementById('vault-tbody');
  tbody.innerHTML = '<tr><td colspan="5">⏳ Loading vault documents...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/documents`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load documents');
    const docs = await res.json();

    tbody.innerHTML = '';
    if (docs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No certificates or documents uploaded yet. Use the upload box above to store your verified files.</td></tr>';
      return;
    }

    docs.forEach(doc => {
      const tr = document.createElement('tr');
      const kb = (doc.file_size / 1024).toFixed(1);
      const date = new Date(doc.uploaded_at).toLocaleDateString();

      tr.innerHTML = `
        <td><strong>${escapeHtml(doc.doc_type)}</strong></td>
        <td>${escapeHtml(doc.file_name)}</td>
        <td>${kb} KB</td>
        <td>${date}</td>
        <td>
          <a href="${API_URL}/api/documents/${doc.id}/download" target="_blank" class="btn btn-secondary btn-sm">View / Download</a>
          <button class="btn btn-danger btn-sm" onclick="deleteVaultDocument('${doc.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function handleVaultUploadSubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById('doc-file-input');
  const typeSelect = document.getElementById('doc-type-select');
  const errDiv = document.getElementById('vault-error');
  const succDiv = document.getElementById('vault-success');

  errDiv.classList.add('hidden');
  succDiv.classList.add('hidden');

  if (!fileInput.files || fileInput.files.length === 0) {
    errDiv.textContent = 'Please choose a file to upload.';
    errDiv.classList.remove('hidden');
    return;
  }

  const file = fileInput.files[0];
  if (file.size > 5 * 1024 * 1024) {
    errDiv.textContent = 'File size exceeds maximum 5MB limit.';
    errDiv.classList.remove('hidden');
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];
    try {
      const res = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          docType: typeSelect.value,
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || 'application/octet-stream',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      succDiv.textContent = `Document "${file.name}" safely stored in your vault!`;
      succDiv.classList.remove('hidden');
      fileInput.value = '';
      loadVaultDocuments();
      checkCurrentUser();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.classList.remove('hidden');
    }
  };
  reader.onerror = () => {
    errDiv.textContent = 'Failed to read local file.';
    errDiv.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function deleteVaultDocument(docId) {
  if (!confirm('Permanently delete this document from your vault?')) return;
  try {
    const res = await fetch(`${API_URL}/api/documents/${docId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Delete failed');
    loadVaultDocuments();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------------
async function openNotificationsModal() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  toggleModal('notif-modal', true);
  loadNotifications();
}

async function loadNotifications() {
  const container = document.getElementById('notif-list');
  container.innerHTML = '<div class="empty-state">⏳ Loading alerts...</div>';

  try {
    const res = await fetch(`${API_URL}/api/notifications`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load notifications');
    const notifs = await res.json();

    container.innerHTML = '';
    if (notifs.length === 0) {
      container.innerHTML = '<div class="empty-state">No alerts or notifications at this time.</div>';
      return;
    }

    notifs.forEach(n => {
      const item = document.createElement('div');
      item.className = `notif-item ${n.is_read ? '' : 'unread'}`;
      const timeStr = new Date(n.created_at).toLocaleString();

      item.innerHTML = `
        <div>
          <div class="notif-item-title">${escapeHtml(n.title)}</div>
          <div class="notif-item-msg">${escapeHtml(n.message)}</div>
        </div>
        <div style="text-align: right;">
          <div class="notif-item-time">${timeStr}</div>
          ${!n.is_read ? `<button class="btn btn-secondary btn-sm" onclick="markNotificationRead('${n.id}', this)" style="margin-top: 4px; font-size: 0.7rem; padding: 2px 6px;">Mark Read</button>` : ''}
        </div>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state error-text">❌ ${err.message}</div>`;
  }
}

async function markNotificationRead(notifId, btn) {
  try {
    await fetch(`${API_URL}/api/notifications/${notifId}/read`, {
      method: 'POST',
      headers: getHeaders(),
    });
    btn.closest('.notif-item').classList.remove('unread');
    btn.remove();
    checkCurrentUser();
  } catch (e) {}
}

async function markAllNotificationsRead() {
  try {
    await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'POST',
      headers: getHeaders(),
    });
    loadNotifications();
    checkCurrentUser();
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// SERVICE REQUESTS (DONATION, VOLUNTEER, FEEDBACK)
// ---------------------------------------------------------------------------
async function handleDonationSubmit(e) {
  e.preventDefault();
  const statusDiv = document.getElementById('donation-status');
  statusDiv.classList.add('hidden');

  const payload = {
    type: 'donation',
    amount: document.getElementById('don-amount').value,
    name: document.getElementById('don-name').value,
    email: document.getElementById('don-email').value,
    pan: document.getElementById('don-pan').value,
    message: document.getElementById('don-message').value,
  };

  try {
    const res = await fetch(`${API_URL}/api/service-requests`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submission failed');

    statusDiv.textContent = data.message;
    statusDiv.classList.remove('hidden');
    document.getElementById('donation-form').reset();
    setTimeout(() => toggleModal('donation-modal', false), 4000);
  } catch (err) {
    alert('Donation error: ' + err.message);
  }
}

async function handleVolunteerSubmit(e) {
  e.preventDefault();
  const statusDiv = document.getElementById('volunteer-status');
  statusDiv.classList.add('hidden');

  const payload = {
    type: 'volunteer',
    name: document.getElementById('vol-name').value,
    email: document.getElementById('vol-email').value,
    interests: document.getElementById('vol-interests').value,
    availability: document.getElementById('vol-availability').value,
    message: document.getElementById('vol-message').value,
  };

  try {
    const res = await fetch(`${API_URL}/api/service-requests`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Volunteer registration failed');

    statusDiv.textContent = data.message;
    statusDiv.classList.remove('hidden');
    document.getElementById('volunteer-form').reset();
    setTimeout(() => toggleModal('volunteer-modal', false), 3500);
  } catch (err) {
    alert('Volunteer error: ' + err.message);
  }
}

async function handleFeedbackSubmit(e) {
  e.preventDefault();
  const statusDiv = document.getElementById('feedback-status');
  statusDiv.classList.add('hidden');

  const ratingEl = document.querySelector('input[name="rating"]:checked');
  const payload = {
    rating: ratingEl ? parseInt(ratingEl.value, 10) : 5,
    message: document.getElementById('fb-message').value,
  };

  try {
    const res = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send feedback');

    statusDiv.textContent = data.message;
    statusDiv.classList.remove('hidden');
    document.getElementById('feedback-form').reset();
    setTimeout(() => toggleModal('feedback-modal', false), 2500);
  } catch (err) {
    alert('Feedback error: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// ADMIN PORTAL & SUB-TABS
// ---------------------------------------------------------------------------
function initAdminSubnav() {
  const btns = document.querySelectorAll('.admin-subnav-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.getAttribute('data-admin-panel');
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(targetId)?.classList.remove('hidden');

      if (targetId === 'panel-schemes') loadAdminSchemes();
      else if (targetId === 'panel-users') loadAdminUsers();
      else if (targetId === 'panel-apps') loadAdminApplications();
      else if (targetId === 'panel-requests') loadAdminServiceRequests();
      else if (targetId === 'panel-feedback') loadAdminFeedback();
      else if (targetId === 'panel-audit') loadAdminAuditLogs();
    });
  });
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const password = document.getElementById('admin-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (!res.ok) {
      errorDiv.textContent = data.error || 'Authentication failed.';
      errorDiv.classList.remove('hidden');
    } else {
      currentAdminToken = data.token;
      localStorage.setItem('admin_token', currentAdminToken);
      updateAdminView();
      loadAdminDashboard();
    }
  } catch (err) {
    errorDiv.textContent = 'Network or server error.';
    errorDiv.classList.remove('hidden');
  }
}

function handleAdminLogout() {
  currentAdminToken = null;
  localStorage.removeItem('admin_token');
  updateAdminView();
}

function updateAdminView() {
  const loginView = document.getElementById('admin-login-view');
  const dashboardView = document.getElementById('admin-dashboard-view');
  if (currentAdminToken) {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  } else {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
}

async function loadAdminDashboard() {
  loadAdminSchemes();
  loadAdminUsers();
  loadAdminApplications();
  loadAdminServiceRequests();
  loadAdminFeedback();
}

async function loadAdminSchemes() {
  const tbody = document.getElementById('admin-schemes-tbody');
  tbody.innerHTML = '<tr><td colspan="7">⏳ Loading schemes...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/schemes`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to load schemes');
    const schemes = await res.json();

    document.getElementById('admin-schemes-count').textContent = schemes.length;
    tbody.innerHTML = '';
    if (schemes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No schemes in database.</td></tr>';
      return;
    }

    schemes.forEach(s => {
      const tr = document.createElement('tr');
      const domainInfo = domainsCache.find(d => d.id === s.domain) || { en: s.domain };

      tr.innerHTML = `
        <td><strong>${s.id}</strong></td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.ministry)} <br><span class="badge" style="font-size:0.7rem">${escapeHtml(s.level)}</span></td>
        <td>${escapeHtml(domainInfo.en)}</td>
        <td>${escapeHtml(s.benefit)}</td>
        <td>
          <label class="switch">
            <input type="checkbox" ${s.active ? 'checked' : ''} onchange="toggleSchemeActive('${s.id}')">
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editScheme('${s.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteScheme('${s.id}', '${escapeHtml(s.name).replace(/'/g, "\\'")}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = '<tr><td colspan="8">⏳ Loading users...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    const users = await res.json();

    document.getElementById('admin-users-count').textContent = users.length;
    tbody.innerHTML = '';
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No registered students yet.</td></tr>';
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');
      const date = new Date(u.created_at).toLocaleDateString();
      tr.innerHTML = `
        <td><strong>${u.id}</strong></td>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge">${u.role}</span></td>
        <td>${escapeHtml(u.state || '—')} / ${escapeHtml(u.education || '—')}</td>
        <td>${u.app_count}</td>
        <td>${u.doc_count}</td>
        <td>${date}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminApplications() {
  const tbody = document.getElementById('admin-apps-tbody');
  tbody.innerHTML = '<tr><td colspan="7">⏳ Loading applications...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/applications`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch applications');
    const apps = await res.json();

    document.getElementById('admin-apps-count').textContent = apps.length;
    tbody.innerHTML = '';
    if (apps.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No tracked applications in the system.</td></tr>';
      return;
    }

    apps.forEach(a => {
      const tr = document.createElement('tr');
      const statusClass = 'status-' + (a.status || 'not-started').toLowerCase().replace(/\s+/g, '-');
      tr.innerHTML = `
        <td><strong>${a.id}</strong></td>
        <td>${escapeHtml(a.user_name || 'Student')} <br><span style="font-size:0.75rem; color: var(--text-muted);">${escapeHtml(a.user_email || '')}</span></td>
        <td>${escapeHtml(a.scheme_name || a.scheme_id)}</td>
        <td><span class="status-badge ${statusClass}">${escapeHtml(a.status)}</span></td>
        <td>${a.applied_at ? new Date(a.applied_at).toLocaleDateString() : '—'}</td>
        <td style="font-size: 0.8rem;">${escapeHtml(a.notes || '—')}</td>
        <td style="font-size: 0.75rem;">${new Date(a.updated_at).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminServiceRequests() {
  const tbody = document.getElementById('admin-requests-tbody');
  tbody.innerHTML = '<tr><td colspan="5">⏳ Loading service requests...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/service-requests`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch service requests');
    const rows = await res.json();

    document.getElementById('admin-requests-count').textContent = rows.length;
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No service or donation requests.</td></tr>';
      return;
    }

    rows.forEach(r => {
      const tr = document.createElement('tr');
      let details = '';
      try {
        const d = JSON.parse(r.data);
        if (r.type === 'donation') {
          details = `<strong>₹${parseInt(d.amount).toLocaleString()}</strong> by ${escapeHtml(d.name)} (${escapeHtml(d.email)}) ${d.pan ? `[PAN: ${escapeHtml(d.pan)}]` : ''}`;
        } else if (r.type === 'volunteer') {
          details = `${escapeHtml(d.name)} (${escapeHtml(d.email)}) - Areas: ${escapeHtml(d.interests)} [${escapeHtml(d.availability || '')}]`;
        } else {
          details = escapeHtml(r.data);
        }
      } catch (e) {
        details = escapeHtml(r.data);
      }

      tr.innerHTML = `
        <td><strong>${r.id}</strong></td>
        <td><span class="badge">${r.type.toUpperCase()}</span></td>
        <td><span class="status-badge status-applied">${r.status}</span></td>
        <td>${details}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminFeedback() {
  const tbody = document.getElementById('admin-feedback-tbody');
  tbody.innerHTML = '<tr><td colspan="5">⏳ Loading feedback...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/feedback`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch feedback');
    const fbs = await res.json();

    document.getElementById('admin-feedback-count').textContent = fbs.length;
    tbody.innerHTML = '';
    if (fbs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No feedback received yet.</td></tr>';
      return;
    }

    fbs.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${f.id}</td>
        <td>${escapeHtml(f.user_name || 'Anonymous')} ${f.user_email ? `(${escapeHtml(f.user_email)})` : ''}</td>
        <td>${'⭐'.repeat(f.rating)} (${f.rating}/5)</td>
        <td>${escapeHtml(f.message)}</td>
        <td>${new Date(f.created_at).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminAuditLogs() {
  const tbody = document.getElementById('audit-logs-tbody');
  tbody.innerHTML = '<tr><td colspan="2">⏳ Loading logs...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/audit-log`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch audit log');
    const logs = await res.json();

    tbody.innerHTML = '';
    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2">No admin actions logged yet.</td></tr>';
      return;
    }

    logs.forEach(log => {
      const tr = document.createElement('tr');
      const dateStr = new Date(log.ts).toLocaleString();
      tr.innerHTML = `
        <td style="white-space: nowrap; color: var(--text-muted);">${dateStr}</td>
        <td><strong>${escapeHtml(log.message)}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="2" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function toggleSchemeActive(schemeId) {
  try {
    const res = await fetch(`${API_URL}/api/schemes/${schemeId}/toggle`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Toggle failed');
    loadAdminSchemes();
    loadStats();
  } catch (err) {
    alert('Error toggling scheme status: ' + err.message);
    loadAdminSchemes();
  }
}

async function deleteScheme(schemeId, name) {
  if (!confirm(`Are you sure you want to permanently delete the scheme "${name}"?`)) return;

  try {
    const res = await fetch(`${API_URL}/api/schemes/${schemeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Delete failed');
    loadAdminSchemes();
    loadStats();
  } catch (err) {
    alert('Error deleting scheme: ' + err.message);
  }
}

function openSchemeModal(scheme = null) {
  const title = document.getElementById('modal-title');
  const form = document.getElementById('scheme-form');
  form.reset();

  if (scheme) {
    title.textContent = `Edit Scheme: ${scheme.name}`;
    document.getElementById('scheme-form-id').value = scheme.id;
    document.getElementById('f-name').value = scheme.name;
    document.getElementById('f-shortDesc').value = scheme.shortDesc || '';
    document.getElementById('f-ministry').value = scheme.ministry || '';
    document.getElementById('f-level').value = scheme.level || 'Central';
    document.getElementById('f-domain').value = scheme.domain || '';

    document.getElementById('f-states').value = Array.isArray(scheme.states) ? JSON.stringify(scheme.states) : scheme.states;
    document.getElementById('f-category').value = Array.isArray(scheme.category) ? JSON.stringify(scheme.category) : scheme.category;
    document.getElementById('f-gender').value = scheme.gender || 'Any';
    document.getElementById('f-disability').value = scheme.disability || 'either';
    document.getElementById('f-minAge').value = scheme.minAge ?? '';
    document.getElementById('f-maxAge').value = scheme.maxAge ?? '';
    document.getElementById('f-incomeMax').value = scheme.incomeMax ?? '';
    document.getElementById('f-education').value = Array.isArray(scheme.education) ? JSON.stringify(scheme.education) : scheme.education;
    document.getElementById('f-occupation').value = Array.isArray(scheme.occupation) ? JSON.stringify(scheme.occupation) : scheme.occupation;

    document.getElementById('f-benefitType').value = scheme.benefitType || '';
    document.getElementById('f-benefit').value = scheme.benefit || '';
    document.getElementById('f-applyUrl').value = scheme.applyUrl || '';
    document.getElementById('f-deadline').value = scheme.deadline || 'Rolling';
    document.getElementById('f-documents').value = JSON.stringify(scheme.documents || []);
    document.getElementById('f-steps').value = JSON.stringify(scheme.steps || []);
  } else {
    title.textContent = 'Add New Scheme';
    document.getElementById('scheme-form-id').value = '';
    document.getElementById('f-level').value = 'Central';
    document.getElementById('f-states').value = 'All';
    document.getElementById('f-category').value = 'All';
    document.getElementById('f-gender').value = 'Any';
    document.getElementById('f-disability').value = 'either';
    document.getElementById('f-education').value = 'Any';
    document.getElementById('f-occupation').value = 'Any';
    document.getElementById('f-deadline').value = 'Rolling';
    document.getElementById('f-documents').value = '[]';
    document.getElementById('f-steps').value = '[]';
  }

  toggleModal('scheme-modal', true);
}

async function editScheme(schemeId) {
  try {
    const res = await fetch(`${API_URL}/api/schemes/${schemeId}`);
    if (!res.ok) throw new Error('Failed to load scheme details');
    const scheme = await res.json();
    openSchemeModal(scheme);
  } catch (err) {
    alert('Error fetching scheme: ' + err.message);
  }
}

function parseFlexInput(val) {
  if (!val) return 'All';
  const trimmed = val.trim();
  if (trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'any') {
    return trimmed;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  if (trimmed.includes(',')) {
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return trimmed;
}

async function handleSchemeFormSubmit(e) {
  e.preventDefault();
  const schemeId = document.getElementById('scheme-form-id').value;

  const payload = {
    name: document.getElementById('f-name').value,
    shortDesc: document.getElementById('f-shortDesc').value,
    ministry: document.getElementById('f-ministry').value,
    level: document.getElementById('f-level').value,
    domain: document.getElementById('f-domain').value,
    states: parseFlexInput(document.getElementById('f-states').value),
    category: parseFlexInput(document.getElementById('f-category').value),
    gender: document.getElementById('f-gender').value,
    disability: document.getElementById('f-disability').value,
    minAge: parseInt(document.getElementById('f-minAge').value) || null,
    maxAge: parseInt(document.getElementById('f-maxAge').value) || null,
    incomeMax: parseInt(document.getElementById('f-incomeMax').value) || null,
    education: parseFlexInput(document.getElementById('f-education').value),
    occupation: parseFlexInput(document.getElementById('f-occupation').value),
    benefitType: document.getElementById('f-benefitType').value,
    benefit: document.getElementById('f-benefit').value,
    applyUrl: document.getElementById('f-applyUrl').value,
    deadline: document.getElementById('f-deadline').value,
    documents: JSON.parse(document.getElementById('f-documents').value || '[]'),
    steps: JSON.parse(document.getElementById('f-steps').value || '[]'),
  };

  const method = schemeId ? 'PUT' : 'POST';
  const url = schemeId ? `${API_URL}/api/schemes/${schemeId}` : `${API_URL}/api/schemes`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to save scheme');
    }

    toggleModal('scheme-modal', false);
    loadAdminSchemes();
    loadStats();
  } catch (err) {
    alert('Error saving scheme: ' + err.message);
  }
}

async function handleBulkImportSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('bulk-json-input').value;
  const errorDiv = document.getElementById('bulk-error');
  const successDiv = document.getElementById('bulk-success');

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    errorDiv.textContent = 'Invalid JSON: ' + err.message;
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/schemes/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`,
      },
      body: JSON.stringify(parsed),
    });

    const data = await res.json();
    if (!res.ok) {
      errorDiv.textContent = data.error || 'Bulk import failed.';
      errorDiv.classList.remove('hidden');
    } else {
      successDiv.textContent = `Successfully imported ${data.imported} schemes.`;
      successDiv.classList.remove('hidden');
      document.getElementById('bulk-json-input').value = '';
      setTimeout(() => {
        toggleModal('bulk-modal', false);
        successDiv.classList.add('hidden');
      }, 1500);
      loadAdminSchemes();
      loadStats();
    }
  } catch (err) {
    errorDiv.textContent = 'Server error: ' + err.message;
    errorDiv.classList.remove('hidden');
  }
}

// ---------------------------------------------------------------------------
// MODAL HELPER
// ---------------------------------------------------------------------------
function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  if (show) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

// ===========================================================================
// AI CHAT ASSISTANT & VOICE GUIDANCE (SCHEMEMITRA AI)
// ===========================================================================
let aiVoiceEnabled = true;
let aiSpeechRecognition = null;
let isVoiceListening = false;

function initAIAssistant() {
  const toggleBtn = document.getElementById('ai-assistant-toggle');
  const container = document.getElementById('ai-assistant-container');
  const closeBtn = document.getElementById('ai-close-btn');
  const clearBtn = document.getElementById('ai-clear-btn');
  const voiceToggle = document.getElementById('ai-voice-toggle');
  const form = document.getElementById('ai-chat-form');
  const input = document.getElementById('ai-chat-input');
  const micBtn = document.getElementById('ai-mic-btn');
  const cancelSpeechBtn = document.getElementById('ai-speech-cancel');
  const chipsContainer = document.getElementById('ai-suggestion-chips');

  if (!toggleBtn || !container) return;

  // Toggle open/close
  toggleBtn.addEventListener('click', () => {
    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
      container.classList.remove('hidden');
      input?.focus();
    } else {
      container.classList.add('hidden');
      stopVoiceRecognition();
    }
  });

  closeBtn?.addEventListener('click', () => {
    container.classList.add('hidden');
    stopVoiceRecognition();
  });

  // Clear chat
  clearBtn?.addEventListener('click', () => {
    const messagesEl = document.getElementById('ai-chat-messages');
    if (!messagesEl) return;
    messagesEl.innerHTML = `
      <div class="ai-msg ai-msg-bot">
        <div class="ai-msg-bubble">
          <strong>Chat cleared! ✨</strong> How can I assist you with Indian scholarships or website guidance today?
        </div>
      </div>
    `;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  });

  // Voice narration toggle (Mute / Unmute)
  voiceToggle?.addEventListener('click', () => {
    aiVoiceEnabled = !aiVoiceEnabled;
    if (aiVoiceEnabled) {
      voiceToggle.classList.add('active');
      voiceToggle.textContent = '🔊';
      voiceToggle.title = 'Voice Output: Enabled (Click to Mute)';
      showToast('AI Voice guidance enabled 🔊', 'info');
    } else {
      voiceToggle.classList.remove('active');
      voiceToggle.textContent = '🔇';
      voiceToggle.title = 'Voice Output: Muted (Click to Unmute)';
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      showToast('AI Voice output muted 🔇', 'info');
    }
  });

  // Form submit
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    input.value = '';
    sendAIMessage(query);
  });

  // Suggestion chips
  chipsContainer?.addEventListener('click', (e) => {
    const chip = e.target.closest('.ai-chip');
    if (!chip) return;
    const prompt = chip.getAttribute('data-prompt') || chip.textContent.trim();
    sendAIMessage(prompt);
  });

  // Voice recognition mic button
  micBtn?.addEventListener('click', toggleVoiceRecognition);
  cancelSpeechBtn?.addEventListener('click', stopVoiceRecognition);
}

async function sendAIMessage(query) {
  const messagesEl = document.getElementById('ai-chat-messages');
  if (!messagesEl) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Render User bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg ai-msg-user';
  userMsg.innerHTML = `
    <div class="ai-msg-bubble">${escapeHtml(query)}</div>
    <div class="ai-msg-footer" style="justify-content: flex-end;">
      <span class="ai-msg-time">${timeStr}</span>
    </div>
  `;
  messagesEl.appendChild(userMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Render Typing indicator
  const typingMsg = document.createElement('div');
  typingMsg.className = 'ai-msg ai-msg-bot';
  typingMsg.innerHTML = `
    <div class="ai-msg-bubble">
      <div class="ai-typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messagesEl.appendChild(typingMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const res = await fetch(`${API_URL}/api/ai-chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message: query }),
    });
    const data = await res.json();
    typingMsg.remove();

    if (!res.ok) throw new Error(data.error || 'Unable to get response');

    // Render Bot bubble with markdown-like parsing
    const botMsg = document.createElement('div');
    botMsg.className = 'ai-msg ai-msg-bot';

    let formatted = formatAIMarkdown(data.reply || 'Here is what I found for you.');

    // If scheme recommendation cards are returned
    let schemesCardsHtml = '';
    if (Array.isArray(data.schemes) && data.schemes.length > 0) {
      schemesCardsHtml = `
        <div class="ai-scheme-cards-box">
          ${data.schemes.map(s => `
            <div class="ai-mini-scheme-card">
              <div class="ai-mini-card-head">
                <span class="ai-mini-domain-tag">${escapeHtml(s.domain || 'Welfare')}</span>
                <span class="ai-mini-deadline">⏳ ${escapeHtml(s.deadline || 'Rolling')}</span>
              </div>
              <h5 class="ai-mini-scheme-title">${escapeHtml(s.name)}</h5>
              <p class="ai-mini-scheme-benefit">💰 ${escapeHtml(s.benefit || 'Financial Support')}</p>
              <div class="ai-mini-actions">
                ${s.applyUrl ? `<a href="${escapeHtml(s.applyUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-light">Apply ↗</a>` : ''}
                <button type="button" class="btn btn-sm btn-secondary" onclick="trackSchemeFromAI('${escapeHtml(s.id)}', '${escapeHtml(s.name).replace(/'/g, "\\'")}')">Track 📋</button>
                <button type="button" class="btn btn-sm btn-secondary" onclick="bookmarkSchemeFromAI('${escapeHtml(s.id)}')">Save 🔖</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // If an action button is recommended
    let actionBtnHtml = '';
    if (data.action) {
      if (data.action === 'START_TOUR') {
        actionBtnHtml = `<br><button type="button" class="ai-action-btn-bubble" onclick="startWebsiteTour()">🧭 Start Interactive Tour</button>`;
      } else if (data.action === 'OPEN_SERVICES') {
        actionBtnHtml = `<br><button type="button" class="ai-action-btn-bubble" onclick="openServicesFromAI()">⚡ Open Services Menu</button>`;
      } else if (data.action === 'OPEN_MODAL' && data.target) {
        actionBtnHtml = `<br><button type="button" class="ai-action-btn-bubble" onclick="toggleModal('${data.target}', true)">🚀 Open Now</button>`;
      } else if (data.action === 'SCROLL_TO_MATCH') {
        actionBtnHtml = `<br><button type="button" class="ai-action-btn-bubble" onclick="scrollToMatcherFromAI()">🎯 Go to Matcher</button>`;
      }
    }

    botMsg.innerHTML = `
      <div class="ai-msg-bubble">
        ${formatted}
        ${actionBtnHtml}
        ${schemesCardsHtml}
      </div>
      <div class="ai-msg-footer">
        <span class="ai-msg-time">${timeStr}</span>
        <button type="button" class="ai-msg-copy-btn" onclick="copyAIMessage(this)" title="Copy assistant answer">📋 Copy</button>
      </div>
    `;
    messagesEl.appendChild(botMsg);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Execute direct UI action automatically if appropriate
    if (data.action) {
      executeAssistantAction(data.action, data.target);
    }

    // Update suggestion chips
    if (Array.isArray(data.chips) && data.chips.length > 0) {
      updateSuggestionChips(data.chips);
    }

    // Voice narration
    if (aiVoiceEnabled && data.voiceText) {
      speakAIText(data.voiceText);
    }
  } catch (err) {
    typingMsg.remove();
    const errorMsg = document.createElement('div');
    errorMsg.className = 'ai-msg ai-msg-bot';
    errorMsg.innerHTML = `
      <div class="ai-msg-bubble" style="color:#ef4444;">⚠️ <strong>Notice:</strong> ${escapeHtml(err.message)}</div>
      <div class="ai-msg-footer">
        <span class="ai-msg-time">${timeStr}</span>
      </div>
    `;
    messagesEl.appendChild(errorMsg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function copyAIMessage(btn) {
  const bubble = btn.closest('.ai-msg').querySelector('.ai-msg-bubble');
  if (!bubble) return;
  const text = bubble.innerText.replace(/Apply ↗|Track 📋|Save 🔖/g, '').trim();
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  }).catch(() => {
    showToast('Failed to copy message to clipboard', 'error');
  });
}

function trackSchemeFromAI(schemeId, schemeName) {
  if (!currentStudentToken) {
    showToast('Sign in or continue as student to track applications!', 'info');
    toggleModal('auth-modal', true);
    return;
  }
  openQuickAppModal(schemeId, schemeName);
}

async function bookmarkSchemeFromAI(schemeId) {
  await toggleBookmark(schemeId);
}

function updateSuggestionChips(chips) {
  const container = document.getElementById('ai-suggestion-chips');
  if (!container) return;
  container.innerHTML = chips.map(c => `<button type="button" class="ai-chip" data-prompt="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
}

function formatAIMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>');
  html = html.replace(/^###\s+(.+)$/gm, '<h4 style="margin:4px 0 6px 0;font-size:0.95rem;color:#0f172a;">$1</h4>');
  html = html.replace(/^\s*[•\-]\s+(.+)$/gm, '<div style="margin-left:8px;padding-left:6px;border-left:2px solid #cbd5e1;margin-bottom:4px;">• $1</div>');
  html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  return html;
}

// ---------------------------------------------------------------------------
// VOICE SYNTHESIS (TEXT-TO-SPEECH)
// ---------------------------------------------------------------------------
function speakAIText(text) {
  if (!('speechSynthesis' in window) || !aiVoiceEnabled) return;

  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#_`\[\]()•]/g, ' ').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.0;
  utterance.pitch = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const indianVoice = voices.find(v => v.lang === 'en-IN' || v.name.includes('India')) ||
                      voices.find(v => v.lang.startsWith('en'));
  if (indianVoice) utterance.voice = indianVoice;

  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// SPEECH RECOGNITION (VOICE-TO-TEXT)
// ---------------------------------------------------------------------------
function toggleVoiceRecognition() {
  if (isVoiceListening) {
    stopVoiceRecognition();
  } else {
    startVoiceRecognition();
  }
}

function startVoiceRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    showToast('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.', 'error');
    return;
  }

  try {
    aiSpeechRecognition = new SpeechRec();
    aiSpeechRecognition.lang = 'en-IN';
    aiSpeechRecognition.continuous = false;
    aiSpeechRecognition.interimResults = false;

    const micBtn = document.getElementById('ai-mic-btn');
    const speechBar = document.getElementById('ai-speech-indicator');

    aiSpeechRecognition.onstart = () => {
      isVoiceListening = true;
      micBtn?.classList.add('listening');
      speechBar?.classList.remove('hidden');
    };

    aiSpeechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        const input = document.getElementById('ai-chat-input');
        if (input) input.value = transcript;
        sendAIMessage(transcript);
      }
    };

    aiSpeechRecognition.onerror = (e) => {
      console.warn('Voice recognition error:', e.error);
      stopVoiceRecognition();
      if (e.error === 'not-allowed') {
        showToast('Microphone access blocked. Please allow mic permissions in your browser.', 'error');
      }
    };

    aiSpeechRecognition.onend = () => {
      stopVoiceRecognition();
    };

    aiSpeechRecognition.start();
  } catch (err) {
    console.error('Failed to start speech recognition:', err);
    stopVoiceRecognition();
  }
}

function stopVoiceRecognition() {
  isVoiceListening = false;
  const micBtn = document.getElementById('ai-mic-btn');
  const speechBar = document.getElementById('ai-speech-indicator');
  micBtn?.classList.remove('listening');
  speechBar?.classList.add('hidden');
  if (aiSpeechRecognition) {
    try { aiSpeechRecognition.stop(); } catch(e) {}
    aiSpeechRecognition = null;
  }
}

// ---------------------------------------------------------------------------
// ASSISTANT GUIDANCE & PAGE ACTIONS
// ---------------------------------------------------------------------------
function executeAssistantAction(action, target) {
  if (action === 'OPEN_SERVICES') {
    openServicesFromAI();
  } else if (action === 'OPEN_MODAL' && target) {
    toggleModal(target, true);
  } else if (action === 'SCROLL_TO_MATCH') {
    scrollToMatcherFromAI();
  }
}

function openServicesFromAI() {
  const menu = document.getElementById('services-menu');
  const btn = document.getElementById('btn-services-menu');
  if (menu) {
    menu.classList.remove('hidden');
    btn?.setAttribute('aria-expanded', 'true');
    menu.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function scrollToMatcherFromAI() {
  const form = document.getElementById('matcher-form');
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const stateEl = document.getElementById('state');
    if (stateEl) stateEl.focus();
  }
}

function startWebsiteTour() {
  const messagesEl = document.getElementById('ai-chat-messages');
  if (!messagesEl) return;

  const tourMsg = document.createElement('div');
  tourMsg.className = 'ai-msg ai-msg-bot';
  tourMsg.innerHTML = `
    <div class="ai-msg-bubble">
      <strong>🚀 Starting Interactive Website Tour:</strong>
      <ol style="margin:8px 0 8px 18px;padding:0;line-height:1.6;">
        <li><strong>Eligibility Matcher</strong>: Uses our 9-criteria matching engine to recommend exact scholarships for your caste, income, and state.</li>
        <li><strong>⚡ Services Menu</strong>: Located in the top bar with quick access to your Application Tracker, Vault, and Alerts.</li>
        <li><strong>Document Vault</strong>: Safeguard your Income, Caste, and Marks certificates safely on your device.</li>
        <li><strong>Application Tracker</strong>: Never miss a deadline or scholarship status change!</li>
      </ol>
      <em>You can say "Open Tracker", "Open Vault", or "Show Services" anytime!</em>
    </div>
  `;
  messagesEl.appendChild(tourMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const speechText = "Welcome to the interactive tour! Step one: use our eligibility matcher form to find scholarships matching your profile. Step two: open the Services menu in the top bar for your Application Tracker and Document Vault. Step three: safely upload your certificates in the Document Vault. Enjoy exploring!";
  if (aiVoiceEnabled) speakAIText(speechText);
}

// Global hooks for inline onclick handlers
window.startWebsiteTour = startWebsiteTour;
window.openServicesFromAI = openServicesFromAI;
window.scrollToMatcherFromAI = scrollToMatcherFromAI;
window.copyAIMessage = copyAIMessage;
window.trackSchemeFromAI = trackSchemeFromAI;
window.bookmarkSchemeFromAI = bookmarkSchemeFromAI;
window.shareSchemeLink = shareSchemeLink;

