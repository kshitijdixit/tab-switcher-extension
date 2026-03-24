// Listen for Cmd+Alt+Click to bypass tab switching
document.addEventListener('click', (e) => {
  if (e.metaKey && e.altKey) {
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

// Also handle middle-click with Cmd+Alt
document.addEventListener('auxclick', (e) => {
  if (e.metaKey && e.altKey && e.button === 1) {
    const link = e.target.closest('a');
    if (link && link.href) {
      chrome.runtime.sendMessage({
        type: 'BYPASS_URL',
        url: link.href
      });
    }
  }
}, true);
