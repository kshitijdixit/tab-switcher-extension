# Tab Switcher

A Chrome extension that automatically switches to existing tabs instead of opening duplicates.

## Features

### Tab Search (Omnibox)
- Type **`ts`** + **space** in the address bar, then start typing
- Searches all open tabs by title and URL
- Select a result to instantly switch to that tab
- No new tab opened — just switches to the existing one

### Detection
- **Domain matching** — `github.com/a` and `github.com/b` count as the same tab
- **Exact URL matching** — Optionally match only identical URLs
- **Ignore tracking params** — Treats `?ref=a` and `?ref=b` as the same page
- **Ignore URL fragments** — Treats `#section1` and `#section2` as the same page
- **Per-site rules** — Override matching mode for specific domains

### Protection
- **Pinned tab protection** — Pinned tabs are never closed or replaced
- **Tab limit per domain** — Cap how many tabs one site can have (closes oldest)
- **Notifications** — Desktop alert when a duplicate is caught (can be toggled off)
- **Bypass mode** — Press `Ctrl+Shift+O` to let the next tab open normally (10s timeout)

### Actions
- **Close all duplicates** — One-click scan with live count and undo
- **Keyboard shortcut** — `Alt+Shift+D` to scan duplicates instantly
- **Daily counter** — Badge shows how many duplicates caught today

### Site Rules
- **Domain-only list** — Sites that always match by domain
- **Exact-URL list** — Sites that only match identical URLs
- **Blocklist** — Sites where the extension is completely disabled

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the extension folder

## How It Works

1. You open a new tab with a URL
2. Extension checks if a matching tab already exists
3. If found — switches to the existing tab and closes the new one
4. If not found — new tab opens normally

## Tab Search

Type `ts` then press **space** in Chrome's address bar:

```
ts github       →  shows all open GitHub tabs
ts my project   →  matches tab titles containing "my project"
ts youtube      →  shows all open YouTube tabs
```

Select a suggestion to switch to that tab instantly.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+D` | Scan and close all duplicate tabs |
| `Ctrl+Shift+O` | Bypass — let the next tab open normally (10s timeout) |

Shortcuts can be customized at `chrome://extensions/shortcuts`.

## Settings

Click the extension icon to open the settings popup:

- **Matching Rules** — Configure how duplicates are identified
- **Behavior** — Notifications, pinned tab protection, tab limits
- **Advanced Rules** — Per-site overrides and blocklist
- **Recommended defaults** — One-click reset to optimal settings

## License

MIT
