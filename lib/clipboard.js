'use strict';

const { exec, spawn } = require('child_process');

// Get PC clipboard content via PowerShell Get-Clipboard
function getClipboard() {
    return new Promise((resolve) => {
        exec('powershell -command "Get-Clipboard"', { encoding: 'utf8', maxBuffer: 1024 * 1024 }, (err, stdout) => {
            resolve(err ? '' : String(stdout || '').trim());
        });
    });
}

// Set PC clipboard. Text goes over stdin so there are no shell/PowerShell quoting issues.
function setClipboard(text) {
    return new Promise((resolve) => {
        const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', '$input | Set-Clipboard'], {
            stdio: ['pipe', 'ignore', 'ignore'],
            windowsHide: true
        });
        ps.on('error', () => resolve(false));
        ps.on('close', (code) => resolve(code === 0));
        ps.stdin.end(String(text));
    });
}

module.exports = { getClipboard, setClipboard };
