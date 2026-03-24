# Tab Switcher

A Chrome extension that switches to existing tabs instead of opening duplicates. If you try to open a URL and a tab with the same domain is already open, it switches to that tab instead.

## Features

- **Domain-based matching**: Matches tabs by base URL (domain), not exact URL
- **Automatic tab switching**: Instantly switches to the existing tab
- **Closes duplicates**: Automatically closes the new tab to keep your browser clean
- **Lightweight**: No permissions beyond tab access

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the extension folder

## How It Works

When you open a new tab with a URL:
1. The extension checks if any existing tab has the same domain
2. If found, it switches to that tab and closes the new one
3. If not found, the new tab opens normally

## Example

If you have `github.com/user/repo` open and try to open `github.com/another/repo`, the extension will switch to the existing GitHub tab instead of opening a new one.

## License

MIT
