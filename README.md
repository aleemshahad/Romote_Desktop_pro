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
- **Always-open desktop chat window** — auto-launched as a frameless-style Chrome app window, never steals focus, self-heals if closed or duplicated

### Security
- **Access-code gate** — the server generates an 8-hex token on first run (persisted across restarts)
- Socket connections, file uploads and downloads all require the token
- Unauthenticated browsers are redirected to a clean `/gate` page to enter the code

### Clipboard Sync
- **Fetch PC clipboard → mobile** and **push mobile text → PC clipboard** from the UI

### Desktop App (optional)
- **Electron shell** runs the same server in-process and opens real app windows (main control + chat)
- **Custom app icon** generated procedurally (gradient tile + bolt, PNG + ICO)
- **Windows installer + portable exe** built automatically by GitHub Actions

---

## Quick Start (from source)

**Requirements:** Node.js 18+ (Windows)

```powershell
npm install
npm start
```

Or simply double-click **`run_server.bat`**.

On startup the console prints everything you need:

```
Access code: 23ed2e16
Mobile:      http://192.168.x.x:5000/?token=23ed2e16
This PC:     http://localhost:5000/?token=23ed2e16
Chat window: http://localhost:5000/chat
```

1. **Phone** — open the `Mobile` URL on the same Wi-Fi network and enter the access code (or it is auto-filled via the `?token=` link).
2. **PC** — the chat window opens automatically; the control page is at the `This PC` URL.
3. Anything sent from mobile appears on the PC instantly, and vice versa.

---

## Desktop App Build

### Via GitHub Actions (recommended, nothing to install)

1. Push the repo to GitHub (workflow: **`.github/workflows/build-desktop.yml`**)
2. **Actions** tab → *Build Romte Remote (Windows)* → **Run workflow** (or push a tag like `v2.0.1`)
3. Download the **Artifacts** when the run finishes:
   - `Romte Remote <version> windows x64.exe` — NSIS installer
   - `RomteRemote-Portable.exe` — portable, run anywhere

### Locally

```powershell
npm run build:win   # regenerates the icon, then electron-builder --win
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
├── desktop/main.js        # Electron shell (server in-process, 2 windows)
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
- **robotjs** — native mouse/keyboard control
- **screenshot-desktop** — fast screen capture loop
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
