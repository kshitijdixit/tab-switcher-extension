const TOGGLES = ['baseUrlMode', 'ignoreQueryParams', 'ignoreHash', 'pinnedTabProtection', 'showNotifications'];

const DEFAULTS = {
  baseUrlMode: true, domainMatchList: [], exactMatchList: [], blocklist: [],
  ignoreQueryParams: false, ignoreHash: true, pinnedTabProtection: true,
  showNotifications: true, maxTabsPerDomain: 0
};

const RECOMMENDED = {
  baseUrlMode: true, ignoreQueryParams: false, ignoreHash: true,
  pinnedTabProtection: true, showNotifications: true, maxTabsPerDomain: 0
};

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  const s = await chrome.storage.sync.get(DEFAULTS);

  TOGGLES.forEach(id => { document.getElementById(id).checked = s[id]; });
  setLimitUI(s.maxTabsPerDomain);

  document.getElementById('domainMatchList').value = s.domainMatchList.join('\n');
  document.getElementById('exactMatchList').value = s.exactMatchList.join('\n');
  document.getElementById('blocklist').value = s.blocklist.join('\n');
  setCnt('domainCount', s.domainMatchList);
  setCnt('exactCount', s.exactMatchList);
  setCnt('blockCount', s.blocklist);

  checkRecommended(s);

  // Stats
  const d = await chrome.storage.local.get({ duplicatesCaughtToday: 0, lastResetDate: '', lastActivityTime: 0 });
  const today = new Date().toDateString();
  document.getElementById('badgeCount').textContent =
    d.lastResetDate === today ? d.duplicatesCaughtToday : 0;

  if (d.lastActivityTime > 0) {
    document.getElementById('lastActivity').textContent = 'Last: ' + timeAgo(d.lastActivityTime);
  }

  refreshScanCount();
});

// ── Time ago ──
function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// ── Counts ──
function setCnt(id, list) {
  const n = list?.length || 0;
  document.getElementById(id).textContent = n > 0 ? n : '';
}

// ── Recommended check ──
function checkRecommended(s) {
  const isRec = Object.keys(RECOMMENDED).every(k => s[k] === RECOMMENDED[k]);
  document.getElementById('recBar').classList.toggle('hidden', isRec);
}

async function getCurrentSettings() {
  return chrome.storage.sync.get(DEFAULTS);
}

// Apply recommended
document.getElementById('recBtn').addEventListener('click', async () => {
  await chrome.storage.sync.set(RECOMMENDED);
  TOGGLES.forEach(id => { document.getElementById(id).checked = RECOMMENDED[id]; });
  setLimitUI(0);
  checkRecommended(RECOMMENDED);
  showSaved();
  refreshScanCount();
});

// ── Pre-scan (runs directly in popup, no service worker needed) ──
async function refreshScanCount() {
  const label = document.getElementById('scanLabel');
  const btn = document.getElementById('scanBtn');
  try {
    const settings = await chrome.storage.sync.get(DEFAULTS);
    const allTabs = await chrome.tabs.query({});
    const seen = new Map();
    let count = 0;

    const sorted = [...allTabs].sort((a, b) => a.id - b.id);
    for (const tab of sorted) {
      if (!tab.url || tab.url === 'about:blank' || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('data:') || tab.url.startsWith('blob:')) continue;
      if (settings.pinnedTabProtection && tab.pinned) continue;

      const domain = getDomain(tab.url);
      if (isInList(domain, settings.blocklist)) continue;

      // Must match background.js getMatchMode logic:
      // Per-site lists only override when they DIFFER from the global mode
      let mode;
      if (settings.baseUrlMode) {
        mode = isInList(domain, settings.exactMatchList) ? 'exact' : 'domain';
      } else {
        mode = isInList(domain, settings.domainMatchList) ? 'domain' : 'exact';
      }

      const key = mode === 'domain' ? domain : normalizeUrl(tab.url, settings);
      if (!key) continue;

      if (seen.has(key)) count++;
      else seen.set(key, tab);
    }

    if (count > 0) {
      label.innerHTML = 'Close <span class="n">' + count + '</span> duplicate tab' + (count > 1 ? 's' : '');
      btn.disabled = false;
    } else {
      label.textContent = 'No duplicates right now';
      btn.disabled = true;
    }
  } catch {
    label.textContent = 'Close duplicate tabs';
    btn.disabled = false;
  }
}

// ── URL helpers (shared with background, duplicated here for popup-side counting) ──
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
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    return domain === p || domain === 'www.' + p || domain.endsWith('.' + p);
  });
}

// ── Expandables ──
document.querySelectorAll('.ex-head').forEach(el => {
  el.addEventListener('click', () => {
    document.getElementById(el.dataset.target).classList.toggle('open');
  });
});

