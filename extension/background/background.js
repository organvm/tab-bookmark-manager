const API_URL = 'http://localhost:3000/api';
const AUTH_TOKEN_KEY = 'authToken';
const DEVICE_ID_KEY = 'deviceId';

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    captureTab(tab);
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url) {
    captureTab(tab);
  }
});

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  if (bookmark.url) {
    captureBookmark(bookmark);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request)
    .then(sendResponse)
    .catch(error => {
      console.error('Extension message failed:', error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});

async function handleMessage(request) {
  if (request.action === 'captureCurrentTab') {
    const tabs = await queryTabs({ active: true, currentWindow: true });
    if (!tabs[0]) {
      return { success: false, error: 'No active tab found' };
    }
    return captureTab(tabs[0]);
  }

  if (request.action === 'syncAllTabs') {
    return syncAllTabs();
  }

  if (request.action === 'syncAllBookmarks') {
    return syncAllBookmarks();
  }

  if (request.action === 'closeSavedTabs') {
    const count = await closeSavedTabs();
    return { success: true, count };
  }

  if (request.action === 'findSavedBookmarks') {
    const bookmarks = await findSavedBookmarks();
    return { success: true, bookmarks, count: bookmarks.length };
  }

  return { success: false, error: 'Unknown action' };
}

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise(resolve => chrome.storage.local.set(values, resolve));
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

async function getAuthToken() {
  const stored = await storageGet([AUTH_TOKEN_KEY]);
  return stored[AUTH_TOKEN_KEY] || null;
}

async function apiFetch(path, options = {}) {
  const token = await getAuthToken();

  if (!token) {
    const error = new Error('Authentication required');
    error.authRequired = true;
    throw error;
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
    'X-Device-Id': await ensureDeviceId(),
    'X-Device-Label': 'browser-extension',
  };

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

function toResponseError(error) {
  if (error.authRequired || error.status === 401) {
    return {
      success: false,
      authRequired: true,
      error: 'Authentication required',
    };
  }

  if (error.status === 402) {
    return {
      success: false,
      gated: true,
      message: error.data?.message || 'Upgrade to Pro to continue.',
      plan: {
        usage: error.data?.usage,
        limits: error.data?.limits,
        upgrade: error.data?.upgrade,
      },
    };
  }

  return {
    success: false,
    error: error.message,
  };
}

function isSupportedUrl(url) {
  return /^https?:\/\//.test(url);
}

async function captureTab(tab) {
  try {
    if (!tab.url || !isSupportedUrl(tab.url)) {
      return { success: false, error: 'Unsupported tab URL' };
    }

    const content = await extractTabText(tab.id);
    const tabData = {
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl,
      content: content ? content.substring(0, 5000) : '',
    };

    await apiFetch('/tabs', {
      method: 'POST',
      body: tabData,
    });

    return { success: true };
  } catch (error) {
    if (!error.authRequired) {
      console.error('Error capturing tab:', error);
    }
    return toResponseError(error);
  }
}

async function extractTabText(tabId) {
  if (!tabId) {
    return '';
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body?.innerText || '',
    });
    return result?.result || '';
  } catch (error) {
    console.warn('Unable to extract tab text:', error.message);
    return '';
  }
}

async function captureBookmark(bookmark) {
  try {
    if (!bookmark.url || !isSupportedUrl(bookmark.url)) {
      return { success: false, error: 'Unsupported bookmark URL' };
    }

    const bookmarkUrl = new URL(bookmark.url);
    const bookmarkData = {
      url: bookmark.url,
      title: bookmark.title,
      favicon: `https://www.google.com/s2/favicons?domain=${bookmarkUrl.hostname}`,
      folder: bookmark.parentId || 'default',
      content: '',
    };

    await apiFetch('/bookmarks', {
      method: 'POST',
      body: bookmarkData,
    });

    return { success: true };
  } catch (error) {
    if (!error.authRequired) {
      console.error('Error capturing bookmark:', error);
    }
    return toResponseError(error);
  }
}

async function getPlan() {
  return apiFetch('/billing/plan');
}

function isProPlan(plan) {
  return plan?.plan?.tier === 'pro';
}

async function ensurePro(featureName) {
  const plan = await getPlan();
  if (isProPlan(plan)) {
    return { allowed: true, plan };
  }

  return {
    allowed: false,
    response: {
      success: false,
      gated: true,
      message: `${featureName} requires Pro at $4.99/mo.`,
      plan,
    },
  };
}

async function syncAllTabs() {
  try {
    const entitlement = await ensurePro('Tab sync');
    if (!entitlement.allowed) {
      return entitlement.response;
    }

    const tabs = await queryTabs({});
    let count = 0;

    for (const tab of tabs) {
      if (tab.url && isSupportedUrl(tab.url)) {
        const response = await captureTab(tab);
        if (response.success) {
          count += 1;
        }
      }
    }

    return { success: true, count };
  } catch (error) {
    console.error('Error syncing tabs:', error);
    return toResponseError(error);
  }
}

async function syncAllBookmarks() {
  try {
    const entitlement = await ensurePro('Bookmark sync');
    if (!entitlement.allowed) {
      return entitlement.response;
    }

    const bookmarkTree = await getBookmarkTree();
    const bookmarks = [];

    traverseBookmarks(bookmarkTree, node => {
      bookmarks.push(node);
    });

    let count = 0;
    for (const bookmark of bookmarks) {
      const response = await captureBookmark(bookmark);
      if (response.success) {
        count += 1;
      }
    }

    return { success: true, count };
  } catch (error) {
    console.error('Error syncing bookmarks:', error);
    return toResponseError(error);
  }
}

async function closeSavedTabs() {
  try {
    const savedTabs = await apiFetch('/tabs');
    const savedUrls = new Set(savedTabs.map(tab => tab.url));
    const openTabs = await queryTabs({});
    let closedCount = 0;

    for (const tab of openTabs) {
      if (tab.id && savedUrls.has(tab.url)) {
        await removeTab(tab.id);
        closedCount += 1;
      }
    }

    return closedCount;
  } catch (error) {
    console.error('Error closing saved tabs:', error);
    return 0;
  }
}

async function findSavedBookmarks() {
  try {
    const savedBookmarks = await apiFetch('/bookmarks');
    const savedUrls = new Set(savedBookmarks.map(bookmark => bookmark.url));
    const bookmarkTree = await getBookmarkTree();
    const browserBookmarks = [];

    traverseBookmarks(bookmarkTree, node => {
      browserBookmarks.push(node);
    });

    return browserBookmarks.filter(bookmark => savedUrls.has(bookmark.url));
  } catch (error) {
    console.error('Error finding saved bookmarks:', error);
    return [];
  }
}

function queryTabs(queryInfo) {
  return new Promise(resolve => chrome.tabs.query(queryInfo, resolve));
}

function removeTab(tabId) {
  return new Promise(resolve => chrome.tabs.remove(tabId, resolve));
}

function getBookmarkTree() {
  return new Promise(resolve => chrome.bookmarks.getTree(resolve));
}

function traverseBookmarks(nodes, onBookmark) {
  nodes.forEach(node => {
    if (node.url) {
      onBookmark(node);
    }
    if (node.children) {
      traverseBookmarks(node.children, onBookmark);
    }
  });
}

console.log('Tab & Bookmark Manager extension loaded');
