#!/usr/bin/env node
'use strict';

// `romte-remote` - CLI entry point for npm global installs.
// Starts the server (banner with access code + URLs prints on startup) and
// keeps the process alive until Ctrl+C.

require('../server.js');
