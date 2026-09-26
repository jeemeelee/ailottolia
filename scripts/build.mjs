import { mkdir, copyFile, rm, readFile, writeFile } from 'node:fs/promises';
// Only these public assets are published; server helpers and tests stay private.
await rm('public', { recursive: true, force: true });
await mkdir('public');
for (const file of ['index.html', 'telemetry.js']) await copyFile(file, `public/${file}`);
// Copy the project's actual script path from Vercel Analytics setup (optional).
const analyticsPath = process.env.VERCEL_ANALYTICS_SCRIPT_PATH;
if (analyticsPath) {
  if (!/^\/[a-zA-Z0-9_/-]+\/script\.js$/.test(analyticsPath) || analyticsPath.startsWith('//')) throw new Error('Invalid VERCEL_ANALYTICS_SCRIPT_PATH');
  const html = await readFile('public/index.html', 'utf8');
  const script = `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};</script><script defer src="${analyticsPath}"></script>`;
  await writeFile('public/index.html', html.replace('</body>', `${script}</body>`));
}
