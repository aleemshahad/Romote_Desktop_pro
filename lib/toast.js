'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const config = require('./config');

let proc = null;
let dead = false;
let installedPath = null;

function scriptPath() {
    return path.join(os.tmpdir(), 'remote_chat_toast.ps1');
}

const PS_LINES = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
    "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null",
    "Add-Type -AssemblyName System.Windows.Forms",
    "$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('PowerShell')",
    "if ($notifier -eq $null) { exit 1 }",
    "$ownerPid = $args[0]",
    "",
    "# ReadLineAsync + a bounded Wait, so the loop notices both a closed pipe and a",
    "# dead parent. A plain blocking ReadLine() can hang forever after a force-kill,",
    "# which used to leave orphaned PowerShell workers behind on every restart.",
    "$pending = $null",
    "try { $pending = [Console]::In.ReadLineAsync() } catch { $pending = $null }",
    "",
    "while ($true) {",
    "  if ($pending -ne $null -and $pending.Wait(500)) {",
    "    $line = $null",
    "    try { $line = $pending.Result } catch { $line = $null }",
    "    if ($null -eq $line) { break }",
    "    try {",
    "      $o = $line | ConvertFrom-Json",
    "      $t = [System.Security.SecurityElement]::Escape([string]$o.title)",
    "      $b = [System.Security.SecurityElement]::Escape([string]$o.body)",
    "      $doc = New-Object Windows.Data.Xml.Dom.XmlDocument",
    "      $doc.LoadXml('<toast><visual><binding template=\"ToastText02\"><text id=\"1\">' + $t + '</text><text id=\"2\">' + $b + '</text></binding></visual></toast>')",
    "      $notifier.Show([Windows.UI.Notifications.ToastNotification]::new($doc))",
    "      [System.Media.SystemSounds]::Asterisk.Play()",
    "    } catch { }",
    "    try { $pending = [Console]::In.ReadLineAsync() } catch { $pending = $null }",
    "  }",
    "  if ($ownerPid -and -not (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)) { break }",
    "}"
];

// Regenerate whenever the script body changes, so an old cached copy is never reused.
function ensureScript() {
    const body = PS_LINES.join('\n');
    const p = scriptPath();
    try {
        if (fs.existsSync(p) && fs.readFileSync(p, 'utf8') === body) {
            installedPath = p;
            return p;
        }
        fs.writeFileSync(p, body, 'utf8');
        installedPath = p;
    } catch (err) {
        console.error('[NOTIFY] could not write toast script:', err.message);
    }
    return p;
}

function desktopToast(title, body) {
    if (!config.DESKTOP_NOTIFICATIONS || dead) return;
    try {
        if (!proc || proc.exitCode !== null) {
            const script = ensureScript();
            proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, String(process.pid)], {
                stdio: ['pipe', 'ignore', 'ignore'],
                windowsHide: true
            });
            proc.on('error', () => { dead = true; });
            proc.stdin.on('error', () => {});
        }
        proc.stdin.write(JSON.stringify({ title: title, body: body }) + '\n');
    } catch (err) {
        dead = true;
        console.error('[NOTIFY] disabled:', err.message);
    }
}

function stop() {
    if (proc && proc.exitCode === null) {
        try { proc.stdin.end(); } catch (err) {}
        try { proc.kill(); } catch (err) {}
    }
}

module.exports = { desktopToast, stop, scriptPath, installedPath: () => installedPath };
