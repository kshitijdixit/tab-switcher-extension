// ── Default settings ──
const DEFAULTS = {
  baseUrlMode: true,
  domainMatchList: [],
  exactMatchList: [],
  blocklist: [],
  ignoreQueryParams: false,
  ignoreHash: true,
  pinnedTabProtection: true,
  showNotifications: true,
  maxTabsPerDomain: 0 // 0 = unlimited
};

// ── Bypass mode (persisted via storage + alarm to survive SW restarts) ──
async function isBypassActive() {
  const { bypassUntil = 0 } = await chrome.storage.local.get({ bypassUntil: 0 });
  return Date.now() < bypassUntil;
}

async function activateBypass() {
  await chrome.storage.local.set({ bypassUntil: Date.now() + 10000 });
  chrome.action.setBadgeText({ text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  chrome.alarms.create('bypass-expire', { delayInMinutes: 10 / 60 });
}

async function clearBypass() {
  await chrome.storage.local.set({ bypassUntil: 0 });
  updateBadge();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'bypass-expire') {
    if (!(await isBypassActive())) clearBypass();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'bypass-next') {
    await activateBypass();
  }
  if (command === 'scan-duplicates') {
    await scanAndCloseDuplicates();
  }
});

// ── Badge counter ──
let duplicatesCaughtToday = 0;
let lastResetDate = '';

async function loadBadgeCount() {
  const data = await chrome.storage.local.get({ duplicatesCaughtToday: 0, lastResetDate: '' });
  const today = new Date().toDateString();
  if (data.lastResetDate !== today) {
    duplicatesCaughtToday = 0;
    lastResetDate = today;
    await chrome.storage.local.set({ duplicatesCaughtToday: 0, lastResetDate: today });
  } else {
    duplicatesCaughtToday = data.duplicatesCaughtToday;
    lastResetDate = data.lastResetDate;
  }
  updateBadge();
}

function updateBadge() {
  const text = duplicatesCaughtToday > 0 ? String(duplicatesCaughtToday) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
}

async function incrementBadge(n = 1) {
  duplicatesCaughtToday += n;
  const { totalDuplicatesCaught = 0 } = await chrome.storage.local.get({ totalDuplicatesCaught: 0 });
  await chrome.storage.local.set({
    duplicatesCaughtToday,
    totalDuplicatesCaught: totalDuplicatesCaught + n,
    lastActivityTime: Date.now()
  });
  updateBadge();
}

loadBadgeCount();

// ── Undo buffer (persisted to survive service worker restarts) ──
async function getUndoUrls() {
  const { lastClosedUrls = [] } = await chrome.storage.local.get({ lastClosedUrls: [] });
  return lastClosedUrls;
}
async function setUndoUrls(urls) {
  await chrome.storage.local.set({ lastClosedUrls: urls });
}

// ── URL helpers ──
function getDomain(url) {
  if (!url) return '';
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ''; }
}

function normalizeUrl(url, settings) {
  if (!url) return '';
  try {
    const p = new URL(url);
    let n = p.origin + p.pathname.replace(/\/$/, '');
    if (!settings.ignoreQueryParams) n += p.search;
    if (!settings.ignoreHash) n += p.hash;
    return n.toLowerCase();
  } catch { return url.toLowerCase(); }
}

function isInList(domain, list) {
  if (!domain || !list || !list.length) return false;
  return list.some(entry => {
    let p = entry.toLowerCase().trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '');
    return domain === p || domain === 'www.' + p || domain.endsWith('.' + p);
  });
}

function getMatchMode(domain, settings) {
  if (settings.baseUrlMode) {
    // Global = domain. Only exactMatchList can override to exact.
    if (isInList(domain, settings.exactMatchList)) return 'exact';
    return 'domain';
  } else {
    // Global = exact. Only domainMatchList can override to domain.
    if (isInList(domain, settings.domainMatchList)) return 'domain';
    return 'exact';
  }
}

function getTabKey(tab, settings) {
  const domain = getDomain(tab.url);
  const mode = getMatchMode(domain, settings);
  return mode === 'domain' ? domain : normalizeUrl(tab.url, settings);
}

function urlsMatch(url1, url2, settings) {
  const domain = getDomain(url1);
  const mode = getMatchMode(domain, settings);
  if (mode === 'domain') return getDomain(url1) === getDomain(url2);
  return normalizeUrl(url1, settings) === normalizeUrl(url2, settings);
}

// ── Notification ──
function notifyDuplicate(domain) {
  chrome.notifications.create({
    type: 'basic', iconUrl: 'icon-128.png',
    title: 'Tab Switcher',
    message: `Switched to existing ${domain} tab`,
    priority: 0
  });
}

// ── Core: auto-detect on navigation ──
async function handleDuplicateCheck(tabId, newUrl) {
  if (!newUrl || newUrl.startsWith('chrome://') || newUrl.startsWith('chrome-extension://') || newUrl === 'about:blank') return;

  if (await isBypassActive()) {
    await clearBypass();
    return;
  }

  const settings = await chrome.storage.sync.get(DEFAULTS);
  const newDomain = getDomain(newUrl);
  if (isInList(newDomain, settings.blocklist)) return;

  try {
    const allTabs = await chrome.tabs.query({});
    const existingTab = allTabs.find(t => {
      if (t.id === tabId) return false;
      if (settings.pinnedTabProtection && t.pinned) return false;
      return urlsMatch(t.url, newUrl, settings);
    });

    if (existingTab) {
      try {
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.windows.update(existingTab.windowId, { focused: true });
        await chrome.tabs.remove(tabId);
        await incrementBadge();
        if (settings.showNotifications) notifyDuplicate(newDomain);
      } catch { /* tab was already closed or moved */ }
    } else if (settings.maxTabsPerDomain > 0) {
      await enforceTabLimit(newDomain, settings);
    }
  } catch (e) {
    console.error('Tab switcher error:', e);
  }
}

