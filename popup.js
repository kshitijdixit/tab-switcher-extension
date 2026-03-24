// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get({
    baseUrlMode: true,
    blocklist: []
  });

  document.getElementById('baseUrlMode').checked = settings.baseUrlMode;
  document.getElementById('blocklist').value = settings.blocklist.join('\n');
});

// Save base URL mode toggle
document.getElementById('baseUrlMode').addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ baseUrlMode: e.target.checked });
  showSaved();
});

// Save blocklist on change (debounced)
let saveTimeout;
document.getElementById('blocklist').addEventListener('input', (e) => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    const blocklist = e.target.value
      .split('\n')
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);
    await chrome.storage.sync.set({ blocklist });
    showSaved();
  }, 500);
});

function showSaved() {
  const indicator = document.getElementById('savedIndicator');
  indicator.classList.add('show');
  setTimeout(() => indicator.classList.remove('show'), 1500);
}
