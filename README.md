# Tab Switcher

A Chrome extension that switches to existing tabs instead of opening duplicates.

## Features

- **Domain-based matching**: Matches tabs by base URL (domain) - `github.com/a` matches `github.com/b`
- **Exact URL matching**: Optionally match only exact URLs
- **Blocklist**: Disable the extension for specific websites
- **Automatic tab switching**: Instantly switches to the existing tab
- **Lightweight**: Minimal permissions, no tracking

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the extension folder

## Settings

Click the extension icon to access settings:

- **Match by domain only**:
  - ON (default): Any tab from the same domain matches
  - OFF: Only exact URLs match

- **Disabled websites**: Add domains where the extension shouldn't activate (one per line)

## How It Works

1. You open a new tab with a URL
2. Extension checks if a matching tab exists (by domain or exact URL)
3. If found → switches to existing tab and closes the new one
4. If not found → new tab opens normally

## Examples

With domain matching ON:
- Have `github.com/user/repo` open
- Try to open `github.com/another/repo`
- → Switches to existing GitHub tab

With domain matching OFF:
- Have `github.com/user/repo` open
- Try to open `github.com/another/repo`
- → Opens new tab (URLs don't match exactly)

## License

MIT
