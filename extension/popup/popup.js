const API_URL = 'http://localhost:3000/api';
const AUTH_TOKEN_KEY = 'authToken';
const USER_EMAIL_KEY = 'userEmail';
const DEVICE_ID_KEY = 'deviceId';

const state = {
  token: null,
  email: null,
  deviceId: null,
  plan: null,
};

const elements = {
  authSection: document.getElementById('authSection'),
  planSection: document.getElementById('planSection'),
  appSections: document.querySelectorAll('.app-section'),
  usernameInput: document.getElementById('usernameInput'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  loginBtn: document.getElementById('loginBtn'),
  registerBtn: document.getElementById('registerBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  upgradeBtn: document.getElementById('upgradeBtn'),
  planBadge: document.getElementById('planBadge'),
  accountEmail: document.getElementById('accountEmail'),
  bookmarkUsage: document.getElementById('bookmarkUsage'),
  bookmarkMeter: document.getElementById('bookmarkMeter'),
  deviceUsage: document.getElementById('deviceUsage'),
  captureTabBtn: document.getElementById('captureTab'),
  syncTabsBtn: document.getElementById('syncTabs'),
  syncBookmarksBtn: document.getElementById('syncBookmarks'),
  closeSavedTabsBtn: document.getElementById('closeSavedTabs'),
  findSavedBookmarksBtn: document.getElementById('findSavedBookmarks'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  semanticSearchBtn: document.getElementById('semanticSearchBtn'),
  getSuggestionsBtn: document.getElementById('getSuggestions'),
  suggestionsContainer: document.getElementById('suggestionsContainer'),
  statsContainer: document.getElementById('statsContainer'),
  statusEl: document.getElementById('status'),
};

elements.loginBtn.addEventListener('click', login);
elements.registerBtn.addEventListener('click', register);
elements.logoutBtn.addEventListener('click', logout);
elements.upgradeBtn.addEventListener('click', openUpgradeCheckout);
elements.captureTabBtn.addEventListener('click', captureCurrentTab);
elements.syncTabsBtn.addEventListener('click', syncAllTabs);
elements.syncBookmarksBtn.addEventListener('click', syncAllBookmarks);
elements.closeSavedTabsBtn.addEventListener('click', closeSavedTabs);
elements.findSavedBookmarksBtn.addEventListener('click', findSavedBookmarks);
elements.searchBtn.addEventListener('click', performSearch);
elements.semanticSearchBtn.addEventListener('click', performSemanticSearch);
elements.getSuggestionsBtn.addEventListener('click', fetchSuggestions);
elements.searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    performSearch();
  }
});

initialize();

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise(resolve => chrome.storage.local.set(values, resolve));
}

function storageRemove(keys) {
  return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
}

function generateDeviceId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function ensureDeviceId() {
  const stored = await storageGet([DEVICE_ID_KEY]);
  if (stored[DEVICE_ID_KEY]) {
    return stored[DEVICE_ID_KEY];
  }

  const deviceId = generateDeviceId();
  await storageSet({ [DEVICE_ID_KEY]: deviceId });
  return deviceId;
}

