import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
export async function buildSite() {
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist/assets', { recursive: true });
  await Promise.all([
    cp('index.html', 'dist/index.html'),
    cp('portfolio-config.json', 'dist/portfolio-config.json'),
    cp('assets', 'dist/assets', { recursive: true }),
    cp('docs/HUONG_DAN.md', 'dist/HUONG_DAN.md'),
    cp('supabase/migrations/001_portfolio.sql', 'dist/001_portfolio.sql'),
  ]);
  await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, sourcemap: false, format: 'esm', target: ['es2022'], outfile: 'dist/assets/app.js' });
}
await buildSite();
console.log('Built portfolio → dist/');
