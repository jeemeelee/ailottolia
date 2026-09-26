import { mkdir, copyFile, rm } from 'node:fs/promises';
// Only these public assets are published; server helpers and tests stay private.
await rm('public', { recursive: true, force: true });
await mkdir('public');
for (const file of ['index.html', 'telemetry.js']) await copyFile(file, `public/${file}`);
