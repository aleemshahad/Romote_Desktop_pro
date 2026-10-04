'use strict';

// Generates the Romte Remote app icon (build/icon.png + build/icon.ico)
// procedurally - no external image files needed. Safe to re-run anywhere
// (GitHub Actions runs it before electron-builder).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- drawing ----------

// Lightning bolt polygon (normalized 0..1, y down).
const BOLT = [
    [0.58, 0.06], [0.28, 0.56], [0.46, 0.56],
    [0.42, 0.94], [0.72, 0.40], [0.54, 0.40]
];
const BOLT_M = 0.15; // margin
const BOLT_S = 0.70; // scale

function boltPoint(u, v) {
    // u,v in 0..1 icon space; the bolt occupies the centered BOLT_S box.
    const nx = (u - BOLT_M) / BOLT_S;
    const ny = (v - BOLT_M) / BOLT_S;
    let inside = false;
    for (let i = 0, j = BOLT.length - 1; i < BOLT.length; j = i++) {
        const xi = BOLT[i][0], yi = BOLT[i][1];
        const xj = BOLT[j][0], yj = BOLT[j][1];
        if ((yi > ny) !== (yj > ny)) {
            const t = (ny - yi) / (yj - yi);
            const xCross = xi + t * (xj - xi);
            if (nx < xCross) inside = !inside;
        }
    }
    return inside;
}

function roundedRect(x, y, size) {
    const r = size * 0.225;
    const c = size / 2;
    const dx = Math.abs(x - c);
    const dy = Math.abs(y - c);
    if (dx > c || dy > c) return false;
    const cx = Math.max(dx - (c - r), 0);
    const cy = Math.max(dy - (c - r), 0);
    return cx * cx + cy * cy <= r * r;
}

// Diagonal indigo -> violet gradient with a subtle depth shade.
function gradient(x, y, size) {
    const t = (x + y) / (2 * size);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    let rr = lerp(0x63, 0xa8);
    let gg = lerp(0x66, 0x55);
    let bb = lerp(0xf1, 0xf7);
    const shade = 1 - 0.16 * Math.pow(y / size, 1.6);
    rr = Math.round(rr * shade);
    gg = Math.round(gg * shade);
    bb = Math.round(bb * shade);
    return [rr, gg, bb];
}

// 4x4 supersampling for smooth edges.
function render(size) {
    const px = Buffer.alloc(size * size * 4);
    const SUB = 4;
    const step = 1 / SUB;
    for (let oy = 0; oy < size; oy++) {
        for (let ox = 0; ox < size; ox++) {
            let inBolt = 0, inRect = 0;
            for (let sy = 0; sy < SUB; sy++) {
                for (let sx = 0; sx < SUB; sx++) {
                    const x = ox + (sx + 0.5) * step;
                    const y = oy + (sy + 0.5) * step;
                    if (roundedRect(x, y, size)) {
                        inRect++;
                        if (boltPoint(x / size, y / size)) inBolt++;
                    }
                }
            }
            if (inRect === 0) continue; // transparent corner
            const i = (oy * size + ox) * 4;
            const boltCov = inBolt / (SUB * SUB);
            if (boltCov > 0.5) {
                px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
            } else {
                const [r, g, b] = gradient(ox + 0.5, oy + 0.5, size);
                // antialiased bolt edge: blend white into gradient
                const w = boltCov;
                px[i] = Math.round(r + (255 - r) * w);
                px[i + 1] = Math.round(g + (255 - g) * w);
                px[i + 2] = Math.round(b + (255 - b) * w);
            }
            px[i + 3] = 255;
        }
    }
    return px;
}

// ---------- PNG encoder (RGBA, filter 0) ----------

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, rgba) {
    const raw = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) {
        raw[y * (size * 4 + 1)] = 0;
        rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type RGBA
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

// ---------- ICO encoder (PNG-compressed entries, valid on Windows Vista+) ----------

function encodeIco(entries) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(entries.length, 4);

    let dataOffset = 6 + entries.length * 16;
    const dirs = [];
    for (const e of entries) {
        const d = Buffer.alloc(16);
        d[0] = e.size >= 256 ? 0 : e.size;
        d[1] = e.size >= 256 ? 0 : e.size;
        d[2] = 0;
        d[3] = 0;
        d.writeUInt16LE(1, 4);
        d.writeUInt16LE(32, 6);
        d.writeUInt32LE(e.data.length, 8);
        d.writeUInt32LE(dataOffset, 12);
        dataOffset += e.data.length;
        dirs.push(d);
    }
    return Buffer.concat([header, ...dirs, ...entries.map(e => e.data)]);
}

// ---------- main ----------

const outDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const png512 = encodePng(512, render(512));
fs.writeFileSync(path.join(outDir, 'icon.png'), png512);
console.log('[ICON] build/icon.png written (' + png512.length + ' bytes)');

const icoEntries = [256, 128, 64, 48, 32, 16].map((size) => ({
    size: size,
    data: encodePng(size, render(size))
}));
const ico = encodeIco(icoEntries);
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
console.log('[ICON] build/icon.ico written (' + ico.length + ' bytes, sizes: 256/128/64/48/32/16)');
