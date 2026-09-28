#!/usr/bin/env node
// Inline every <script src> into index.html so the game ships as one file.
// Usage: node tools/bundle.js [out.html]   (default: dist/alley-cat.html)
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist', 'alley-cat.html'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const bundled = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  return `<script>\n// ---- ${src} ----\n${code.replace(/<\/script/gi, '<\\/script')}</script>`;
});

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, bundled);
console.log(`wrote ${path.relative(process.cwd(), out)} (${(bundled.length / 1024).toFixed(1)} KB)`);
