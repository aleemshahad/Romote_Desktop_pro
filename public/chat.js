'use strict';
// Standalone always-open PC chat window (Req 2).
// Text and files both ways, history replayed from the server on connect.

const MY_ROLE = 'pc';
const AUTH_TOKEN = rdAuth();
// The PC window URL already carries ?token= (injected by the server), which
// rdAuth() picks up and caches in localStorage.
const socket = io({ auth: { role: MY_ROLE, token: AUTH_TOKEN } });

const messagesEl = document.getElementById('chatMessages');
const inputEl = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const fileEl = document.getElementById('chatFileElem');
const statusEl = document.getElementById('chatStatus');

// Dedupe guard: a message id is rendered at most once, so history replay and
// live broadcasts can never show the same message twice (e.g. after a
// server restart).
const rendered = new Set();

function setStatus(msg, color) {
    statusEl.textContent = msg;
    statusEl.style.color = color || '#888';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function escapeAttr(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatTime(ts) {
    const when = ts ? new Date(ts) : new Date();
    return when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes)) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function appendMessage(entry) {
    if (entry.id) {
        if (rendered.has(entry.id)) return;
        rendered.add(entry.id);
    }
    const isOwn = entry.dir === MY_ROLE;
    const div = document.createElement('div');
    div.className = 'chat-message ' + (isOwn ? 'own' : 'other');

    const time = formatTime(entry.ts);
    const sender = isOwn ? 'You' : (entry.dir === 'pc' ? 'PC' : 'Mobile');
    let body;

    if (entry.type === 'file') {
        const size = formatBytes(entry.bytes);
        div.dataset.copyText = 'File: ' + entry.filename + '\n' + location.origin + rdAuthUrl(entry.url);
        body = '<a href="' + escapeAttr(rdAuthUrl(entry.url)) + '" class="file-message" download="'
            + escapeAttr(entry.filename) + '" target="_blank">'
            + '<span class="file-icon">📄</span>'
            + '<span>' + escapeHtml(entry.filename) + '</span>'
            + (size ? '<span class="file-size">' + escapeHtml(size) + '</span>' : '')
            + '</a>'
            + '<div class="message-meta">'
            + '<span>' + sender + '</span>'
            + '<span>' + time + '</span>'
            + '<button class="copy-btn">📋 Copy Link</button>'
            + '</div>';
    } else {
        div.dataset.copyText = entry.text;
        body = escapeHtml(entry.text)
            + '<div class="message-meta">'
            + '<span>' + sender + '</span>'
            + '<span>' + time + '</span>'
            + '<button class="copy-btn">📋 Copy</button>'
            + '</div>';
    }

    div.innerHTML = '<div class="message-bubble">' + body + '</div>';
    div.querySelector('.copy-btn').addEventListener('click', function () { copyToClipboard(this); });

    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearMessages() {
    messagesEl.innerHTML = '';
    rendered.clear();
}

function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
}

function copyToClipboard(btn) {
    const msg = btn.closest('.chat-message');
    const text = msg && msg.dataset.copyText ? msg.dataset.copyText : '';
    const original = btn.textContent;
    const ok = function () {
        btn.textContent = '✅ Copied!';
        btn.style.color = '#4ade80';
        setTimeout(function () {
            btn.textContent = original;
            btn.style.color = '';
        }, 1500);
    };
    const fail = function () {
        btn.textContent = '❌ Failed';
        setTimeout(function () { btn.textContent = original; }, 1500);
    };
    // navigator.clipboard only exists in secure contexts (HTTPS/localhost);
    // plain-HTTP mobile sessions must fall back to execCommand('copy').
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok).catch(function () {
            legacyCopy(text) ? ok() : fail();
        });
    } else {
        legacyCopy(text) ? ok() : fail();
    }
}

function sendChatMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    // Render immediately as own; the server echoes to everyone else.
    appendMessage({ dir: MY_ROLE, type: 'text', text: text, ts: Date.now() });
    socket.emit('chat:message', { text: text });
    inputEl.value = '';
    inputEl.focus();
}