// ── Toggles with flash ──
TOGGLES.forEach(id => {
  document.getElementById(id).addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ [id]: e.target.checked });
    flashRow('row-' + id);
    showSaved();
    checkRecommended(await getCurrentSettings());
    refreshScanCount();
  });
});

function flashRow(id) {
  const row = document.getElementById(id);
  if (!row) return;
  row.classList.add('flash');
  setTimeout(() => row.classList.remove('flash'), 400);
}

// ── Limit: radio-style buttons ──
function setLimitUI(val) {
  const opts = document.querySelectorAll('.limit-opt');
  const custom = document.getElementById('limitCustom');

  opts.forEach(o => o.classList.toggle('active', parseInt(o.dataset.val) === val));

  const isPreset = [0, 3, 5].includes(val);
  custom.classList.toggle('active', !isPreset && val > 0);
  custom.value = (!isPreset && val > 0) ? val : '';
}

document.querySelectorAll('.limit-opt').forEach(btn => {
  btn.addEventListener('click', async () => {
    const val = parseInt(btn.dataset.val);
    setLimitUI(val);
    await chrome.storage.sync.set({ maxTabsPerDomain: val });
    flashRow('row-limit');
    showSaved();
    checkRecommended(await getCurrentSettings());
  });
});

let customTimeout;
document.getElementById('limitCustom').addEventListener('input', (e) => {
  clearTimeout(customTimeout);
  customTimeout = setTimeout(async () => {
    const parsed = parseInt(e.target.value);
    if (!parsed || parsed < 1) return; // empty or invalid — do nothing
    const v = Math.min(50, parsed);
    e.target.value = v;
    setLimitUI(v);
    await chrome.storage.sync.set({ maxTabsPerDomain: v });
    flashRow('row-limit');
    showSaved();
    checkRecommended(await getCurrentSettings());
  }, 400);
});

document.getElementById('limitCustom').addEventListener('focus', () => {
  // Deselect preset buttons on focus
  document.querySelectorAll('.limit-opt').forEach(o => o.classList.remove('active'));
  document.getElementById('limitCustom').classList.add('active');
});

// ── List saves ──
function parseList(t) { return t.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean); }

const st = {};
function setupList(elId, key, cntId) {
  document.getElementById(elId).addEventListener('input', (e) => {
    clearTimeout(st[key]);
    st[key] = setTimeout(async () => {
      const list = parseList(e.target.value);
      await chrome.storage.sync.set({ [key]: list });
      setCnt(cntId, list);
      showSaved();
      refreshScanCount();
    }, 500);
  });
}
setupList('domainMatchList', 'domainMatchList', 'domainCount');
setupList('exactMatchList', 'exactMatchList', 'exactCount');
setupList('blocklist', 'blocklist', 'blockCount');

// ── Scan ──
document.getElementById('scanBtn').addEventListener('click', async () => {
  const btn = document.getElementById('scanBtn');
  const label = document.getElementById('scanLabel');
  btn.disabled = true;
  label.textContent = 'Closing...';
  hideUndo();

  try {
    const r = await chrome.runtime.sendMessage({ action: 'scanDuplicates' });
    const n = r?.closed || 0;
    const d = await chrome.storage.local.get({ duplicatesCaughtToday: 0, lastResetDate: '' });
    document.getElementById('badgeCount').textContent =
      d.lastResetDate === new Date().toDateString() ? d.duplicatesCaughtToday : 0;
    document.getElementById('lastActivity').textContent = 'Last: just now';
    if (n > 0) showUndo('Closed ' + n + ' duplicate' + (n > 1 ? 's' : ''));
    refreshScanCount();
  } catch {
    label.textContent = 'Error — reload extension';
    btn.disabled = false;
  }
});

// ── Undo ──
function showUndo(msg) {
  document.getElementById('undoMsg').textContent = msg;
  document.getElementById('undoBar').classList.add('show');
}
function hideUndo() {
  document.getElementById('undoBar').classList.remove('show');
}

document.getElementById('undoBtn').addEventListener('click', async () => {
  const btn = document.getElementById('undoBtn');
  btn.textContent = '...';
  try {
    const r = await chrome.runtime.sendMessage({ action: 'undoClose' });
    if (r?.reopened > 0) {
      document.getElementById('undoMsg').textContent = 'Reopened ' + r.reopened + ' tab' + (r.reopened > 1 ? 's' : '');
      setTimeout(hideUndo, 1500);
    } else {
      hideUndo();
    }
  } catch {
    hideUndo();
  }
  btn.textContent = 'Undo';
  refreshScanCount();
});

// ── Saved ──
function showSaved() {
  const el = document.getElementById('savedIndicator');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1200);
}
