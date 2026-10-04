'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const store = require('./store');

// Role is supplied in the socket.io handshake (io({ auth: { role } })), not via a
// post-connect round trip. chat.html authenticates as 'pc'; the remote-control page
// sends its own detected role. Needed so history can be tagged pc/mobile and
// replayed with the correct own/other alignment.
function roleOf(socket) {
    const hs = socket.handshake || {};
    const pick = (src) => {
        if (!src) return null;
        return Array.isArray(src) ? src[0] : src;
    };
    const fromAuth = pick(hs.auth) ? pick(hs.auth).role : null;
    const fromQuery = pick(hs.query) ? pick(hs.query).role : null;
    const role = fromAuth || fromQuery;
    return role === 'pc' ? 'pc' : 'mobile';
}

function fileBytes(name) {
    if (!name) return null;
    try {
        const p = path.join(config.TRANSFERS_DIR, path.basename(name));
        return fs.statSync(p).size;
    } catch (err) {
        return null;
    }
}

function register(io, socket) {
    const role = roleOf(socket);
    socket.data.role = role;

    // Req 3: hand the previous conversation to every new client.
    socket.emit('chat:history', { role: role, entries: store.readHistory(config.HISTORY_REPLAY_LIMIT) });

    // Req 1: no per-message toast. The text is persisted and broadcast only.
    socket.on('chat:message', (data) => {
        const text = String((data && data.text) || '').slice(0, config.MAX_TEXT_LENGTH);
        if (!text.trim()) return;

        const entry = { id: crypto.randomUUID(), ts: Date.now(), dir: role, type: 'text', text: text };
        store.appendHistory(entry);
        socket.broadcast.emit('chat:message', { id: entry.id, text: text, ts: entry.ts, dir: role });
    });

    socket.on('chat:file', (data) => {
        const name = path.basename(String((data && data.filename) || '').trim());
        if (!name) return;

        const entry = {
            id: crypto.randomUUID(),
            ts: Date.now(),
            dir: role,
            type: 'file',
            text: '',
            filename: name,
            url: '/download/' + encodeURIComponent(name),
            bytes: fileBytes(name)
        };
        store.appendHistory(entry);
        socket.broadcast.emit('chat:file', {
            id: entry.id,
            filename: name,
            url: entry.url,
            ts: entry.ts,
            dir: role,
            bytes: entry.bytes
        });
    });

    // Clear chat history on both sides: wipe the JSONL once, then tell every
    // other connected client to clear its rendered conversation.
    socket.on('chat:clear', () => {
        const ok = store.clearHistory();
        socket.broadcast.emit('chat:cleared', { ok: ok });
    });
}

module.exports = { register, roleOf };