async function initialize() {
  state.deviceId = await ensureDeviceId();
  const stored = await storageGet([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
  state.token = stored[AUTH_TOKEN_KEY] || null;
  state.email = stored[USER_EMAIL_KEY] || null;

  render();

  if (state.token) {
    await refreshPlan();
    await loadStats();
  }
}

async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    'X-Device-Id': state.deviceId,
    'X-Device-Label': 'browser-extension',
  };

  if (state.token && !options.skipAuth) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  let body = options.body;
  if (body && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || `Request failed with ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function showStatus(message, type = 'info', duration = 3500) {
  elements.statusEl.textContent = message;
  elements.statusEl.className = `status ${type}`;

  window.clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = window.setTimeout(() => {
    elements.statusEl.textContent = '';
    elements.statusEl.className = 'status';
  }, duration);
}

function isPro() {
  return state.plan?.plan?.tier === 'pro';
}

function requireSignedIn() {
  if (state.token) {
    return true;
  }

  showStatus('Sign in before using the manager.', 'error');
  elements.emailInput.focus();
  return false;
}

function requirePro(featureName) {
  if (isPro()) {
    return true;
  }

  showStatus(`${featureName} is included with Pro at $4.99/mo.`, 'error', 5000);
  return false;
}

function render() {
  const signedIn = Boolean(state.token);
  const pro = isPro();
  const planName = state.plan?.plan?.name || 'Free';

  elements.authSection.hidden = signedIn;
  elements.planSection.hidden = !signedIn;
  elements.appSections.forEach(section => {
    section.hidden = !signedIn;
  });

  elements.accountEmail.textContent = signedIn ? state.email || 'Signed in' : 'Not signed in';
  elements.planBadge.textContent = planName;
  elements.planBadge.className = `plan-badge ${pro ? 'plan-badge-pro' : 'plan-badge-free'}`;
  elements.upgradeBtn.hidden = pro;

  renderUsage();
  renderProLocks(pro);
}

function renderUsage() {
  if (!state.plan) {
    elements.bookmarkUsage.textContent = '-';
    elements.deviceUsage.textContent = '-';
    elements.bookmarkMeter.style.width = '0%';
    return;
  }

  const bookmarkLimit = state.plan.limits?.bookmarks;
  const bookmarkCount = state.plan.usage?.bookmarks || 0;
  const deviceLimit = state.plan.limits?.devices;
  const deviceCount = state.plan.usage?.devices || 0;

  elements.bookmarkUsage.textContent = bookmarkLimit === null
    ? `${bookmarkCount} / unlimited`
    : `${bookmarkCount} / ${bookmarkLimit}`;
  elements.deviceUsage.textContent = deviceLimit === null
    ? `${deviceCount} / unlimited`
    : `${deviceCount} / ${deviceLimit}`;

  const meterPercent = bookmarkLimit === null
    ? 100
    : Math.min(100, Math.round((bookmarkCount / bookmarkLimit) * 100));
  elements.bookmarkMeter.style.width = `${meterPercent}%`;
}

function renderProLocks(pro) {
  document.querySelectorAll('[data-pro-only="true"]').forEach(element => {
    element.disabled = !pro;
    element.classList.toggle('is-locked', !pro);
    element.title = pro ? '' : 'Requires Pro at $4.99/mo';
  });
}

function renderSignedOutStats() {
  elements.statsContainer.replaceChildren(createMutedText('Sign in to load stats.'));
  elements.suggestionsContainer.replaceChildren(createMutedText('Sign in to search and view suggestions.'));
}

async function refreshPlan() {
  if (!state.token) {
    state.plan = null;
    render();
    renderSignedOutStats();
    return;
  }

  try {
    state.plan = await apiFetch('/billing/plan');
    render();
  } catch (error) {
    handleApiError(error, 'Failed to load plan');
  }
}

async function register() {
  const username = elements.usernameInput.value.trim();
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;

  if (!username || !email || !password) {
    showStatus('Username, email, and password are required.', 'error');
    return;
  }

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      skipAuth: true,
      body: { username, email, password },
    });
    showStatus('Account created. Signing in...', 'success');
    await login();
  } catch (error) {
    handleApiError(error, 'Failed to create account');
  }
}

async function login() {
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;

  if (!email || !password) {
    showStatus('Email and password are required.', 'error');
    return;
  }

  try {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: { email, password },
    });

    state.token = response.token;
    state.email = email;
    await storageSet({
      [AUTH_TOKEN_KEY]: response.token,
      [USER_EMAIL_KEY]: email,
    });

    showStatus('Signed in.', 'success');
    await refreshPlan();
    await loadStats();
  } catch (error) {
    handleApiError(error, 'Failed to sign in');
  }
}

async function logout() {
  try {
    if (state.token) {
      await apiFetch('/auth/logout', { method: 'POST' }).catch(() => null);
    }
  } finally {
    state.token = null;
    state.email = null;
    state.plan = null;
    await storageRemove([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
    render();
    renderSignedOutStats();
    showStatus('Signed out.', 'info');
  }
}

async function openUpgradeCheckout() {
  if (!requireSignedIn()) {
    return;
  }

  try {
    const checkout = await apiFetch('/billing/checkout', { method: 'POST' });

    if (checkout.alreadyPro) {
      await refreshPlan();
      showStatus('Pro is already active.', 'success');
      return;
    }

    chrome.tabs.create({ url: checkout.url });
    showStatus('Opening Pro checkout.', 'info');
  } catch (error) {
    handleApiError(error, 'Checkout is not configured yet');
  }
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(response || {});
    });
  });
}

async function captureCurrentTab() {
  if (!requireSignedIn()) {
    return;
  }

  try {
    const response = await sendRuntimeMessage({ action: 'captureCurrentTab' });
    if (response.success) {
      showStatus('Current tab captured.', 'success');
      await refreshPlan();
      await loadStats();
    } else {
      handleBackgroundResponse(response, 'Failed to capture tab');
    }
  } catch (error) {
    handleApiError(error, 'Failed to capture tab');
  }
}

async function closeSavedTabs() {
  if (!requireSignedIn()) {
    return;
  }

  try {
    showStatus('Closing saved tabs...', 'info');
    const response = await sendRuntimeMessage({ action: 'closeSavedTabs' });
    if (response.success) {
      showStatus(`Closed ${response.count} tabs.`, 'success');
    } else {
      handleBackgroundResponse(response, 'Failed to close tabs');
    }
  } catch (error) {
    handleApiError(error, 'Failed to close tabs');
  }
}

async function findSavedBookmarks() {
  if (!requireSignedIn()) {
    return;
  }

  try {
    showStatus('Finding saved bookmarks...', 'info');
    const response = await sendRuntimeMessage({ action: 'findSavedBookmarks' });
    if (response.success) {
      showStatus(`Found ${response.count} saved bookmarks.`, 'success');
      displaySearchResults(response.bookmarks);
    } else {
      handleBackgroundResponse(response, 'Failed to find saved bookmarks');
    }
  } catch (error) {
    handleApiError(error, 'Failed to find saved bookmarks');
  }
}

async function syncAllTabs() {
  if (!requireSignedIn() || !requirePro('Tab sync')) {
    return;
  }

  try {
    showStatus('Syncing all tabs...', 'info');
    const response = await sendRuntimeMessage({ action: 'syncAllTabs' });
    if (response.success) {
      showStatus(`Synced ${response.count} tabs.`, 'success');
      await loadStats();
    } else {
      handleBackgroundResponse(response, 'Failed to sync tabs');
    }
  } catch (error) {
    handleApiError(error, 'Failed to sync tabs');
  }
}

async function syncAllBookmarks() {
  if (!requireSignedIn() || !requirePro('Bookmark sync')) {
    return;
  }

  try {
    showStatus('Syncing all bookmarks...', 'info');
    const response = await sendRuntimeMessage({ action: 'syncAllBookmarks' });
    if (response.success) {
      showStatus(`Synced ${response.count} bookmarks.`, 'success');
      await refreshPlan();
      await loadStats();
    } else {
      handleBackgroundResponse(response, 'Failed to sync bookmarks');
    }
  } catch (error) {
    handleApiError(error, 'Failed to sync bookmarks');
  }
}

async function performSearch() {
  if (!requireSignedIn()) {
    return;
  }

  const query = elements.searchInput.value.trim();

  if (!query) {
    showStatus('Enter a search query.', 'error');
    return;
  }

  try {
    showStatus('Searching...', 'info');
    const results = await apiFetch(`/search/text?query=${encodeURIComponent(query)}`);
    displaySearchResults(results);
    showStatus(results.length === 0 ? 'No results found.' : `Found ${results.length} results.`, results.length === 0 ? 'info' : 'success');
  } catch (error) {
    handleApiError(error, 'Search failed');
  }
}

async function performSemanticSearch() {
  if (!requireSignedIn() || !requirePro('Semantic search')) {
    return;
  }

  const query = elements.searchInput.value.trim();

  if (!query) {
    showStatus('Enter a search query.', 'error');
    return;
  }

  try {
    showStatus('Running semantic search...', 'info');
    const results = await apiFetch('/search/semantic', {
      method: 'POST',
      body: { query },
    });
    displaySearchResults(results);
    showStatus(results.length === 0 ? 'No semantic matches found.' : `Found ${results.length} semantic matches.`, results.length === 0 ? 'info' : 'success');
  } catch (error) {
    handleApiError(error, 'Semantic search failed');
  }
}

async function fetchSuggestions() {
  if (!requireSignedIn() || !requirePro('AI suggestions')) {
    return;
  }

  try {
    showStatus('Fetching suggestions...', 'info');
    const suggestions = await apiFetch('/suggestions');

    if (suggestions.length === 0) {
      elements.suggestionsContainer.replaceChildren(createMutedText('No suggestions available.'));
      showStatus('No suggestions found.', 'info');
    } else {
      displaySuggestions(suggestions);
      showStatus(`Found ${suggestions.length} suggestions.`, 'success');
    }
  } catch (error) {
    handleApiError(error, 'Failed to fetch suggestions');
  }
}

async function loadStats() {
  if (!state.token) {
    renderSignedOutStats();
    return;
  }

  try {
    const [tabs, bookmarks] = await Promise.all([
      apiFetch('/tabs'),
      apiFetch('/bookmarks'),
    ]);

    elements.statsContainer.replaceChildren(
      createStatItem(tabs.length, 'Tabs'),
      createStatItem(bookmarks.length, 'Bookmarks')
    );
  } catch (error) {
    handleApiError(error, 'Failed to load stats');
  }
}

function createStatItem(value, label) {
  const item = document.createElement('div');
  item.className = 'stat-item';

  const valueEl = document.createElement('div');
  valueEl.className = 'stat-value';
  valueEl.textContent = value;

  const labelEl = document.createElement('div');
  labelEl.className = 'stat-label';
  labelEl.textContent = label;

  item.append(valueEl, labelEl);
  return item;
}

function displaySearchResults(results) {
  const fragment = document.createDocumentFragment();
  const title = document.createElement('h3');
  title.textContent = 'Results';
  fragment.appendChild(title);

  if (!results.length) {
    fragment.appendChild(createMutedText('No saved items matched.'));
  }

  results.forEach(result => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggestion-item result-item';
    item.addEventListener('click', () => chrome.tabs.create({ url: result.url }));

    const heading = document.createElement('strong');
    heading.textContent = result.title || result.url;

    const summary = document.createElement('span');
    summary.textContent = result.summary || result.url;

    const meta = document.createElement('small');
    meta.textContent = result.type || 'saved item';

    item.append(heading, summary, meta);
    fragment.appendChild(item);
  });

  elements.suggestionsContainer.replaceChildren(fragment);
}

function displaySuggestions(suggestions) {
  const fragment = document.createDocumentFragment();

  suggestions.forEach(suggestion => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';

    const heading = document.createElement('strong');
    heading.textContent = String(suggestion.type || 'suggestion').toUpperCase();

    const reason = document.createElement('span');
    reason.textContent = suggestion.reason || 'Suggested action';

    const confidence = document.createElement('small');
    confidence.textContent = `Confidence: ${Math.round((suggestion.confidence || 0) * 100)}%`;

    item.append(heading, reason, confidence);
    fragment.appendChild(item);
  });

  elements.suggestionsContainer.replaceChildren(fragment);
}

function createMutedText(text) {
  const element = document.createElement('p');
  element.className = 'muted';
  element.textContent = text;
  return element;
}

function handleBackgroundResponse(response, fallbackMessage) {
  if (response.gated) {
    state.plan = response.plan || state.plan;
    render();
    showStatus(response.message || 'Upgrade to Pro to continue.', 'error', 5000);
    return;
  }

  if (response.authRequired) {
    showStatus('Sign in before using the manager.', 'error');
    return;
  }

  showStatus(response.error || fallbackMessage, 'error');
}

async function handleApiError(error, fallbackMessage) {
  if (error.status === 401) {
    state.token = null;
    state.email = null;
    state.plan = null;
    await storageRemove([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
    render();
    renderSignedOutStats();
    showStatus('Session expired. Sign in again.', 'error', 5000);
    return;
  }

  if (error.status === 402) {
    if (error.data?.usage || error.data?.limits) {
      state.plan = {
        ...state.plan,
        usage: error.data.usage || state.plan?.usage,
        limits: error.data.limits || state.plan?.limits,
      };
      render();
    }
    showStatus(error.data?.message || 'Upgrade to Pro to continue.', 'error', 5000);
    return;
  }

  showStatus(error.data?.message || error.message || fallbackMessage, 'error', 5000);
}
