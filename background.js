// Bypass mode - when true, next tab won't be closed
let bypassNext = false;

// Listen for keyboard shortcut (Cmd+Shift+O)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'bypass-next') {
    bypassNext = true;
    console.log('Bypass mode ON - next tab will open normally');

    // Show notification badge
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });

    // Auto-disable after 10 seconds if not used
    setTimeout(() => {
      if (bypassNext) {
        bypassNext = false;
        chrome.action.setBadgeText({ text: '' });
        console.log('Bypass mode expired');
      }
    }, 10000);
  }
});

// Track tab URLs to detect duplicates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when URL changes (not on every update)
  if (!changeInfo.url) return;

  const newUrl = changeInfo.url;

  // Skip special URLs
  if (!newUrl ||
      newUrl.startsWith('chrome://') ||
      newUrl.startsWith('chrome-extension://') ||
      newUrl === 'about:blank') {
    return;
  }

  // Check if bypass mode is on
  if (bypassNext) {
    bypassNext = false;
    chrome.action.setBadgeText({ text: '' });
    console.log('Bypass used - tab opened normally');
    return;
  }

  // Get settings
  const settings = await chrome.storage.sync.get({
    baseUrlMode: true,
    domainMatchList: [],
    exactMatchList: [],
    blocklist: []
  });

  const newDomain = getDomain(newUrl);

  // Check if this domain is blocklisted
  if (isInList(newDomain, settings.blocklist)) {
    return;
  }

  // Determine matching mode for this domain
  const matchMode = getMatchMode(newDomain, settings);

  try {
    // Find existing tabs with matching URL
    const allTabs = await chrome.tabs.query({});
    const existingTab = allTabs.find(t => {
      if (t.id === tabId) return false;

      if (matchMode === 'domain') {
        // Match by domain only
        return getDomain(t.url) === newDomain;
      } else {
        // Match by full URL (normalized)
        return normalizeUrl(t.url) === normalizeUrl(newUrl);
      }
    });

    if (existingTab) {
      console.log(`Found matching tab (${matchMode} mode). Switching to tab ${existingTab.id}`);

      // Switch to existing tab
      await chrome.tabs.update(existingTab.id, { active: true });
      await chrome.windows.update(existingTab.windowId, { focused: true });

      // Close the duplicate tab
      await chrome.tabs.remove(tabId);
    }
  } catch (e) {
    console.error('Tab switcher error:', e);
  }
});

// Determine match mode for a domain
function getMatchMode(domain, settings) {
  // Per-site rules take priority over default
  if (isInList(domain, settings.domainMatchList)) {
    return 'domain';
  }
  if (isInList(domain, settings.exactMatchList)) {
    return 'exact';
  }
  // Fall back to default
  return settings.baseUrlMode ? 'domain' : 'exact';
}

// Check if domain matches any entry in a list
function isInList(domain, list) {
  if (!domain || !list.length) return false;
  return list.some(entry => {
    // Clean up entry - extract domain if full URL was entered
    let pattern = entry.toLowerCase().trim();
    pattern = pattern.replace(/^https?:\/\//, '');
    pattern = pattern.replace(/\/.*$/, '');
    pattern = pattern.replace(/^www\./, '');

    // Match exact domain or subdomain
    return domain === pattern ||
           domain === 'www.' + pattern ||
           domain.endsWith('.' + pattern);
  });
}

// Extract domain from URL
function getDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return '';
  }
}

// Normalize full URL for exact matching
function normalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    // Remove trailing slash and hash, keep path and search params
    let normalized = parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

console.log('Tab Switcher loaded');