async function sendChatFiles(files) {
    if (!files || files.length === 0) return;
    const list = Array.prototype.slice.call(files);

    for (let i = 0; i < list.length; i++) {
        const file = list[i];
        setStatus('Uploading ' + (i + 1) + '/' + list.length + ': ' + file.name, '#facc15');
        const formData = new FormData();
        formData.append('files', file);
        try {
            const res = await fetch(rdAuthUrl('/upload'), { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                appendMessage({
                    dir: MY_ROLE,
                    type: 'file',
                    filename: data.filename,
                    url: '/download/' + encodeURIComponent(data.filename),
                    bytes: data.bytes,
                    ts: Date.now()
                });
                socket.emit('chat:file', { filename: data.filename });
            } else {
                setStatus('❌ ' + file.name + ': ' + (data.message || 'failed'), '#f87171');
            }
        } catch (err) {
            setStatus('❌ ' + file.name + ': ' + err.message, '#f87171');
        }
    }

    setStatus('✅ Sent ' + list.length + ' file' + (list.length > 1 ? 's' : ''), '#4ade80');
    setTimeout(function () { setStatus(''); }, 4000);
}

sendBtn.addEventListener('click', sendChatMessage);
inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});
// Null-guarded: a missing element must never abort the script and silently
// drop every socket handler registered below (that bug left the window blank).
if (fileEl) {
    fileEl.addEventListener('change', function () {
        sendChatFiles(this.files);
        this.value = '';
    });
}

// Clear chat history on both sides: confirm, wipe locally, ask the server to
// truncate the JSONL and tell every other client.
const clearBtn = document.getElementById('clearBtn');
if (clearBtn) clearBtn.addEventListener('click', function () {
    if (!confirm('Clear chat history on BOTH the PC and the mobile side?')) return;
    clearMessages();
    socket.emit('chat:clear');
    setStatus('History cleared on both sides', '#4ade80');
    setTimeout(function () { setStatus(''); }, 3000);
});

socket.on('chat:cleared', function () {
    clearMessages();
});

socket.on('connect', function () {
    setStatus('Connected', '#4ade80');
    inputEl.focus();
});

socket.on('connect_error', function (err) {
    if (err && /unauthorized/i.test(err.message)) {
        setStatus('Access code missing or wrong', '#f87171');
        location.replace('/gate');
        return;
    }
    setStatus('Disconnected - retrying...', '#f87171');
});

socket.on('disconnect', function () {
    setStatus('Disconnected - retrying...', '#f87171');
});

socket.on('chat:message', function (data) {
    appendMessage({ id: data.id, dir: data.dir, type: 'text', text: data.text, ts: data.ts });
});

socket.on('chat:file', function (data) {
    appendMessage({
        id: data.id, dir: data.dir, type: 'file', filename: data.filename, url: data.url, ts: data.ts, bytes: data.bytes
    });
});

socket.on('chat:history', function (data) {
    clearMessages();
    const entries = (data && data.entries) || [];
    entries.forEach(appendMessage);
    if (!entries.length) setStatus('No messages yet', '#888');
    messagesEl.scrollTop = messagesEl.scrollHeight;
});

// ---------- Toolbar ----------
// Remote: open the control panel (in-app window under Electron, new tab in a
// plain browser). Link: copy the LAN url (with access code) for the phone.
// Exit: only shown in the Electron build; a browser tab can just be closed.
const ctrlBtn = document.getElementById('btnControl');
if (ctrlBtn) ctrlBtn.addEventListener('click', function () {
    window.open(rdAuthUrl('/'), '_blank');
});

const linkBtn = document.getElementById('btnLink');
if (linkBtn) linkBtn.addEventListener('click', function () {
    fetch(rdAuthUrl('/api/lan-url'))
        .then(function (res) { return res.json(); })
        .then(function (data) {
            const urls = (data && data.urls) || [];
            if (!urls.length) throw new Error('no url');
            if (legacyCopy(urls[0])) {
                setStatus('📱 Phone link copied - open it in your phone browser' + (urls.length > 1 ? ' (more networks: ' + urls.slice(1).join(', ') + ')' : ''), '#4ade80');
            } else {
                window.prompt('Open this link on your phone:', urls.join('\n'));
            }
        })
        .catch(function () {
            window.prompt('Open this link on your phone:', location.origin + rdAuthUrl('/'));
        });
    setTimeout(function () { setStatus(''); }, 6000);
});

const quitBtn = document.getElementById('btnQuit');
if (quitBtn && /Electron/i.test(navigator.userAgent)) {
    quitBtn.hidden = false;
    quitBtn.addEventListener('click', function () {
        window.open('/__quit', '_blank');
    });
}

inputEl.focus();
