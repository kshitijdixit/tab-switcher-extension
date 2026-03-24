// Track tab URLs to detect duplicates by base URL (domain)
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

  const newBaseUrl = getBaseUrl(newUrl);
  if (!newBaseUrl) return;

  try {
    // Find existing tabs with the same base URL (excluding current tab)
    const allTabs = await chrome.tabs.query({});
    const existingTab = allTabs.find(t =>
      t.id !== tabId &&
      getBaseUrl(t.url) === newBaseUrl
    );

    if (existingTab) {
      console.log(`Found tab with same domain. Switching to tab ${existingTab.id} and closing ${tabId}`);

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

// Extract base URL (origin) from a URL
function getBaseUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.origin.toLowerCase();
  } catch {
    return '';
  }
}

console.log('Tab Switcher extension loaded (base URL matching)');
