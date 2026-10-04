'use strict';
// Shared access-code helpers for every client page.
// The code is delivered once via ?token= in the URL, cached in localStorage,
// and attached to the socket handshake + protected fetches.

function rdAuth() {
    try {
        const url = new URL(location.href);
        const fromQuery = url.searchParams.get('token');
        let saved = null;
        try { saved = localStorage.getItem('rd_token'); } catch (e) {}
        if (fromQuery) {
            try { localStorage.setItem('rd_token', fromQuery); } catch (e) {}
            url.searchParams.delete('token');
            try { history.replaceState(null, '', url.pathname + (url.hash || '')); } catch (e) {}
        }
        return fromQuery || saved || null;
    } catch (e) {
        return null;
    }
}

function rdAuthUrl(path) {
    let token = '';
    try { token = localStorage.getItem('rd_token') || ''; } catch (e) {}
    if (!token || path.indexOf('?') !== -1) return path;
    return path + '?token=' + encodeURIComponent(token);
}
