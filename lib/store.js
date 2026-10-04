'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

function ensureDirs() {
    for (const dir of [config.DATA_DIR, config.TRANSFERS_DIR]) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(config.HISTORY_FILE)) fs.writeFileSync(config.HISTORY_FILE, '', 'utf8');
}

// Append-only. Never truncates, never prunes, never deletes.
function appendHistory(entry) {
    ensureDirs();
    try {
        fs.appendFileSync(config.HISTORY_FILE, JSON.stringify(entry) + '\n', 'utf8');
        return true;
    } catch (err) {
        console.error('[STORE] history append failed:', err.message);
        return false;
    }
}

// Read at most `limit` of the most recent entries.
// A partial first line is expected when tail-reading a large file, so it is dropped.
function readHistory(limit) {
    const max = limit || config.HISTORY_REPLAY_LIMIT;
    if (!fs.existsSync(config.HISTORY_FILE)) return [];

    let text;
    try {
        const stat = fs.statSync(config.HISTORY_FILE);
        if (stat.size === 0) return [];
        const TAIL_BYTES = 4 * 1024 * 1024;
        if (stat.size <= TAIL_BYTES) {
            text = fs.readFileSync(config.HISTORY_FILE, 'utf8');
        } else {
            const fd = fs.openSync(config.HISTORY_FILE, 'r');
            try {
                const buf = Buffer.alloc(TAIL_BYTES);
                const read = fs.readSync(fd, buf, 0, TAIL_BYTES, stat.size - TAIL_BYTES);
                text = buf.toString('utf8', 0, read);
            } finally {
                fs.closeSync(fd);
            }
            const firstBreak = text.indexOf('\n');
            text = firstBreak === -1 ? '' : text.slice(firstBreak + 1);
        }
    } catch (err) {
        console.error('[STORE] history read failed:', err.message);
        return [];
    }

    const out = [];
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0 && out.length < max; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
            out.push(JSON.parse(line));
        } catch (err) {
            // Skip a corrupt line rather than losing the whole history.
        }
    }
    return out.reverse();
}

// Atomic write: a crash mid-write can never corrupt the real file.
function writeState(obj) {
    ensureDirs();
    const tmp = config.STATE_FILE + '.tmp';
    try {
        fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
        fs.renameSync(tmp, config.STATE_FILE);
        return true;
    } catch (err) {
        console.error('[STORE] state write failed:', err.message);
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (e) {}
        return false;
    }
}

function readState() {
    if (!fs.existsSync(config.STATE_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(config.STATE_FILE, 'utf8'));
    } catch (err) {
        console.error('[STORE] state read failed:', err.message);
        return {};
    }
}

// Truncate the history file. Only the chat "clear" feature calls this; a
// failed clear must never destroy user data, so it truncates in place and
// reports success instead of throwing.
function clearHistory() {
    ensureDirs();
    try {
        fs.writeFileSync(config.HISTORY_FILE, '', 'utf8');
        return true;
    } catch (err) {
        console.error('[STORE] history clear failed:', err.message);
        return false;
    }
}

module.exports = { ensureDirs, appendHistory, readHistory, clearHistory, writeState, readState };
