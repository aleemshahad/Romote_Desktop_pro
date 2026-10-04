'use strict';

// Remote Desktop + PC<->Mobile Chat - entry point.
// All behaviour lives in lib/; all client UI lives in public/.

const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const config = require('./lib/config');
const store = require('./lib/store');
const toast = require('./lib/toast');
const chatwin = require('./lib/chatwin');
const uploads = require('./lib/uploads');
const socketLayer = require('./lib/socket');

// Optional native / heavy dependencies: never fatal.
let robot = null;
try { robot = require('robotjs'); } catch (err) { console.error('[WARN] robotjs not available:', err.message); }

let multer = null;
try { multer = require('multer'); } catch (err) { console.error('[WARN] multer not available:', err.message); }

let screenshot = null;
try { screenshot = require('screenshot-desktop'); } catch (err) { console.error('[WARN] screenshot-desktop not available:', err.message); }

// Ultra-fast input for robotjs
let robotOK = false;
if (robot) {
    try {
        robot.setMouseDelay(0);
        robot.setKeyboardDelay(0);
        robotOK = true;
    } catch (err) {
        console.error('[WARN] robotjs initialization failed - mouse/keyboard control disabled:', err.message);
    }
}

let screenSize = { width: 1920, height: 1080 };
if (robot) {
    try { screenSize = robot.getScreenSize(); } catch (err) {}
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

// ---------- Data folder ----------
store.ensureDirs();

// ---------- Access token (8-hex code, persists across restarts in state.json) ----------
let authToken = '';
try {
    const persisted = store.readState();
    if (persisted && typeof persisted.token === 'string' && /^[a-f0-9]{8}$/.test(persisted.token)) {
        authToken = persisted.token;
    }
} catch (err) {}
if (!authToken) {
    authToken = crypto.randomBytes(4).toString('hex');
    store.writeState(Object.assign(store.readState(), { token: authToken }));
}
const getAuthToken = () => authToken;

// ---------- Files ----------
uploads.register(app, multer, getAuthToken);

// ---------- Access-code verification for the gate page ----------
app.get('/api/verify', (req, res) => {
    if (req.query.token === authToken) return res.json({ ok: true });
    res.status(401).json({ ok: false });
});

// Full LAN url (with access code) for the chat window's "📱 Link" button.
// Token-guarded: an unauthenticated visitor must never learn the code.
function lanAddresses() {
    const out = [];
    const seen = new Set();
    const isVirtual = (name) => /virtualbox|vbox|vmware|hyper-v|vethernet|wsl|loopback/i.test(name);
    const ifs = os.networkInterfaces();
    for (const dev in ifs) {
        if (isVirtual(dev)) continue;
        for (const details of ifs[dev]) {
            if (details.family === 'IPv4' && !details.internal && !seen.has(details.address)) {
                seen.add(details.address);
                out.push(details.address);
            }
        }
    }
    return out;
}

app.get('/api/lan-url', (req, res) => {
    if (req.query.token !== authToken) return res.status(401).json({ ok: false });
    const urls = lanAddresses().map((ip) => 'http://' + ip + ':' + config.PORT + '/?token=' + authToken);
    if (!urls.length) urls.push('http://localhost:' + config.PORT + '/?token=' + authToken);
    // Everything the terminal banner used to print - surfaced inside the app
    // so a console-less EXE user still sees the access code and links.
    res.json({
        ok: true,
        token: authToken,
        port: config.PORT,
        urls: urls,
        pcUrl: 'http://localhost:' + config.PORT + '/?token=' + authToken,
        chatUrl: 'http://localhost:' + config.PORT + '/chat'
    });
});

// ---------- Static client UI ----------
// Declared before express.static so these win over the static index.html
// lookup and can attach the mandatory no-store headers.
app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(config.PUBLIC_DIR, 'index.html'));
});

app.get('/chat', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(config.PUBLIC_DIR, 'chat.html'));
});

app.get('/gate', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(config.PUBLIC_DIR, 'gate.html'));
});

app.use(express.static(config.PUBLIC_DIR, { etag: false, maxAge: 0 }));

// ---------- Socket.IO ----------
const layer = socketLayer.create({ io, robot, robotOK, screenshot, screenSize });

