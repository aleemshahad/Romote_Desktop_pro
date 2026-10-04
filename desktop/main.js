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
let appToken = '';
let quitting = false;

const BASE = () => 'http://localhost:' + config.PORT;

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

// Route every window.open()/target=_blank from the UI:
//  - /__quit            -> exit the app (chat toolbar's Exit button)
//  - same-origin '/'     -> open/focus the in-app control window
//  - same-origin '/..'   -> file downloads stay inside the app window
//  - any other http(s)   -> system browser
function wireWindow(win) {
    win.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const u = new URL(url);
            if (u.protocol === 'http:' || u.protocol === 'https:') {
                if (u.pathname === '/__quit') {
                    quitApp();
                    return { action: 'deny' };
                }
                if (u.origin === BASE()) {
                    if (u.pathname.indexOf('/download/') === 0) {
                        win.webContents.downloadURL(url);
                    } else {
                        openControlWindow();
                    }
                    return { action: 'deny' };
                }
                shell.openExternal(url);
            }
        } catch (err) {}
        return { action: 'deny' };
    });
}

function quitApp() {
    quitting = true;
    app.quit();
}

// The control panel - opened on demand from the chat window's 🖥️ button.
// Closing it never quits the app; the chat window stays as the always-open UI.
function openControlWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        return;
    }
    mainWindow = new BrowserWindow({
        width: 460,
        height: 860,
        minWidth: 380,
        minHeight: 600,
        title: 'Romte Remote',
        icon: path.join(__dirname, '..', 'build', 'icon.png'),
        backgroundColor: '#0a0c12',
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true }
    });
    mainWindow.loadURL(BASE() + '/?token=' + encodeURIComponent(appToken));
    wireWindow(mainWindow);
    mainWindow.on('closed', () => { mainWindow = null; });
}

// Single window at launch: the chat window (with its toolbar buttons).
// Under Electron no terminal and no external Chrome is involved at all.
function createChatWindow(token) {
    appToken = token;
    chatWindow = new BrowserWindow({
        width: 420,
        height: 720,
        minWidth: 340,
        minHeight: 480,
        title: 'Remote Desktop Chat',
        icon: path.join(__dirname, '..', 'build', 'icon.png'),
        backgroundColor: '#0a0c12',
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true }
    });
    chatWindow.loadURL(BASE() + '/chat?token=' + encodeURIComponent(token));
    wireWindow(chatWindow);

    chatWindow.on('close', (e) => {
        if (quitting) return;
        // The chat window is the "always open" chat: closing it just hides it
        // and it comes back after a short while.
        e.preventDefault();
        chatWindow.hide();
        setTimeout(() => { if (!chatWindow.isDestroyed()) chatWindow.showInactive(); }, 3000);
    });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
    app.quit();
} else {
    app.on('before-quit', () => { quitting = true; });

    app.on('second-instance', () => {
        const win = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : chatWindow;
        if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
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

        // ONE window only - the chat window. The control panel opens from
        // its 🖥️ Remote button.
        createChatWindow(state.token);
    });
}

app.on('window-all-closed', () => {
    // Quitting the app stops the server through the process exit handlers.
    app.quit();
});
