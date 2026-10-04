'use strict';

// Romte Remote - desktop app shell.
// Runs the same Node server in-process and opens the UI as real app windows
// instead of external Chrome. Built by electron-builder via GitHub Actions.

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Desktop app keeps user data in %APPDATA%\RomteRemote instead of the
// dev-time E:\ default. Must be set before lib/config is loaded (it reads
// the env var once, at require time).
if (!process.env.REMOTE_DESKTOP_DATA_DIR) {
    process.env.REMOTE_DESKTOP_DATA_DIR = path.join(app.getPath('appData'), 'RomteRemote');
}

const config = require('../lib/config');

let mainWindow = null;
let chatWindow = null;

function stateFile() {
    return path.join(config.DATA_DIR, 'state.json');
}

// Wait until the in-process server has finished listening and written the
// access token into state.json.
function waitForServer(ms) {
    const t0 = Date.now();
    return new Promise((resolve) => {
        (function poll() {
            try {
                const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
                if (s.running && s.token) return resolve(s);
            } catch (err) {}
            if (Date.now() - t0 > ms) return resolve(null);
            setTimeout(poll, 250);
        })();
    });
}

function createWindows(token) {
    const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
    const base = 'http://localhost:' + config.PORT;

    mainWindow = new BrowserWindow({
        width: 460,
        height: 860,
        minWidth: 380,
        minHeight: 600,
        title: 'Romte Remote',
        icon: iconPath,
        backgroundColor: '#0a0c12',
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true }
    });
    mainWindow.loadURL(base + '/?token=' + encodeURIComponent(token));

    chatWindow = new BrowserWindow({
        width: 420,
        height: 720,
        minWidth: 340,
        minHeight: 480,
        title: 'Remote Desktop Chat',
        icon: iconPath,
        backgroundColor: '#0a0c12',
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true }
    });
    chatWindow.loadURL(base + '/chat?token=' + encodeURIComponent(token));

    // Open external links (download links use the in-app browser, other
    // http(s) links go to the system browser).
    for (const win of [mainWindow, chatWindow]) {
        win.webContents.setWindowOpenHandler(({ url }) => {
            if (/^https?:\/\//.test(url) && url.indexOf(base) !== 0) shell.openExternal(url);
            return { action: 'deny' };
        });
    }

    chatWindow.on('close', (e) => {
        // The chat window is the "always open" chat: closing it just hides it
        // and it comes back after a short while. To stop everything, close the
        // main window (or use the tray / Alt+F4 on it).
        e.preventDefault();
        chatWindow.hide();
        setTimeout(() => { if (!chatWindow.isDestroyed()) chatWindow.showInactive(); }, 3000);
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
        app.quit();
    });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        Menu.setApplicationMenu(null);
        app.setAppUserModelId('com.romte.remote');

        // Start the server in this process (it prints its banner to stdout,
        // which is a no-op in a packaged build).
        require('../server.js');

        const state = await waitForServer(20000);
        if (!state) {
            dialog.showErrorBox(
                'Romte Remote',
                'Server did not start. Port ' + config.PORT + ' may be in use by an older copy - close it and try again.'
            );
            app.quit();
            return;
        }

        createWindows(state.token);
    });
}

app.on('window-all-closed', () => {
    // Quitting the app stops the server through the process exit handlers.
    app.quit();
});
