"""Generate small, clearly labeled instructional SVG diagrams, not OS screenshots."""
from pathlib import Path
from html import escape
import textwrap

OUT = Path(__file__).resolve().parents[1] / "images"
OUT.mkdir(parents=True, exist_ok=True)


def diagram(filename, title, subtitle, steps):
    width, card_w, card_h, gap = 1040, 480, 208, 24
    rows = (len(steps) + 1) // 2
    height = 150 + rows * (card_h + gap) + 50
    pieces = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}. Numbered installation illustrations; not actual screenshots.</desc>
<rect width="100%" height="100%" fill="#edf2f7"/>
<g font-family="Arial, Helvetica, sans-serif">
<text x="28" y="34" font-size="12" font-weight="700" fill="#725019">ILLUSTRATION — NOT A DEVICE SCREENSHOT</text>
<text x="28" y="75" font-size="28" font-weight="700" fill="#182d40">{escape(title)}</text>
<text x="28" y="107" font-size="16" fill="#425b70">{escape(subtitle)}</text>''']
    for i, (heading, location, action, note) in enumerate(steps):
        x, y = 28 + (i % 2) * (card_w + gap), 138 + (i // 2) * (card_h + gap)
        pieces.append(f'''<g transform="translate({x} {y})">
<rect width="{card_w}" height="{card_h}" rx="12" fill="white" stroke="#c5d1dc"/>
<circle cx="29" cy="30" r="16" fill="#354cdd"/>
<text x="29" y="36" text-anchor="middle" font-size="16" fill="white" font-weight="700">{i+1}</text>
<text x="56" y="36" font-size="19" font-weight="700" fill="#182d40">{escape(heading)}</text>
<text x="20" y="70" font-size="14" fill="#52667a">{escape(location)}</text>
<rect x="18" y="86" width="444" height="45" rx="6" fill="#eaf0ff" stroke="#bcc8fc"/>
<text x="30" y="114" font-size="16" font-weight="700" fill="#243ba1">{escape(action)}</text>''')
        for j, line in enumerate(textwrap.wrap(note, width=58)):
            pieces.append(f'<text x="20" y="{157+j*20}" font-size="14" fill="#425b70">{escape(line)}</text>')
        pieces.append("</g>")
    pieces.append(f'<text x="28" y="{height-20}" font-size="13" fill="#52667a">Social Watch visual guide • Labels and menu positions may vary by version.</text></g></svg>')
    (OUT / filename).write_text("\n".join(pieces))
    print(filename)


diagram("install-github-pages.svg", "Publish once on GitHub Pages", "Use a desktop browser if GitHub hides repository settings on your phone.", [
    ("Copy the repository", "GitHub repository → Fork", "Create fork", "Already own the repository? Open it instead."),
    ("Check your copy", "Your GitHub account / repository", "Branch: main", "Keep the entire repository, including .github."),
    ("Enable workflows", "Repository → Actions", "Enable workflows if prompted", "Review pages.yml before enabling Actions on a fork."),
    ("Choose the Pages source", "Settings → Pages → Build and deployment", "Source: GitHub Actions", "Do not select a branch or /docs folder."),
    ("Start a deployment", "Actions → Deploy Social Watch to GitHub Pages", "Run workflow → main → Run workflow", "Choose the existing Social Watch workflow, not a new template."),
    ("Wait for success", "Actions → newest workflow run", "build: passed    →    deploy: passed", "Open the first failed step if either job is red."),
    ("Get the website address", "Settings → Pages", "Visit site", "Copy the exact HTTPS address, including its path."),
    ("Install on each device", "Open the published website online", "Continue with your device guide", "The GitHub code page is not the app. No separate iOS build."),
])
diagram("install-windows-edge.svg", "Windows • Microsoft Edge", "Open the published HTTPS website, not its GitHub code page.", [
    ("Open the site", "Microsoft Edge → address bar", "Paste the published website URL", "Load it online in a normal, non-private browser session."),
    ("Find installation", "Address-bar install icon, or Edge … menu", "Apps → Install this site as an app", "In some versions, Apps is under More tools."),
    ("Confirm", "Browser installation dialog", "Social Watch → Install", "This installs a browser web app, not an .exe."),
    ("Create a shortcut", "Optional browser prompt", "Pin to Start or taskbar", "Choose the shortcuts that suit you."),
    ("Launch", "Start menu / taskbar / edge://apps", "Open Social Watch", "Use the installed window for your vault and account setup."),
    ("Create your vault", "Social Watch → first launch", "Create encrypted vault", "Use your own unique passphrase of at least 12 characters."),
])
diagram("install-chrome.svg", "Chrome • Windows or Mac", "Chrome wording varies; the address-bar install icon is an alternative.", [
    ("Open the site", "Chrome → address bar", "Paste the published HTTPS URL", "Load online first. Do not use an incognito window."),
    ("Open installation", "Chrome ⋮ → Cast, save, and share", "Install page as app / Install Social Watch", "Use the address-bar Install icon if offered."),
    ("Confirm installation", "Browser installation dialog", "Install", "No executable or app-store account is required."),
    ("Launch and set up", "Created shortcut / application launcher", "Open Social Watch", "Create the local vault and connect accounts in this window."),
])
diagram("install-mac-safari.svg", "Mac • Safari Add to Dock", "Requires macOS Sonoma 14 or later for this Safari installation method.", [
    ("Open the site", "Safari → address bar", "Paste the published HTTPS URL", "Load the site online in Safari."),
    ("Add the web app", "Safari menu bar → File (or Share menu)", "Add to Dock", "If unavailable, use supported Chrome/Edge or a normal tab."),
    ("Confirm the name", "Add to Dock dialog", "Social Watch → Add", "No .dmg, Xcode, or developer certificate is needed."),
    ("Launch", "Dock / your user's Applications folder", "Open Social Watch", "Set up in this window; tab storage may not transfer."),
    ("Set up securely", "Social Watch → first launch", "Create vault → Settings → Accounts", "Keep your passphrase safe. There is no password recovery."),
])
diagram("install-ios-safari.svg", "iPhone / iPad • Safari", "This is a Home Screen web app, not an App Store or TestFlight download.", [
    ("Open in Safari", "Published HTTPS website", "Open in Safari", "Leave any embedded social/messaging browser first."),
    ("Open sharing", "Safari toolbar or Safari menu", "Share", "The Share control's position varies with Safari layout."),
    ("Choose installation", "Safari Share sheet → scroll down", "Add to Home Screen", "If missing, check Edit Actions and device restrictions."),
    ("Use the web-app option", "Add to Home Screen options", "Open as Web App: on, if shown", "This option is not displayed on every iOS version."),
    ("Confirm", "Home Screen name / icon preview", "Social Watch → Add", "Keep the published URL unchanged."),
    ("Launch the icon", "Your iPhone or iPad Home Screen", "Social Watch", "Create/unlock a vault in the installed web app."),
    ("Connect and refresh", "Social Watch → Settings → Accounts", "Connect with Facebook", "Use linked Instagram professional accounts. Refresh while active."),
])
