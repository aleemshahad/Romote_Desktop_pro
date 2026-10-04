# Romte Remote

**Remote desktop control + real-time PC ↔ Mobile chat in one lightweight app.**

Control your Windows PC from your phone — live screen streaming, mouse & keyboard, clipboard sync, file transfer, and an always-available chat between PC and mobile. Runs as a plain Node.js server, or as a packaged desktop app with its own icon.

---

## Features

### Remote Desktop
- **Live screen streaming** to any browser (phone, tablet, another PC)
- **Touch/mouse control** — move cursor, click, scroll, type on the PC from mobile
- **Zoom & pan** with pinch gestures and one-finger panning
- **Fullscreen / pause streaming** toggle

### PC ↔ Mobile Chat
- **Real-time messaging** both ways (Socket.IO, sub-second delivery)
- **History replay** — a freshly opened client instantly receives the last 200 messages
- **Clear chat history on both sides** with one button (server-side truncation)
- **File transfer** — attach files from either side, download from the other
- **Duplicate-proof delivery** — every message gets a stable UUID, clients render each id exactly once (survives restarts and reconnects)
- **Always-open desktop chat window** with a toolbar — **🖥️ Remote** (open the control panel), **📱 Link** (copy the phone URL with the access code), **⏻ Exit** — never steals focus, self-heals if closed or duplicated

### Security
- **Access-code gate** — the server generates an 8-hex token on first run (persisted across restarts)
- Socket connections, file uploads and downloads all require the token
- Unauthenticated browsers are redirected to a clean `/gate` page to enter the code

### Clipboard Sync
- **Fetch PC clipboard → mobile** and **push mobile text → PC clipboard** from the UI

### Desktop App (optional)
- **Electron shell** runs the same server in-process — **one window only** (the chat window with its toolbar); the control panel opens from its 🖥️ Remote button
- **No terminal/console ever appears** for end users
- **Custom app icon** generated procedurally (gradient tile + bolt, PNG + ICO)
- **Windows installer + portable exe** built automatically by GitHub Actions

---

## Installation

### 🟢 Regular users — Windows desktop app (recommended)

No terminal, no Node.js, nothing to type:

