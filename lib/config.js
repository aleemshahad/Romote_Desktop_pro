'use strict';

const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

// User data lives OUTSIDE the code folder so it survives reinstalls/deletions.
const DATA_DIR = process.env.REMOTE_DESKTOP_DATA_DIR || 'E:\\RemoteDesktopData';

module.exports = {
    ROOT,
    PUBLIC_DIR,
    DATA_DIR,
    HISTORY_FILE: path.join(DATA_DIR, 'chat_history.jsonl'),
    STATE_FILE: path.join(DATA_DIR, 'state.json'),
    TRANSFERS_DIR: path.join(DATA_DIR, 'transfers'),

    PORT: Number(process.env.REMOTE_DESKTOP_PORT || 5000),
    HOST: '0.0.0.0',

    // How many history entries a newly connected client receives.
    HISTORY_REPLAY_LIMIT: 200,

    // Req 1: one single toast at startup, nothing per message.
    DESKTOP_NOTIFICATIONS: true,
    NOTIFY_TEST_ON_START: true,
    NOTIFY_START_DELAY_MS: 3000,

    // Req 2: the always-open PC chat window.
    CHROME_PATH: process.env.REMOTE_DESKTOP_CHROME ||
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    CHROME_FALLBACKS: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    ],
    CHAT_WINDOW_TITLE: 'Remote Desktop Chat',
    CHAT_WINDOW_SIZE: '420,720',
    OPEN_CHAT_WINDOW: process.env.REMOTE_DESKTOP_NO_CHAT_WINDOW !== '1',

    MAX_TEXT_LENGTH: 4000
};
