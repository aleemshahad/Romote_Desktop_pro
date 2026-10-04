'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const config = require('./config');

let winProc = null;
let winDead = false;
let heartbeat = null;

function scriptPath() {
    return path.join(os.tmpdir(), 'remote_chat_window.ps1');
}

const PS_LINES = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "Add-Type @\"",
    "using System;",
    "using System.Text;",
    "using System.Runtime.InteropServices;",
    "public class RdWin32 {",
    "  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);",
    "  [DllImport(\"user32.dll\")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);",
    "  [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder s, int n);",
    "  [DllImport(\"user32.dll\")] public static extern bool IsWindowVisible(IntPtr hWnd);",
    "  [DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);",
    "  [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);",
    "  [DllImport(\"user32.dll\")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);",
    "  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr pid);",
    "}",
    "\"@",
    "$title    = $args[0]",
    "$chrome   = $args[1]",
    "$url      = $args[2]",
    "$size     = $args[3]",
    "$relaunch = $args[4] -ne '0'",
    "",
    "$HWND_TOPMOST   = [IntPtr](-1)",
    "$SWP_NOSIZE     = 0x0001",
    "$SWP_NOMOVE     = 0x0002",
    "$SWP_NOACTIVATE = 0x0010",
    "$SWP_SHOWWINDOW = 0x0040",
    "$FLAGS = $SWP_NOSIZE -bor $SWP_NOMOVE -bor $SWP_NOACTIVATE -bor $SWP_SHOWWINDOW",
    "$SW_RESTORE = 9",
    "",
    "function Find-ChatWindow([string]$needle) {",
    "  $script:hits = New-Object System.Collections.ArrayList",
    "  $cb = [RdWin32+EnumWindowsProc]{",
    "    param($h, $l)",
    "    if ([RdWin32]::IsWindowVisible($h)) {",
    "      $sb = New-Object System.Text.StringBuilder 512",
    "      [void][RdWin32]::GetWindowTextW($h, $sb, 512)",
    "      $t = $sb.ToString()",
    "      if ($t -and $t.IndexOf($needle, [StringComparison]::OrdinalIgnoreCase) -ge 0) {",
    "        [void]$script:hits.Add($h)",
    "      }",
    "    }",
    "    return $true",
    "  }",
"  [void][RdWin32]::EnumWindows($cb, [IntPtr]::Zero)",
"  if ($script:hits.Count -gt 0) { return $script:hits[0] }",
"  return [IntPtr]::Zero",
"}",
"",
"# --- Startup cleanup ---------------------------------------------------------",
"# Kill helper scripts left behind by a previous server run (never this one),",
"# then close every stale chat window so the loop below creates exactly ONE.",
"Get-CimInstance Win32_Process -Filter \"Name = 'powershell.exe'\" | Where-Object {",
"    $_.CommandLine -like '*remote_chat_window.ps1*' -and $_.ProcessId -ne $PID",
"} | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }",
"Start-Sleep -Milliseconds 800",
"",
"function Close-ChatWindows {",
"  $cb = [RdWin32+EnumWindowsProc] {",
"    param($h, $l)",
"    if ([RdWin32]::IsWindowVisible($h)) {",
"      $sb = New-Object System.Text.StringBuilder 512",
"      [void][RdWin32]::GetWindowTextW($h, $sb, 512)",
"      $t = $sb.ToString()",
"      if ($t -and $t.IndexOf($title, [StringComparison]::OrdinalIgnoreCase) -ge 0) {",
"        [void][RdWin32]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)",
"      }",
"    }",
"    return $true",
"  }",
"  [void][RdWin32]::EnumWindows($cb, [IntPtr]::Zero)",
"}",
"Close-ChatWindows",
"Start-Sleep -Milliseconds 500",
"",
    "$lastBeat = [DateTime]::UtcNow",
    "$lastLaunch = [DateTime]::MinValue",
    "$pending = $null",
    "try { $pending = [Console]::In.ReadLineAsync() } catch { $pending = $null }",
    "",
    "while ($true) {",
    "  $h = Find-ChatWindow $title",
    "  if ($h -eq [IntPtr]::Zero) {",
    "    # Launch Chrome at most once per 10s so a slow or blocked launch can",
    "    # never stack a new window on top of the previous one.",
    "    if ($relaunch -and $chrome -and (Test-Path -LiteralPath $chrome) -and (([DateTime]::UtcNow - $lastLaunch).TotalSeconds -ge 10)) {",
    "      Start-Process -FilePath $chrome -ArgumentList @(\"--app=$url\", \"--window-size=$size\")",
    "      $lastLaunch = [DateTime]::UtcNow",
    "      Start-Sleep -Seconds 6",
    "    } else {",
    "      Start-Sleep -Seconds 2",
    "    }",
    "  } else {",
    "    # Self-heal: if duplicate chat windows somehow exist, keep only the",
    "    # first one and gently close the rest.",
    "    if ($script:hits.Count -gt 1) {",
    "      for ($i = 1; $i -lt $script:hits.Count; $i++) {",
    "        [void][RdWin32]::PostMessage($script:hits[$i], 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)",
    "      }",
    "    }",
    "    # The window is found: leave it completely alone. It is a NORMAL",
    "    # window - never restored, never pinned on top - so it cannot steal",
    "    # the foreground or block the user's work. It just stays open.",
    "  }",
    "",
    "  if ($pending -ne $null -and $pending.Wait(2000)) {",
    "    $line = $null",
    "    try { $line = $pending.Result } catch { $line = $null }",
    "    if ($null -eq $line) { break }",
    "    $lastBeat = [DateTime]::UtcNow",
    "    try { $pending = [Console]::In.ReadLineAsync() } catch { $pending = $null }",
    "  }",
    "",
    "  # Never outlive the server: bail out if heartbeats stop arriving.",
    "  if (([DateTime]::UtcNow - $lastBeat).TotalSeconds -gt 20) { break }",
    "}",
    ""
];

