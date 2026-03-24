// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get({
    baseUrlMode: true,
    domainMatchList: [],
    exactMatchList: [],
    blocklist: []
  });

  document.getElementById('baseUrlMode').checked = settings.baseUrlMode;
  document.getElementById('domainMatchList').value = settings.domainMatchList.join('\n');
  document.getElementById('exactMatchList').value = settings.exactMatchList.join('\n');
  document.getElementById('blocklist').value = settings.blocklist.join('\n');
});

// Save base URL mode toggle
document.getElementById('baseUrlMode').addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ baseUrlMode: e.target.checked });
  showSaved();
});

// Helper to parse textarea to list
function parseList(text) {
  return text
    .split('\n')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
}

// Save lists on change (debounced)
let saveTimeout;
function setupListSave(elementId, storageKey) {
  document.getElementById(elementId).addEventListener('input', (e) => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const list = parseList(e.target.value);
      await chrome.storage.sync.set({ [storageKey]: list });
      showSaved();
    }, 500);
  });
}

setupListSave('domainMatchList', 'domainMatchList');
setupListSave('exactMatchList', 'exactMatchList');
setupListSave('blocklist', 'blocklist');

function showSaved() {
  const indicator = document.getElementById('savedIndicator');
  indicator.classList.add('show');
  setTimeout(() => indicator.classList.remove('show'), 1500);
}
