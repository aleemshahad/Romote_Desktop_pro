'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');
const store = require('./store');

function safeName(raw) {
    // basename blocks traversal in both directions: into the folder on write,
    // and out of it on read.
    let name = path.basename(String(raw || '').trim());
    // Strip characters Windows will not accept in a filename.
    name = name.replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '');
    if (!name) return null;
    if (name.length > 200) {
        const ext = path.extname(name).slice(0, 20);
        name = name.slice(0, 200 - ext.length) + ext;
    }
    return name;
}

// Never overwrite an existing file: user data must not be destroyed by a name clash.
function uniquePath(name) {
    const dir = config.TRANSFERS_DIR;
    let candidate = path.join(dir, name);
    if (!fs.existsSync(candidate)) return candidate;

    const ext = path.extname(name);
    const base = name.slice(0, name.length - ext.length);
    for (let i = 1; i < 10000; i++) {
        candidate = path.join(dir, base + ' (' + i + ')' + ext);
        if (!fs.existsSync(candidate)) return candidate;
    }
    return path.join(dir, base + '-' + Date.now() + ext);
}

function register(app, multer, getAuthToken) {
    store.ensureDirs();

    // Access-code guard: token via ?token= query param or X-Auth-Token header.
    function checkAuth(req, res, next) {
        const code = req.query.token || (req.headers && req.headers['x-auth-token']);
        if (code && getAuthToken && code === getAuthToken()) return next();
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (multer) {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => cb(null, config.TRANSFERS_DIR),
            filename: (req, file, cb) => {
                const name = safeName(file.originalname);
                if (!name) return cb(new Error('Invalid filename'));
                cb(null, path.basename(uniquePath(name)));
            }
        });
        const upload = multer({ storage });

        // Frontend loops one file per POST with FormData.append('files', file).
        app.post('/upload', checkAuth, upload.single('files'), (req, res) => {
            if (!req.file) return res.status(400).json({ success: false, message: 'No file selected' });
            console.log('[File Received] ' + req.file.originalname + ' -> ' + config.TRANSFERS_DIR);
            res.json({ success: true, filename: req.file.filename, bytes: req.file.size });
        });
    } else {
        app.post('/upload', checkAuth, (req, res) =>
            res.status(503).json({ success: false, message: 'Upload module unavailable' }));
    }

    app.get('/download/:filename', checkAuth, (req, res) => {
        const name = safeName(req.params.filename);
        const filePath = name ? path.join(config.TRANSFERS_DIR, name) : null;
        if (!name || !filePath || !fs.existsSync(filePath)) return res.status(404).send('File not found');
        res.download(filePath, name);
    });
}

module.exports = { register, safeName };