function resolveChrome() {
    for (const candidate of config.CHROME_FALLBACKS) {
        try {
            if (candidate && fs.existsSync(candidate)) return candidate;
        } catch (err) {}
    }
    return null;
}

function ensureScript() {
    const body = PS_LINES.join('\n');
    const p = scriptPath();
    try {
        if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== body) {
            fs.writeFileSync(p, body, 'utf8');
        }
    } catch (err) {
        console.error('[CHATWIN] could not write window script:', err.message);
    }
    return p;
}

// Req 2: open the always-on PC chat window and keep it open and on top.
// The URL carries the access code so the window's own socket connects without
// any manual token entry on the PC side.
function open(port, token) {
    if (!config.OPEN_CHAT_WINDOW) {
        console.log('[CHATWIN] disabled (REMOTE_DESKTOP_NO_CHAT_WINDOW=1)');
        return;
    }

    const chrome = resolveChrome();
    const url = 'http://localhost:' + port + '/chat' + (token ? '?token=' + encodeURIComponent(token) : '');

    if (!chrome) {
        console.error('[CHATWIN] chrome.exe not found - open ' + url + ' manually.');
        console.error('[CHATWIN] set REMOTE_DESKTOP_CHROME to your Chrome path.');
        return;
    }

    const script = ensureScript();
    try {
        winProc = spawn('powershell', [
            '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
            '-File', script,
            config.CHAT_WINDOW_TITLE, chrome, url, config.CHAT_WINDOW_SIZE, '1'
        ], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });

        winProc.on('error', () => { winDead = true; });
        winProc.stdin.on('error', () => {});
        winProc.on('exit', () => { winDead = true; });

        heartbeat = setInterval(() => {
            if (!winProc || winProc.exitCode !== null) return;
            try { winProc.stdin.write('ping\n'); } catch (err) {}
        }, 5000);
        if (heartbeat.unref) heartbeat.unref();

        console.log('[CHATWIN] ' + url + ' (stays open, normal window - never steals focus)');
    } catch (err) {
        winDead = true;
        console.error('[CHATWIN] failed:', err.message);
    }
}

function stop() {
    if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
    }
    if (winProc && winProc.exitCode === null) {
        try { winProc.stdin.end(); } catch (err) {}
        try { winProc.kill(); } catch (err) {}
    }
}

module.exports = { open, stop };
