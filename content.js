// Listen for Alt+Click to bypass tab switching
document.addEventListener('click', (e) => {
  if (e.altKey) {
    const link = e.target.closest('a');
    if (link && link.href) {
      // Tell background script to allow this URL
      chrome.runtime.sendMessage({
        type: 'BYPASS_URL',
        url: link.href
      });
    }
  }
}, true);

// Also handle middle-click with Alt
document.addEventListener('auxclick', (e) => {
  if (e.altKey && e.button === 1) {
    const link = e.target.closest('a');
    if (link && link.href) {
      chrome.runtime.sendMessage({
        type: 'BYPASS_URL',
        url: link.href
      });
    }
  }
}, true);
