import { mkdir, copyFile, rm } from 'node:fs/promises';
await rm('public', { recursive: true, force: true });
await mkdir('public');
for (const file of ['index.html', 'admin.html', 'admin.css', 'admin.js']) await copyFile(file, `public/${file}`);
