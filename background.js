// URLs to bypass (opened with Alt+Click)
const bypassUrls = new Set();

// Listen for bypass messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BYPASS_URL') {
    bypassUrls.add(normalizeUrl(message.url));
    // Clear after 5 seconds to prevent memory buildup
    setTimeout(() => bypassUrls.delete(normalizeUrl(message.url)), 5000);
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

  // Check if this URL should bypass (Alt+Click)
  if (bypassUrls.has(normalizeUrl(newUrl))) {
    bypassUrls.delete(normalizeUrl(newUrl));
    console.log('Bypass: Alt+Click detected, allowing new tab');
    return;
  }

  // Get settings
  const settings = await chrome.storage.sync.get({
    baseUrlMode: true,
    blocklist: []
  });

  const newDomain = getDomain(newUrl);

  // Check if this domain is blocklisted
  if (isBlocklisted(newDomain, settings.blocklist)) {
    return;
  }

  try {
    // Find existing tabs with matching URL
    const allTabs = await chrome.tabs.query({});
    const existingTab = allTabs.find(t => {
      if (t.id === tabId) return false;

      if (settings.baseUrlMode) {
        // Match by domain only
        return getDomain(t.url) === newDomain;
      } else {
        // Match by full URL (normalized)
        return normalizeUrl(t.url) === normalizeUrl(newUrl);
      }
    });

    if (existingTab) {
      console.log(`Found matching tab. Switching to tab ${existingTab.id} and closing ${tabId}`);

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

// Check if domain is in blocklist
function isBlocklisted(domain, blocklist) {
  if (!domain || !blocklist.length) return false;
  return blocklist.some(entry => {
    // Clean up entry - extract domain if full URL was entered
    let blocked = entry.toLowerCase().trim();
    blocked = blocked.replace(/^https?:\/\//, ''); // Remove protocol
    blocked = blocked.replace(/\/.*$/, ''); // Remove path
    blocked = blocked.replace(/^www\./, ''); // Remove www

    // Match exact domain or subdomain
    return domain === blocked ||
           domain === 'www.' + blocked ||
           domain.endsWith('.' + blocked);
  });
}

console.log('Tab Switcher extension loaded (Cmd+Alt+Click to force new tab)');
