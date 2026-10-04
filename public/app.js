        const AUTH_TOKEN = rdAuth();
        const isDesktopDevice = window.matchMedia('(pointer: fine)').matches;
        const myRole = isDesktopDevice ? 'pc' : 'mobile';
        // Role + access code ride along in the socket.io handshake so the server can
        // tag history with a direction and reject unknown clients. No round trip.
        const socket = io({ auth: { role: myRole, token: AUTH_TOKEN } });
        const container = document.getElementById('screen-container');
        const canvas = document.getElementById('screen-canvas');
        const ctx = canvas.getContext('2d');
        const streamToggleBtn = document.getElementById('streamToggleBtn');
        const pausedOverlay = document.getElementById('pausedOverlay');

        let pcWidth = 1920, pcHeight = 1080;
        let currentFrameBitmap = null;

        function initCanvas() {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            drawFrame();
        }
        window.addEventListener('resize', initCanvas);

        // ================= 2D CAMERA MATRIX =================
        let zoom = 1.0;
        let panX = 0, panY = 0;
        let startTouchX = 0, startTouchY = 0;
        let startPanX = 0, startPanY = 0;
        let initialPinchDist = 0;
        let initialZoom = 1.0;
        let lastPinchMidY = 0;
        let scrollAccumY = 0;
        let pinchMidX = 0;
        let pinchMidY = 0;

        // Shared "fit-to-canvas" letterbox math used by drawing AND by
        // inverse coordinate mapping, so both always agree.
        function screenLayout() {
            const screenAspect = pcWidth / pcHeight || 1;
            const canvasAspect = (canvas.width || 1) / (canvas.height || 1);
            let baseW, baseH, offsetX, offsetY;
            if (canvasAspect > screenAspect) {
                baseH = canvas.height;
                baseW = canvas.height * screenAspect;
                offsetX = (canvas.width - baseW) / 2;
                offsetY = 0;
            } else {
                baseW = canvas.width;
                baseH = canvas.width / screenAspect;
                offsetX = 0;
                offsetY = (canvas.height - baseH) / 2;
            }
            return { baseW, baseH, offsetX, offsetY };
        }

        // Keep the panned view from dragging the image entirely off-screen.
        // At 1x the whole screen fits, so panning is disabled.
        function clampPan() {
            if (zoom <= 1.0) { panX = 0; panY = 0; return; }
            const { baseW, baseH, offsetX, offsetY } = screenLayout();
            const Cx = canvas.width / 2;
            const Cy = canvas.height / 2;
            panX = Math.min(panX, Cx - zoom * (offsetX - Cx));
            panX = Math.max(panX, -zoom * (offsetX + baseW - Cx) - Cx);
            panY = Math.min(panY, Cy - zoom * (offsetY - Cy));
            panY = Math.max(panY, -zoom * (offsetY + baseH - Cy) - Cy);
        }

        function drawFrame() {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (!currentFrameBitmap) return;

            const { baseW, baseH, offsetX, offsetY } = screenLayout();
            clampPan();

            ctx.save();
            ctx.translate(panX, panY);
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);

            ctx.drawImage(currentFrameBitmap, offsetX, offsetY, baseW, baseH);
            ctx.restore();
        }

        function adjustZoom(delta) {
            zoom = Math.min(Math.max(1.0, zoom + delta), 5.0);
            if (zoom === 1.0) { panX = 0; panY = 0; }
            drawFrame();
        }

        function resetZoom() {
            zoom = 1.0;
            panX = 0;
            panY = 0;
            drawFrame();
        }

        // 3 MODES: 'trackpad', 'touch', 'pan'
        let currentMode = 'trackpad';
        function setMode(mode) {
            currentMode = mode;
            document.getElementById('btnTrackpad').classList.toggle('active-mode', mode === 'trackpad');
            document.getElementById('btnTouch').classList.toggle('active-mode', mode === 'touch');
            document.getElementById('btnPan').classList.toggle('active-mode', mode === 'pan');
        }

        // ================= STREAM ON / OFF TOGGLE (FIXED 100%) =================
        let isStreamActive = true;
        function toggleStream() {
            isStreamActive = !isStreamActive;
            socket.emit('toggle_stream', { active: isStreamActive });

            if (isStreamActive) {
                streamToggleBtn.innerText = '📺 Stream: ON';
                streamToggleBtn.classList.remove('stream-off');
                streamToggleBtn.classList.add('stream-on');
                pausedOverlay.style.display = 'none';
            } else {
                streamToggleBtn.innerText = '📺 Stream: OFF';
                streamToggleBtn.classList.remove('stream-on');
                streamToggleBtn.classList.add('stream-off');
                pausedOverlay.style.display = 'flex';
            }
        }

        // Receive Screen Dimensions
        socket.on('screen_dim', (dim) => {
            pcWidth = dim.width;
            pcHeight = dim.height;
            initCanvas();
        });

        // Receive Screen Frame Buffer
        socket.on('screen_frame', (buffer) => {
            if (!isStreamActive) return;
            const blob = new Blob([buffer], { type: 'image/jpeg' });
            createImageBitmap(blob).then((bmp) => {
                currentFrameBitmap = bmp;
                drawFrame();
            });
        });

        function switchTab(tabId, btn) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            btn.classList.add('active');
            if (tabId === 'screen-tab') setTimeout(initCanvas, 50);
        }

        function clientToPcCoords(clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            // Map CSS pixels to canvas-buffer pixels (canvas.width holds the
            // buffer size, the rect holds CSS size - they differ under zoomed
            // browser windows / device pixel ratios).
            const scaleX = canvas.width / (rect.width || 1);
            const scaleY = canvas.height / (rect.height || 1);
            const localX = (clientX - rect.left) * scaleX;
            const localY = (clientY - rect.top) * scaleY;

            const { baseW, baseH, offsetX, offsetY } = screenLayout();

            const centeredX = localX - canvas.width / 2;
            const centeredY = localY - canvas.height / 2;
            // Inverse of drawFrame's pipeline: screen = C + z*(q-C) + pan
            // => q = C + (screen - C - pan) / z
            const unzoomedX = canvas.width / 2 + (centeredX - panX) / zoom;
            const unzoomedY = canvas.height / 2 + (centeredY - panY) / zoom;

            const imgX = unzoomedX - offsetX;
            const imgY = unzoomedY - offsetY;

            const finalX = Math.round(Math.max(0, Math.min(pcWidth, (imgX / baseW) * pcWidth)));
            const finalY = Math.round(Math.max(0, Math.min(pcHeight, (imgY / baseH) * pcHeight)));

            return { x: finalX, y: finalY };
        }

        // ================= TOUCH & CLICKS (WITH TOOLBAR CLICK PROTECTION) =================
        let touchStartTime = 0;
        let isDragging = false;
        let touchCount = 0;
        let longPressTimer = null;
        let didLongPress = false;

        container.addEventListener('touchstart', (e) => {
            // Guard: Allow toolbar button clicks to execute freely
            if (e.target.closest('.screen-toolbar')) return;

            e.preventDefault();
            e.stopPropagation();

            touchCount = e.touches.length;
            touchStartTime = Date.now();
            isDragging = false;
            didLongPress = false;

            if (touchCount === 1) {
                startTouchX = e.touches[0].clientX;
                startTouchY = e.touches[0].clientY;
                startPanX = panX;
                startPanY = panY;

                // Long-Press for Right Click (450ms)
                clearTimeout(longPressTimer);
                longPressTimer = setTimeout(() => {
                    if (!isDragging) {
                        didLongPress = true;
                        const pc = clientToPcCoords(startTouchX, startTouchY);
                        socket.emit('abs_mouse', { x: pc.x, y: pc.y, click: 'right' });
                    }
                }, 450);
            } else if (touchCount === 2) {
                clearTimeout(longPressTimer);
                initialPinchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialZoom = zoom;
                startPanX = panX;
                startPanY = panY;
                pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                lastPinchMidY = pinchMidY;
                scrollAccumY = 0;
                // 2-finger tap = right click at the midpoint between the fingers
                startTouchX = pinchMidX;
                startTouchY = pinchMidY;
            }
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            if (e.target.closest('.screen-toolbar')) return;

            e.preventDefault();
            e.stopPropagation();

            if (e.touches.length === 1) {
                const curX = e.touches[0].clientX;
                const curY = e.touches[0].clientY;
                const totalMove = Math.hypot(curX - startTouchX, curY - startTouchY);

                if (totalMove > 8) {
                    isDragging = true;
                    clearTimeout(longPressTimer);
                }

                if (currentMode === 'trackpad' || currentMode === 'touch') {
                    // Absolute positioning - cursor always follows the finger precisely
                    const pc = clientToPcCoords(curX, curY);
                    socket.emit('abs_mouse', { x: pc.x, y: pc.y, click: null });
                } else if (currentMode === 'pan') {
                    const dx = curX - startTouchX;
                    const dy = curY - startTouchY;
                    // pan is stored in screen pixels, so the finger delta maps
                    // 1:1 onto pan regardless of zoom level
                    panX = startPanX + dx;
                    panY = startPanY + dy;
                    drawFrame();
                }
            } else if (e.touches.length === 2) {
                clearTimeout(longPressTimer);
                const currentDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                if (Math.abs(currentDist - initialPinchDist) > 15) {
                    if (initialPinchDist > 0) {
                        const newZoom = Math.min(Math.max(initialZoom * (currentDist / initialPinchDist), 1.0), 5.0);
                        zoom = newZoom;
                        if (zoom === 1.0) {
                            panX = 0;
                            panY = 0;
                        } else {
                            // Pinch-zoom toward the two-finger midpoint exactly like Chrome
                            // Remote Desktop: the image point under the starting midpoint
                            // stays pinned: p2 = M2 - C - z2*(M1 - C - p1) / z1
                            panX = midX - canvas.width / 2 - (zoom * (pinchMidX - canvas.width / 2 - startPanX)) / initialZoom;
                            panY = midY - canvas.height / 2 - (zoom * (pinchMidY - canvas.height / 2 - startPanY)) / initialZoom;
                        }
                    }
                    drawFrame();
                } else {
                    if (lastPinchMidY > 0) {
                        scrollAccumY += midY - lastPinchMidY;
                        if (scrollAccumY >= 10 || scrollAccumY <= -10) {
                            socket.emit('scroll', { dy: Math.round(scrollAccumY) });
                            scrollAccumY = 0;
                        }
                    }
                    lastPinchMidY = midY;
                }
            }
        }, { passive: false });

        container.addEventListener('touchend', (e) => {
            if (e.target.closest('.screen-toolbar')) return;

            e.preventDefault();
            e.stopPropagation();
            clearTimeout(longPressTimer);

            if (e.touches.length === 0 && !didLongPress) {
                const duration = Date.now() - touchStartTime;

                // 1-Finger Tap = Left Click
                if (!isDragging && duration < 350 && touchCount === 1) {
                    const pc = clientToPcCoords(startTouchX, startTouchY);
                    socket.emit('abs_mouse', { x: pc.x, y: pc.y, click: 'left' });
                }
                // 2-Finger Tap = Right Click
                else if (!isDragging && duration < 350 && touchCount === 2) {
                    const pc = clientToPcCoords(startTouchX, startTouchY);
                    socket.emit('abs_mouse', { x: pc.x, y: pc.y, click: 'right' });
                }
            }
        }, { passive: false });

        // ================= TAB 1: SEND TEXT BUTTON =================
        function sendMainText() {
            const input = document.getElementById('mainTextInput');
            if (input.value) {
                socket.emit('type', { text: input.value });
                input.value = '';
            }
        }

        // ================= TAB 2: LIVE GBOARD VOICE TYPING =================
        const voiceInput = document.getElementById('voiceTextInput');
        let prevVoiceVal = "";

        voiceInput.addEventListener('input', () => {
            const currentVal = voiceInput.value;
            if (currentVal.length > prevVoiceVal.length) {
                const addedText = currentVal.substring(prevVoiceVal.length);
                socket.emit('type', { text: addedText });
            } else if (currentVal.length < prevVoiceVal.length) {
                const diff = prevVoiceVal.length - currentVal.length;
                for (let i = 0; i < diff; i++) {
                    socket.emit('action', { type: 'key', val: 'backspace' });
                }
            }
            prevVoiceVal = currentVal;
            if (prevVoiceVal.length > 80) {
                voiceInput.value = "";
                prevVoiceVal = "";
            }
        });

        // ================= TAB 2: DIRECT BROWSER VOICE RECOGNITION =================
        let recognition = null;
        let isRecording = false;

        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRec();
            recognition.continuous = true;
            recognition.interimResults = false;

            recognition.onresult = (event) => {
                const last = event.results.length - 1;
                const text = event.results[last][0].transcript;
                socket.emit('type', { text: text + ' ' });
            };

            recognition.onerror = () => { stopVoice(); };
            recognition.onend = () => { if (isRecording) recognition.start(); };
        }

        function toggleBrowserVoice() {
            if (!recognition) {
                alert('Please use the Gboard microphone icon on your mobile keyboard!');
                return;
            }

            if (!isRecording) {
                isRecording = true;
                recognition.start();
                document.getElementById('browserVoiceBtn').classList.add('voice-active');
                document.getElementById('browserVoiceBtn').innerText = '🔴 Listening...';
            } else {
                stopVoice();
            }
        }

        function stopVoice() {
            isRecording = false;
            if (recognition) recognition.stop();
            const btn = document.getElementById('browserVoiceBtn');
            if (btn) {
                btn.classList.remove('voice-active');
                btn.innerText = '🎙️ Voice';
            }
        }

        function sendAction(type, val) { socket.emit('action', { type, val }); }
        function sendKey(val) { socket.emit('action', { type: 'key', val }); }
        function sendCombo(key, modifiers) { socket.emit('action', { type: 'combo', key, modifiers }); }
        function sendType(text) { socket.emit('type', { text }); }

        // Clipboard functions
        function getClipboard() {
            const status = document.getElementById('clipboardStatus');
            status.innerText = 'Fetching PC clipboard...';
            status.style.color = '#facc15';
            socket.emit('clipboard:get');
            socket.once('clipboard:content', (data) => {
                const input = document.getElementById('mainTextInput');
                input.value = data.text || '(clipboard empty)';
                status.innerText = data.text ? '✅ Clipboard fetched!' : '⚠️ Clipboard empty';
                status.style.color = data.text ? '#4ade80' : '#f87171';
            });
        }

        function setClipboard() {
            const input = document.getElementById('mainTextInput');
            const text = input.value;
            if (!text) {
                const status = document.getElementById('clipboardStatus');
                status.innerText = '⚠️ Text box is empty';
                status.style.color = '#f87171';
                return;
            }
            const status = document.getElementById('clipboardStatus');
            status.innerText = 'Copying to PC clipboard...';
            status.style.color = '#facc15';
            socket.emit('clipboard:set', { text });
            socket.once('clipboard:set:result', (data) => {
                status.innerText = data.success ? '✅ Copied to PC clipboard!' : '❌ Failed to copy';
                status.style.color = data.success ? '#4ade80' : '#f87171';
            });
        }

        // ================= CHAT FUNCTIONS =================
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        // Ids of messages already rendered, so a reconnect + history replay can
        // never paint the same message twice.
        const renderedIds = new Set();

        function clearChatMessages() {
            chatMessages.innerHTML = '';
            renderedIds.clear();
        }

        function appendMessage(text, isOwn, isFile, fileName, fileData, ts, id) {
            if (id) {
                if (renderedIds.has(id)) return;
                renderedIds.add(id);
            }
            const div = document.createElement('div');
            div.className = 'chat-message ' + (isOwn ? 'own' : 'other');

            const when = ts ? new Date(ts) : new Date();
            const time = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const sender = isOwn ? 'You' : 'PC';

            if (isFile && fileData) {
                div.dataset.copyText = 'File: ' + fileName + '\n' + location.origin + rdAuthUrl(fileData);
                div.innerHTML = '<div class="message-bubble">'
                    + '<a href="' + escapeAttr(rdAuthUrl(fileData)) + '" class="file-message" download="' + escapeAttr(fileName) + '" target="_blank">'
                    + '<span class="file-icon">📄</span>'
                    + '<span>' + escapeHtml(fileName) + '</span>'
                    + '</a>'
                    + '<div class="message-meta">'
                    + '<span>' + sender + '</span>'
                    + '<span>' + time + '</span>'
                    + '<button class="copy-btn" onclick="copyToClipboard(this)">📋 Copy Link</button>'
                    + '</div>'
                    + '</div>';
            } else {
                div.dataset.copyText = text;
                div.innerHTML = '<div class="message-bubble">'
                    + escapeHtml(text)
                    + '<div class="message-meta">'
                    + '<span>' + sender + '</span>'
                    + '<span>' + time + '</span>'
                    + '<button class="copy-btn" onclick="copyToClipboard(this)">📋 Copy</button>'
                    + '</div>'
                    + '</div>';
            }

            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
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
            const original = btn.innerText;
            const ok = function() {
                btn.innerText = '✅ Copied!';
                btn.style.color = '#4ade80';
                setTimeout(function() {
                    btn.innerText = original;
                    btn.style.color = '';
                }, 1500);
            };
            const fail = function() {
                btn.innerText = '❌ Failed';
                setTimeout(function() { btn.innerText = '📋 Copy'; }, 1500);
            };
            // navigator.clipboard only exists in secure contexts (HTTPS/localhost);
            // plain-HTTP mobile sessions must fall back to execCommand('copy').
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(ok).catch(function() {
                    legacyCopy(text) ? ok() : fail();
                });
            } else {
                legacyCopy(text) ? ok() : fail();
            }
        }

        function sendChatMessage() {
            const text = chatInput.value.trim();
            if (!text) return;
            appendMessage(text, true);
            socket.emit('chat:message', { text });
            chatInput.value = '';
        }

        async function sendChatFiles(files) {
            if (!files || files.length === 0) return;

            const statusEl = document.getElementById('chatStatus');
            let done = 0;
            let failed = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                statusEl.innerText = 'Uploading ' + (i + 1) + '/' + files.length + ': ' + file.name;
                const formData = new FormData();
                formData.append('files', file);

                try {
                    const res = await fetch(rdAuthUrl('/upload'), { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.success) {
                        const fileUrl = '/download/' + encodeURIComponent(data.filename);
                        appendMessage('', true, true, data.filename, fileUrl);
                        socket.emit('chat:file', { filename: data.filename });
                        done++;
                    } else {
                        failed++;
                    }
                } catch (err) {
                    failed++;
                    console.error('File upload error:', err);
                }
            }

            statusEl.innerText = failed === 0
                ? '✅ ' + done + ' file' + (done > 1 ? 's' : '') + ' sent'
                : '✅ ' + done + ' sent, ❌ ' + failed + ' failed';
        }


        // Receive chat messages from other clients. The PC's own always-open
        // window is public/chat.html, so there is no in-page panel here any more.
        socket.on('chat:message', function(data) {
            appendMessage(data.text, data.dir === myRole, false, null, null, data.ts, data.id);
        });

        socket.on('chat:file', function(data) {
            appendMessage('', data.dir === myRole, true, data.filename, data.url, data.ts, data.id);
        });

        // A remote client cleared the history: wipe our rendered list too.
        socket.on('chat:cleared', function() {
            clearChatMessages();
            const st = document.getElementById('chatStatus');
            if (st) {
                st.innerText = 'History cleared on both sides';
                st.style.color = '#4ade80';
            }
        });

        // Clear chat history on both sides from the mobile chat tab.
        const clearChatBtn = document.getElementById('clearChatBtn');
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', function() {
                if (!confirm('Clear chat history on BOTH the PC and the mobile side?')) return;
                clearChatMessages();
                socket.emit('chat:clear');
            });
        }

        // ---------- Connection status + auth guard ----------
        function setConnStatus(ok) {
            const pill = document.getElementById('connStatus');
            const txt = document.getElementById('connText');
            if (!pill || !txt) return;
            pill.classList.toggle('conn-ok', !!ok);
            pill.classList.toggle('conn-bad', !ok);
            txt.textContent = ok ? 'Connected' : 'Offline';
        }

        socket.on('connect', function() {
            setConnStatus(true);
            if (!AUTH_TOKEN) location.replace('/gate');
        });

        socket.on('disconnect', function() {
            setConnStatus(false);
        });

        socket.on('connect_error', function(err) {
            setConnStatus(false);
            if (err && /unauthorized/i.test(err.message)) location.replace('/gate');
        });

        // Req 3: replay the previous conversation on connect. The list is the
        // authoritative view: clear anything already rendered (e.g. left over
        // from a previous session after a server restart) then replay, so the
        // same message can never appear twice.
        socket.on('chat:history', function(data) {
            const entries = (data && data.entries) || [];
            clearChatMessages();
            entries.forEach(function (entry) {
                const isOwn = entry.dir === myRole;
                if (entry.type === 'file') {
                    appendMessage('', isOwn, true, entry.filename, entry.url, entry.ts, entry.id);
                } else {
                    appendMessage(entry.text, isOwn, false, null, null, entry.ts, entry.id);
                }
            });
        });
    