// Only sockets that carry the correct access code may connect.
// The code rides the handshake auth (io({ auth: { token } })) or the query string.
io.use((socket, next) => {
    const hs = socket.handshake || {};
    const candidate = (hs.auth && hs.auth.token) || (hs.query && hs.query.token);
    if (candidate === authToken) return next();
    next(new Error('unauthorized'));
});

io.on('connection', (socket) => layer.attach(socket));

function trackConnections() {
    const save = () => persistState({ connectedClients: io.engine.clientsCount });
    io.engine.on('connection', save);
    io.engine.on('connection_close', save);
}
trackConnections();

// ---------- Server state (Req 3) ----------
function persistState(extra) {
    const state = Object.assign({
        startedAt: new Date().toISOString(),
        port: config.PORT,
        screen: screenSize,
        dataDir: config.DATA_DIR,
        pid: process.pid
    }, store.readState(), extra || {});
    store.writeState(state);
}

function localIpAddress() {
    const interfaces = os.networkInterfaces();
    const isVirtual = (name) => /virtualbox|vbox|vmware|hyper-v|vethernet|wsl|loopback/i.test(name);
    for (const dev in interfaces) {
        if (isVirtual(dev)) continue;
        for (const details of interfaces[dev]) {
            if (details.family === 'IPv4' && !details.internal) return details.address;
        }
    }
    return 'localhost';
}

function shutdown() {
    toast.stop();
    chatwin.stop();
    persistState({ running: false, stoppedAt: new Date().toISOString(), connectedClients: 0 });
}

process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(0); });
process.on('SIGTERM', () => { shutdown(); process.exit(0); });

// ---------- Start ----------
// Fail loudly and usefully if a stale server still owns the port, rather than
// dumping a raw EADDRINUSE stack trace.
server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error('');
        console.error('ERROR: port ' + config.PORT + ' is already in use.');
        console.error('Another copy of the server is probably still running.');
        console.error('Check it with:  Get-NetTCPConnection -LocalPort ' + config.PORT + ' -State Listen');
        console.error('Stop that process, then run run_server.bat again.');
    } else {
        console.error('[SERVER ERROR]', err && err.message ? err.message : err);
    }
    process.exit(1);
});

server.listen(config.PORT, config.HOST, () => {
    const ip = localIpAddress();

    console.log('=================================================');
    console.log('Remote Desktop + PC<->Mobile Chat');
    console.log('-------------------------------------------------');
    console.log('Access code: ' + authToken);
    console.log('Mobile:     http://' + ip + ':' + config.PORT + '/?token=' + authToken);
    console.log('This PC:    http://localhost:' + config.PORT + '/?token=' + authToken);
    console.log('Chat window:http://localhost:' + config.PORT + '/chat');
    console.log('Screen:     ' + screenSize.width + 'x' + screenSize.height);
    console.log('Mouse/keys: ' + (robotOK ? 'ENABLED' : 'DISABLED (robotjs error)'));
    console.log('Streaming:  ' + (screenshot ? 'ENABLED' : 'DISABLED (module missing)'));
    console.log('Uploads:    ' + (multer ? 'ENABLED' : 'DISABLED (module missing)'));
    console.log('Data:       ' + config.DATA_DIR);
    console.log('Toasts:     ' + (config.DESKTOP_NOTIFICATIONS ? 'ENABLED (startup only)' : 'DISABLED'));
    console.log('=================================================');

    persistState({ running: true, startedAt: new Date().toISOString(), pid: process.pid, token: authToken });

    // Req 1: exactly one toast, fired once after listen(). No per-message popups.
    if (config.NOTIFY_TEST_ON_START && config.DESKTOP_NOTIFICATIONS) {
        setTimeout(() => {
            toast.desktopToast('Remote Desktop', 'Server started - chat window is open.');
        }, config.NOTIFY_START_DELAY_MS);
    }

    // Req 2: always-open PC chat window (carries the access code in the URL).
    // Under the Electron desktop build the chat window is created by the app
    // itself, so the external Chrome app-window trick is skipped.
    if (process.versions.electron) {
        console.log('[CHATWIN] skipped - Electron desktop build opens its own window');
    } else {
        setTimeout(() => chatwin.open(config.PORT, authToken), 1200);
    }
});
