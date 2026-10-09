'use strict';

const clipboard = require('./clipboard');
const chat = require('./chat');

const MEDIA_KEYS = {
    play: 'audio_play',
    next: 'audio_next',
    prev: 'audio_prev',
    volup: 'audio_vol_up',
    voldown: 'audio_vol_down',
    mute: 'audio_mute'
};

function create({ io, robot, robotOK, screenshot, screenSize }) {
    const activeStreamSockets = new Set();
    let isCapturing = false;
    let captureLock = false;

    // ~20 FPS JPEG stream, only while at least one client wants it.
    async function checkScreenStream() {
        if (captureLock || activeStreamSockets.size === 0) return;
        captureLock = true;
        isCapturing = true;

        while (activeStreamSockets.size > 0) {
            if (!screenshot) {
                console.error('[SCREENSHOT] Module not loaded - screen streaming disabled.');
                break;
            }
            try {
                const imgBuffer = await screenshot({ format: 'jpeg' });
                for (const socketId of activeStreamSockets) {
                    io.to(socketId).emit('screen_frame', imgBuffer);
                }
            } catch (err) {
                console.error('[SCREENSHOT ERR]', err.message);
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        isCapturing = false;
        captureLock = false;
    }

    function clampX(x) { return Math.max(0, Math.min(screenSize.width, Math.round(x))); }
    function clampY(y) { return Math.max(0, Math.min(screenSize.height, Math.round(y))); }

    function attach(socket) {
        activeStreamSockets.add(socket.id);
        checkScreenStream();

        socket.emit('screen_dim', { width: screenSize.width, height: screenSize.height });

        socket.on('toggle_stream', (data) => {
            if (data && data.active) {
                activeStreamSockets.add(socket.id);
                checkScreenStream();
            } else {
                activeStreamSockets.delete(socket.id);
            }
        });

        socket.on('disconnect', () => {
            activeStreamSockets.delete(socket.id);
            if (activeStreamSockets.size === 0) {
                isCapturing = false;
                captureLock = false;
            }
        });

        // 1. Absolute direct touch move / click
        socket.on('abs_mouse', (data) => {
            if (!robotOK || !data) return;
            try {
                if (typeof data.x === 'number' && typeof data.y === 'number') {
                    robot.moveMouse(clampX(data.x), clampY(data.y));
                    if (data.click) robot.mouseClick(data.click);
                }
            } catch (err) {}
        });

        // 2. Relative trackpad glide move
        socket.on('rel_mouse', (data) => {
            if (!robotOK || !data) return;
            try {
                const pos = robot.getMousePos();
                robot.moveMouse(
                    clampX(pos.x + Math.round(data.dx)),
                    clampY(pos.y + Math.round(data.dy))
                );
            } catch (err) {}
        });

        // Held-button drag & drop (drag starts on the client, button stays
        // down across move events, released on finger lift).
        socket.on('mouse_down', (data) => {
            if (!robotOK || !data) return;
            try { robot.mouseToggle('down', data.button || 'left'); } catch (err) {}
        });

        socket.on('mouse_up', (data) => {
            if (!robotOK || !data) return;
            try { robot.mouseToggle('up', data.button || 'left'); } catch (err) {}
        });

        socket.on('click_current', (data) => {
            if (!robotOK || !data) return;
            try { robot.mouseClick(data.button || 'left'); } catch (err) {}
        });

        socket.on('scroll', (data) => {
            if (!robotOK || !data) return;
            try {
                const ticks = Math.max(1, Math.min(10, Math.round(Math.abs(data.dy) / 10)));
                robot.scrollMouse(0, data.dy > 0 ? -ticks : ticks);
            } catch (err) {}
        });

        // Hardware keys, modifiers, shortcuts and media
        socket.on('action', (data) => {
            if (!robotOK || !data) return;
            try {
                if (data.type === 'click') {
                    robot.mouseClick(data.val);
                } else if (data.type === 'key') {
                    robot.keyTap(data.val);
                } else if (data.type === 'combo') {
                    robot.keyTap(data.key, data.modifiers);
                } else if (data.type === 'media' && MEDIA_KEYS[data.val]) {
                    robot.keyTap(MEDIA_KEYS[data.val]);
                }
            } catch (err) {}
        });

        // Text and voice typing stream
        socket.on('type', (data) => {
            if (!robotOK || !data) return;
            try { if (data.text) robot.typeString(data.text); } catch (err) {}
        });

        socket.on('clipboard:get', async () => {
            socket.emit('clipboard:content', { text: await clipboard.getClipboard() });
        });

        socket.on('clipboard:set', async (data) => {
            if (data && data.text !== undefined) {
                const ok = await clipboard.setClipboard(String(data.text));
                socket.emit('clipboard:set:result', { success: ok });
            }
        });

        chat.register(io, socket);
    }

    return { attach, checkScreenStream, activeStreamSockets, isCapturing: () => isCapturing };
}

module.exports = { create };