1. Download the `.exe` from **[GitHub Releases](https://github.com/aleemshahad/Romte_Desktop_pro/releases)** (or the latest **Actions** run artifact — *romte-remote-windows*)
2. Run it — installer version or the portable `RomteRemote-Portable.exe`
3. **One window opens: the chat window.** Its toolbar has everything:

   | Button | What it does |
   |---|---|
   | 🖥️ **Remote** | Opens the remote-control panel (screen + mouse/keyboard) |
   | 📱 **Link** | Copies the phone link (with access code) to your clipboard |
   | ⏻ **Exit** | Quits the app (and its server) cleanly |

No cmd/console window ever appears — the packaged app is a normal GUI program.

### 🔵 Advanced users — install from the terminal (npm)

The project is a proper npm package (`bin: romte-remote`), installable straight from GitHub — **no npm publish needed**:

```bash
# one-shot (no install)
npx github:aleemshahad/Romte_Desktop_pro

# or install globally, then run any time
npm install -g github:aleemshahad/Romte_Desktop_pro
romte-remote
```

The server starts in your terminal and prints the access code and URLs:

```
Access code: 23ed2e16
Mobile:      http://192.168.x.x:5000/?token=23ed2e16
This PC:     http://localhost:5000/?token=23ed2e16
```

> **Note:** `robotjs` / `screenshot-desktop` are *optional* dependencies — if a native build is missing on your machine the app still installs and runs; mouse/keyboard control or streaming is auto-disabled and reported in the banner.

Once the package is on the npm registry, `npm install -g romte-remote` will work too (publishing is a one-time `npm publish` by the maintainer).

### ⚫ From source

**Requirements:** Node.js 18+ (Windows)

```powershell
git clone https://github.com/aleemshahad/Romte_Desktop_pro.git
cd Romte_Desktop_pro
npm install
npm start
```

Or simply double-click **`run_server.bat`**.

1. **Phone** — open the `Mobile` URL on the same Wi-Fi network (or enter the access code at `/gate`).
2. **PC** — the chat window opens automatically; use its 🖥️ Remote button for the control panel.
3. Anything sent from mobile appears on the PC instantly, and vice versa.

---

## From Open Source Code to EXE (how the build works)

The repository is 100% open source; the Windows executable is produced **from this same code** by `electron-builder`:

1. **`desktop/main.js`** — a tiny Electron shell that starts `server.js` in-process and opens the single chat window (no browser, no terminal)
2. **`package.json → "build"`** — electron-builder configuration: app id, NSIS installer + portable targets, `build/icon.ico`
3. **`npm run icon`** — `scripts/make-icon.js` generates the icon procedurally (no binary assets in git)
4. **`.github/workflows/build-desktop.yml`** — GitHub Actions builds it on a clean Windows runner

### Get a fresh EXE

**Via GitHub Actions (recommended, nothing to install):**

1. **Actions** tab → *Build Romte Remote (Windows)* → **Run workflow** (or push a tag like `v2.1.1`)
2. Download the **Artifacts** when the run finishes:
   - `Romte Remote <version> windows x64.exe` — NSIS installer
   - `RomteRemote-Portable.exe` — portable, run anywhere

**Locally:**

```powershell
npm install        # dev dependencies (electron, electron-builder)
npm run build:win  # regenerates the icon, then electron-builder --win
```

Output lands in `dist/`. During development:

```powershell
npm run desktop      # run the Electron shell against your source tree
npm run icon         # regenerate build/icon.png + build/icon.ico only
```

---

## Project Structure

```
├── server.js              # entry point: HTTP + Socket.IO + access token
├── bin/cli.js             # npm global command: `romte-remote`
├── run_server.bat         # one-click launcher
├── lib/
│   ├── config.js          # ports, paths, tunables (env-overridable)
│   ├── store.js           # JSONL chat history + state.json persistence
│   ├── chat.js            # chat events: message / file / clear + history replay
│   ├── socket.js          # remote-control layer: screen, input, clipboard
│   ├── uploads.js         # token-guarded upload/download endpoints
│   ├── chatwin.js         # auto-opens & maintains the desktop chat window
│   ├── clipboard.js       # PowerShell clipboard bridge
│   └── toast.js           # single startup notification
├── public/                # browser clients
│   ├── index.html / app.js    # remote control + mobile chat tab
│   ├── chat.html / chat.js    # always-open PC chat window
│   ├── gate.html              # access-code entry page
│   └── auth.js / style.css
├── desktop/main.js        # Electron shell (server in-process, single chat window)
├── scripts/make-icon.js   # procedural app-icon generator
├── build/                 # icon.png / icon.ico (electron-builder resources)
└── .github/workflows/build-desktop.yml   # Windows CI build
```

---

## Configuration

| Environment variable | Default | Purpose |
|---|---|---|
| `REMOTE_DESKTOP_DATA_DIR` | `E:\RemoteDesktopData` | Chat history, state, transfers (desktop app uses `%APPDATA%\RomteRemote`) |
| `REMOTE_DESKTOP_PORT` | `5000` | HTTP + WebSocket port |
| `REMOTE_DESKTOP_CHROME` | system Chrome path | Browser used for the chat window |
| `REMOTE_DESKTOP_NO_CHAT_WINDOW` | *(unset)* | Set to `1` to disable auto-open of the chat window |

---

## Tech Stack

- **Node.js + Express 5** — HTTP server & static UI
- **Socket.IO 4** — low-latency bidirectional events (auth in the handshake)
- **robotjs** — native mouse/keyboard control *(optional — auto-disabled if unavailable)*
- **screenshot-desktop** — fast screen capture loop *(optional)*
- **multer** — file uploads
- **Electron + electron-builder** — optional packaged Windows app
- **GitHub Actions** — CI builds (installer + portable exe)

---

## Data & Safety Notes

- Chat history is append-only JSONL (`chat_history.jsonl`); the **Clear** button truncates it on the server so *both* sides reset together.
- The access token lives in `state.json` and stays the same across restarts — share the mobile link only with people you trust on your network.
- The server binds to `0.0.0.0` so phones on your LAN can connect; do not port-forward it to the public internet without adding HTTPS.

---

## License

ISC