// ── Tab limit ──
async function enforceTabLimit(domain, settings) {
  const allTabs = await chrome.tabs.query({});
  const domainTabs = allTabs.filter(t => {
    if (settings.pinnedTabProtection && t.pinned) return false;
    return getDomain(t.url) === domain;
  });

  if (domainTabs.length > settings.maxTabsPerDomain) {
    const excess = domainTabs.sort((a, b) => a.id - b.id)
      .slice(0, domainTabs.length - settings.maxTabsPerDomain);
    for (const tab of excess) {
      try { await chrome.tabs.remove(tab.id); } catch {}
    }
  }
}

// ── Scan and close duplicates ──
async function scanAndCloseDuplicates() {
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const allTabs = await chrome.tabs.query({});
  const seen = new Map();
  let closedCount = 0;
  const closedUrls = [];

  const sorted = [...allTabs].sort((a, b) => a.id - b.id);
  for (const tab of sorted) {
    const domain = getDomain(tab.url);
    if (!tab.url || tab.url === 'about:blank' || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;
    if (isInList(domain, settings.blocklist)) continue;
    if (settings.pinnedTabProtection && tab.pinned) continue;
    const key = getTabKey(tab, settings);
    if (!key) continue;

    if (seen.has(key)) {
      closedUrls.push(tab.url);
      try { await chrome.tabs.remove(tab.id); closedCount++; } catch {}
    } else {
      seen.set(key, tab);
    }
  }

  if (closedCount > 0) {
    await setUndoUrls(closedUrls);
    await incrementBadge(closedCount);
    if (settings.showNotifications) {
      chrome.notifications.create({
        type: 'basic', iconUrl: 'icon-128.png',
        title: 'Tab Switcher',
        message: `Closed ${closedCount} duplicate tab${closedCount > 1 ? 's' : ''}`,
        priority: 0
      });
    }
  }

  return { closed: closedCount, urls: closedUrls };
}

// ── Undo: reopen closed tabs ──
async function undoClose() {
  const urls = await getUndoUrls();
  let reopened = 0;
  for (const url of urls) {
    try { await chrome.tabs.create({ url, active: false }); reopened++; } catch {}
  }
  await setUndoUrls([]);
  return reopened;
}

// ── Event listeners ──
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  await handleDuplicateCheck(tabId, changeInfo.url);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scanDuplicates') {
    scanAndCloseDuplicates().then(result => sendResponse(result));
    return true;
  }
  if (message.action === 'undoClose') {
    undoClose().then(count => sendResponse({ reopened: count }));
    return true;
  }
});

// ── Omnibox: type "ts <query>" in address bar to find open tabs ──
chrome.omnibox.onInputStarted.addListener(() => {
  chrome.omnibox.setDefaultSuggestion({
    description: 'Search open tabs — type to filter'
  });
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const query = text.toLowerCase().trim();
  if (!query) {
    chrome.omnibox.setDefaultSuggestion({
      description: 'Search open tabs — type to filter'
    });
    return;
  }

  const allTabs = await chrome.tabs.query({});
  const matches = allTabs.filter(t => {
    if (!t.url || t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) return false;
    const title = (t.title || '').toLowerCase();
    const url = t.url.toLowerCase();
    return title.includes(query) || url.includes(query);
  });

  if (matches.length > 0) {
    chrome.omnibox.setDefaultSuggestion({
      description: `Switch to: ${escapeXml(matches[0].title || matches[0].url)}`
    });
  } else {
    chrome.omnibox.setDefaultSuggestion({
      description: 'No matching open tabs found'
    });
  }

  // Show up to 5 additional suggestions (omnibox skips index 0 as default)
  const suggestions = matches.slice(1, 6).map(t => ({
    content: t.url,
    description: `${escapeXml(truncate(t.title, 50))} — <url>${escapeXml(truncate(t.url, 60))}</url>`
  }));

  suggest(suggestions);
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  // Find the tab matching the entered text (could be a URL from suggestion or typed query)
  const allTabs = await chrome.tabs.query({});
  const query = text.toLowerCase().trim();

  // First try exact URL match (user selected a suggestion)
  let target = allTabs.find(t => t.url === text);

  // Otherwise fuzzy match the typed query
  if (!target) {
    target = allTabs.find(t => {
      if (!t.url) return false;
      const title = (t.title || '').toLowerCase();
      const url = t.url.toLowerCase();
      return title.includes(query) || url.includes(query);
    });
  }

  if (target) {
    await chrome.tabs.update(target.id, { active: true });
    await chrome.windows.update(target.windowId, { focused: true });
  }
});

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, len) {
  return str && str.length > len ? str.substring(0, len) + '...' : (str || '');
}

