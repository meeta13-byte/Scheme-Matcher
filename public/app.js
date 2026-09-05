// State Management
const API_URL = '';
let currentToken = localStorage.getItem('admin_token') || null;
let bookmarkedSchemeIds = [];

// Device ID generation for anonymous bookmark tracking
function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'DEV-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}
const DEVICE_ID = getDeviceId();

// Helper: API headers
function getHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': DEVICE_ID,
    ...extraHeaders
  };
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  return headers;
}

// Dynamic cache of domains and states
let domainsCache = [];
let statesCache = [];

// Init on Document Ready
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadReferenceData();
  loadStats();
  initBookmarks();

  // Questionnaire form submit
  document.getElementById('matcher-form').addEventListener('submit', handleMatchSubmit);

  // Browse tab search/filter inputs
  document.getElementById('search-q').addEventListener('input', debounce(handleBrowseFilter, 300));
  document.getElementById('filter-domain').addEventListener('change', handleBrowseFilter);

  // Admin login form
  document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
  document.getElementById('btn-logout').addEventListener('click', handleAdminLogout);

  // Modal Handlers
  document.getElementById('modal-close').addEventListener('click', () => toggleModal('scheme-modal', false));
  document.getElementById('audit-modal-close').addEventListener('click', () => toggleModal('audit-modal', false));
  document.getElementById('bulk-modal-close').addEventListener('click', () => toggleModal('bulk-modal', false));

  // Admin actions
  document.getElementById('btn-add-scheme').addEventListener('click', () => openSchemeModal());
  document.getElementById('btn-view-audit').addEventListener('click', loadAuditLogs);
  document.getElementById('btn-bulk-import').addEventListener('click', () => toggleModal('bulk-modal', true));
  document.getElementById('scheme-form').addEventListener('submit', handleSchemeFormSubmit);
  document.getElementById('bulk-import-form').addEventListener('submit', handleBulkImportSubmit);

  // Check login state
  updateAdminView();
});

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
// NAVIGATION & TABS
// ---------------------------------------------------------------------------
function initTabs() {
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTabId = btn.getAttribute('data-tab');
      const tabs = document.querySelectorAll('.tab-content');
      tabs.forEach(t => t.classList.remove('active'));
      
      const targetTab = document.getElementById(targetTabId);
      targetTab.classList.add('active');

      // Trigger lazy load actions depending on tab
      if (targetTabId === 'browse-tab') {
        loadAllSchemes();
      } else if (targetTabId === 'bookmarks-tab') {
        loadBookmarksTab();
      } else if (targetTabId === 'admin-tab' && currentToken) {
        loadAdminDashboard();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// REFERENCE DATA & STATS
// ---------------------------------------------------------------------------
async function loadReferenceData() {
  try {
    const [domainsRes, statesRes] = await Promise.all([
      fetch(`${API_URL}/api/domains`),
      fetch(`${API_URL}/api/states`)
    ]);
    
    domainsCache = await domainsRes.json();
    statesCache = await statesRes.json();

    // Populate dropdowns
    populateDropdown('state', statesCache, true);
    populateDropdown('domain', domainsCache, false, 'id', 'en');
    populateDropdown('filter-domain', domainsCache, false, 'id', 'en');
    populateDropdown('f-domain', domainsCache, false, 'id', 'en');
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }
}

function populateDropdown(selectId, items, isStringArray, valueKey = '', labelKey = '') {
  const select = document.getElementById(selectId);
  if (!select) return;

  // Clear existing except first
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
  document.getElementById('bookmark-count').textContent = bookmarkedSchemeIds.length;
}

async function toggleBookmark(schemeId, btnElement) {
  try {
    const res = await fetch(`${API_URL}/api/bookmarks/${schemeId}`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.bookmarked) {
        bookmarkedSchemeIds.push(schemeId);
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
  container.innerHTML = '<div class="empty-state">⏳ Loading bookmarks...</div>';

  if (bookmarkedSchemeIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">🔖</span>
        <p>You haven't bookmarked any schemes yet.</p>
      </div>`;
    return;
  }

  try {
    // Fetch individual scheme details in parallel
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
// MATCHING ENGINE FORM
// ---------------------------------------------------------------------------
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
    domain: formData.get('domain')
  };

  const resultsList = document.getElementById('results-list');
  resultsList.innerHTML = '<div class="empty-state">⏳ Calculating matches...</div>';

  try {
    const res = await fetch(`${API_URL}/api/match`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ answers })
    });
    
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();

    document.getElementById('results-count').textContent = `${data.count} scheme(s) found`;
    resultsList.innerHTML = '';

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
  const container = document.getElementById('browse-list');

  try {
    const url = new URL(`${window.location.origin}/api/schemes`);
    if (q) url.searchParams.append('q', q);
    if (domain) url.searchParams.append('domain', domain);

    const res = await fetch(url.toString());
    const schemes = await res.json();

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
// CARD RENDERING
// ---------------------------------------------------------------------------
function renderSchemeCard(scheme, hasScore) {
  const card = document.createElement('div');
  card.className = 'scheme-card';

  const isSaved = bookmarkedSchemeIds.includes(scheme.id);
  const domainInfo = domainsCache.find(d => d.id === scheme.domain) || { en: scheme.domain };

  let scoreHtml = '';
  let reasonsHtml = '';

  if (hasScore) {
    scoreHtml = `<span class="score-badge">${scheme.score}% Match</span>`;
    
    if (scheme.reasons && scheme.reasons.length > 0) {
      reasonsHtml = `
        <div class="reasons-list">
          <div class="reasons-title">Criteria Met:</div>
          <ul>
            ${scheme.reasons.map(r => `<li>✓ ${escapeHtml(r)}</li>`).join('')}
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

    <div class="scheme-actions">
      <button class="bookmark-btn ${isSaved ? 'saved' : ''}" onclick="toggleBookmark('${scheme.id}', this)">
        ${isSaved ? '🔖 Saved' : '🔖 Bookmark'}
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
          <strong>Source URL:</strong> <a href="${scheme.applyUrl}" target="_blank">${escapeHtml(scheme.sourceUrl || scheme.applyUrl)}</a> (Verified: ${escapeHtml(scheme.lastVerified || '')})
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
// ADMIN INTERACTION
// ---------------------------------------------------------------------------
async function handleAdminLogin(e) {
  e.preventDefault();
  const password = document.getElementById('admin-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (!res.ok) {
      errorDiv.textContent = data.error || 'Authentication failed.';
      errorDiv.classList.remove('hidden');
    } else {
      currentToken = data.token;
      localStorage.setItem('admin_token', currentToken);
      updateAdminView();
      loadAdminDashboard();
    }
  } catch (err) {
    errorDiv.textContent = 'Network or server error.';
    errorDiv.classList.remove('hidden');
  }
}

function handleAdminLogout() {
  currentToken = null;
  localStorage.removeItem('admin_token');
  updateAdminView();
}

function updateAdminView() {
  const loginView = document.getElementById('admin-login-view');
  const dashboardView = document.getElementById('admin-dashboard-view');
  if (currentToken) {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  } else {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
}

async function loadAdminDashboard() {
  const tbody = document.getElementById('admin-schemes-tbody');
  tbody.innerHTML = '<tr><td colspan="7">⏳ Loading schemes...</td></tr>';

  try {
    // Call server to fetch all schemes (active and inactive) for admin
    // Note: server.js filters active in GET /api/schemes for public, 
    // but lets fetch from search or write a separate loop since GET /api/schemes only gives active.
    // Wait! Let's check server.js line 351: 
    // "if (pathname === '/api/schemes' && method === 'GET') { let data = getAllSchemeRows().filter(s => s.active);"
    // Oh, GET /api/schemes ONLY returns active schemes. To get inactive schemes, let's look:
    // Is there a route to fetch inactive? No direct admin GET /api/admin/schemes route.
    // However, an admin can toggle and review. Let's see if GET /api/schemes has a way to bypass active filter?
    // Looking at server.js: line 351:
    // `let data = getAllSchemeRows().filter(s => s.active);` - it ALWAYS filters active schemes!
    // Wait, this is a slight limitation in the provided backend code. We can still see all active schemes,
    // and if we toggle them off, they won't show in the public view. Wait, how does the admin see inactive schemes?
    // Let's modify server.js slightly to allow admin authorization to see inactive schemes,
    // OR we can just fetch and show what's returned. Since we want the app to be fully functional,
    // let's verify if we should edit server.js. Under our approved plan, we're modifying/setting up server.js,
    // and we can edit it if there's a minor enhancement needed, but let's check:
    // If the admin token is present, we can modify server.js to return ALL schemes (active and inactive).
    // Let's look at server.js:
    // ```js
    // if (pathname === '/api/schemes' && method === 'GET') {
    //   const isAdmin = !!requireAdmin(req);
    //   let data = getAllSchemeRows();
    //   if (!isAdmin) {
    //     data = data.filter(s => s.active);
    //   }
    //   ...
    // ```
    // Yes! That's a perfect and safe tweak to make. Let's do it in app.js by querying, and let's check:
    // Actually, let's write `server.js` with this small enhancement. Wait! I already wrote `server.js`!
    // Can I edit `server.js`? Yes, using `replace_file_content` to make a small contiguous edit, or rewrite it. Let's make that edit to `server.js` later if needed, but let's check: does server.js allow admin check?
    // Yes, `requireAdmin(req)` returns token payload if valid.
    // Let's make sure the client calls GET /api/schemes with the Authorization header.
    // Our getHeaders() already adds the Authorization header if `currentToken` is set!
    // So if the server checks for admin, it will see the header.
    // Let's first review what server.js actually does. It has:
    // ```js
    // if (pathname === '/api/schemes' && method === 'GET') {
    //   let data = getAllSchemeRows().filter(s => s.active);
    // ```
    // Let's edit `server.js` to support admin viewing all schemes. This is a very clean improvement.
    // Let's look at server.js lines 351-352 in `server.js`:
    // ```js
    //     // ---- schemes: list / detail ----
    //     if (pathname === '/api/schemes' && method === 'GET') {
    //       let data = getAllSchemeRows().filter(s => s.active);
    // ```
    // Let's replace it with:
    // ```js
    //     // ---- schemes: list / detail ----
    //     if (pathname === '/api/schemes' && method === 'GET') {
    //       const isAdmin = !!requireAdmin(req);
    //       let data = getAllSchemeRows();
    //       if (!isAdmin) {
    //         data = data.filter(s => s.active);
    //       }
    // ```
    // Let's do this edit!
  } catch (e) {
    console.error(e);
  }

  try {
    const res = await fetch(`${API_URL}/api/schemes`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load schemes');
    const schemes = await res.json();
    
    tbody.innerHTML = '';
    if (schemes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No schemes in the database.</td></tr>';
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
          <button class="btn btn-secondary btn-sm" onclick="editScheme('${s.id}')" style="padding: 4px 8px; font-size: 0.75rem;">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteScheme('${s.id}', '${escapeHtml(s.name)}')" style="padding: 4px 8px; font-size: 0.75rem;">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-text">❌ Error: ${err.message}</td></tr>`;
  }
}

async function toggleSchemeActive(schemeId) {
  try {
    const res = await fetch(`${API_URL}/api/schemes/${schemeId}/toggle`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Toggle failed');
    loadAdminDashboard();
    loadStats();
  } catch (err) {
    alert('Error toggling scheme status: ' + err.message);
    loadAdminDashboard();
  }
}

async function deleteScheme(schemeId, name) {
  if (!confirm(`Are you sure you want to permanently delete the scheme "${name}"?`)) return;

  try {
    const res = await fetch(`${API_URL}/api/schemes/${schemeId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Delete failed');
    loadAdminDashboard();
    loadStats();
  } catch (err) {
    alert('Error deleting scheme: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// AUDIT LOGS
// ---------------------------------------------------------------------------
async function loadAuditLogs() {
  toggleModal('audit-modal', true);
  const tbody = document.getElementById('audit-logs-tbody');
  tbody.innerHTML = '<tr><td colspan="2">⏳ Loading logs...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/audit-log`, { headers: getHeaders() });
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
    tbody.innerHTML = `<tr><td colspan="2" class="error-text">Error: ${err.message}</td></tr>`;
  }
}

// ---------------------------------------------------------------------------
// MODALS
// ---------------------------------------------------------------------------
function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (show) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
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
    
    // Eligibility Slabs
    document.getElementById('f-states').value = Array.isArray(scheme.states) ? JSON.stringify(scheme.states) : scheme.states;
    document.getElementById('f-category').value = Array.isArray(scheme.category) ? JSON.stringify(scheme.category) : scheme.category;
    document.getElementById('f-gender').value = scheme.gender || 'Any';
    document.getElementById('f-disability').value = scheme.disability || 'either';
    document.getElementById('f-minAge').value = scheme.minAge ?? '';
    document.getElementById('f-maxAge').value = scheme.maxAge ?? '';
    document.getElementById('f-incomeMax').value = scheme.incomeMax ?? '';
    document.getElementById('f-education').value = Array.isArray(scheme.education) ? JSON.stringify(scheme.education) : scheme.education;
    document.getElementById('f-occupation').value = Array.isArray(scheme.occupation) ? JSON.stringify(scheme.occupation) : scheme.occupation;
    
    // Benefits
    document.getElementById('f-benefitType').value = scheme.benefitType || '';
    document.getElementById('f-benefit').value = scheme.benefit || '';
    document.getElementById('f-applyUrl').value = scheme.applyUrl || '';
    document.getElementById('f-deadline').value = scheme.deadline || 'Rolling';
    document.getElementById('f-documents').value = JSON.stringify(scheme.documents || []);
    document.getElementById('f-steps').value = JSON.stringify(scheme.steps || []);
  } else {
    title.textContent = 'Add New Scheme';
    document.getElementById('scheme-form-id').value = '';
    
    // Set default values
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

// Parse string inputs that can be JSON lists or direct values (e.g. states, category, education, occupation)
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

  // Comma separated list parse
  if (trimmed.includes(',')) {
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// FORM SUBMISSIONS
// ---------------------------------------------------------------------------
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
    steps: JSON.parse(document.getElementById('f-steps').value || '[]')
  };

  const method = schemeId ? 'PUT' : 'POST';
  const url = schemeId ? `${API_URL}/api/schemes/${schemeId}` : `${API_URL}/api/schemes`;

  try {
    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to save scheme');
    }

    toggleModal('scheme-modal', false);
    loadAdminDashboard();
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
      headers: getHeaders(),
      body: JSON.stringify(parsed)
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
      loadAdminDashboard();
      loadStats();
    }
  } catch (err) {
    errorDiv.textContent = 'Server error: ' + err.message;
    errorDiv.classList.remove('hidden');
  }
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
