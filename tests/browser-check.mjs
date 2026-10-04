// Optional browser QA: install Playwright + Chromium, then run
// node tests/browser-check.mjs. The local preview starts automatically. The API is mocked;
// database authorization is exercised separately by rls.test.js.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { defaultDocument } from '../src/model.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
let launch = { headless: true };
if (process.env.CHROMIUM_EXECUTABLE) launch = { headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] };
if (process.env.CHROMIUM_MODULE) {
  const binary = (await import(process.env.CHROMIUM_MODULE)).default;
  launch = { headless: true, executablePath: await binary.executablePath(), args: binary.args };
}
const browser = await chromium.launch(launch);
await mkdir('docs/screenshots', { recursive: true });
const errors = [];
const report = [];
const reportPass = message => { report.push(message); console.log('PASS ' + message); };
const base = process.env.QA_URL || 'http://localhost:4173/';
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
let server;
if (!process.env.QA_URL) {
  server = spawn(process.execPath, ['scripts/dev.mjs'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* Wait for the local build. */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
try {
  const publicPage = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  publicPage.on('pageerror', error => errors.push(error.message));
  await publicPage.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await overflow(publicPage), false);
  assert.equal(await publicPage.locator('.editor-shell').count(), 0);
  assert.equal(await publicPage.locator('h1').innerText(), 'Ý tưởng\nthành hình.');
  await publicPage.screenshot({ path: 'docs/screenshots/desktop.png' });
  await publicPage.evaluate(() => scrollTo(0, 1000));
  await publicPage.waitForTimeout(150);
  assert.ok(await publicPage.locator('.site-header').evaluate(x => Math.abs(x.getBoundingClientRect().top - 20) < 2));
  reportPass('public desktop renders without overflow and navigation stays visible');
  await publicPage.setViewportSize({ width: 390, height: 844 });
  await publicPage.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await overflow(publicPage), false);
  await publicPage.locator('.menu-toggle').click();
  assert.equal(await publicPage.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
  await publicPage.locator('nav [href="#education"]').click();
  assert.equal(await publicPage.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
  await publicPage.goto(base, { waitUntil: 'networkidle' });
  await publicPage.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
  reportPass('public mobile renders without overflow and menu navigation works');
  await publicPage.goto(base + '#/editor', { waitUntil: 'networkidle' });
  assert.equal(await publicPage.locator('[data-setup-form]').count(), 1);
  await publicPage.locator('[name="url"]').fill('https://mabi-test.supabase.co');
  await publicPage.locator('[name="key"]').fill('sb_secret_NOT_ALLOWED');
  await publicPage.locator('[data-setup-form] button').click();
  await publicPage.waitForFunction(() => document.querySelector('.setup-state')?.textContent.includes('Chỉ dùng'));
  reportPass('unconfigured editor shows setup and rejects a secret key');

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let draft = defaultDocument(), revision = 0, published = null, media = [];
  const png = Buffer.from(await publicPage.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#175dff'; ctx.fillRect(0, 0, 200, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  const owner = '11111111-1111-4111-a111-111111111111';
  const payload = Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const token = 'eyJhbGciOiJIUzI1NiJ9.' + payload + '.signature';
  await context.route('**/portfolio-config.json', route => route.fulfill({ json: { supabaseUrl: 'https://mabi-test.supabase.co', supabasePublishableKey: 'sb_publishable_QA_ONLY' } }));
  await context.route('https://mabi-test.supabase.co/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, body = req.headers()['content-type']?.includes('application/json') ? req.postDataJSON() : null;
    const json = value => route.fulfill({ json: value, headers: { 'access-control-allow-origin': '*' } });
    const row = value => json(req.headers().accept?.includes('vnd.pgrst.object') ? value : value ? [value] : []);
    if (path === '/auth/v1/token') return json({ access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'QA_REFRESH', user: { id: owner, email: 'owner@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {} } });
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (path.endsWith('/rpc/is_portfolio_owner')) return json(true);
    if (path.endsWith('/rpc/save_portfolio_draft')) {
      if (body.p_expected_revision !== revision) return route.fulfill({ status: 400, json: { message: 'DRAFT_CONFLICT' } });
      draft = body.p_document; revision++; return json(revision);
    }
    if (path.endsWith('/rpc/publish_portfolio')) {
      assert.equal(body.p_expected_revision, revision); assert.deepEqual(body.p_snapshot.document, draft);
      published = body.p_snapshot; return json(null);
    }
    if (path.endsWith('/portfolio_drafts')) return row(revision ? { document: draft, revision } : null);
    if (path.endsWith('/portfolio_published')) return row(published ? { snapshot: published } : null);
    if (path.endsWith('/portfolio_media')) {
      if (req.method() === 'POST') { media.unshift({ ...body, created_at: new Date().toISOString() }); return row(media[0]); }
      if (req.method() === 'PATCH') { const id = new URL(req.url()).searchParams.get('id')?.slice(3); Object.assign(media.find(x => x.id === id), body); return req.headers().prefer?.includes('return=representation') ? row(media.find(x => x.id === id)) : route.fulfill({ status: 204 }); }
      if (req.method() === 'DELETE') { const id = new URL(req.url()).searchParams.get('id')?.slice(3); media = media.filter(x => x.id !== id); return json([{ id }]); }
      return json(media);
    }
    if (path === '/storage/v1/object/sign/portfolio-drafts') return json(body.paths.map(path => ({ path, signedURL: '/object/sign/portfolio-drafts/' + path + '?token=QA' })));
    if (path.startsWith('/storage/v1/object/sign/portfolio-drafts/') && req.method() === 'POST') return json({ signedURL: '/object/sign/portfolio-drafts/' + path.split('/portfolio-drafts/')[1] + '?token=QA' });
    if (path.startsWith('/storage/v1/object/list/')) return json([]);
    if (path.startsWith('/storage/v1/object/') && req.method() === 'GET') return route.fulfill({ body: png, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } });
    if (path.startsWith('/storage/v1/object/')) return json({ Key: path.slice(19) });
    throw new Error('Unexpected QA API request: ' + req.method() + ' ' + path);
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '#/editor', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.auth-form').count(), 1);
  await page.locator('[name="email"]').fill('owner@example.com');
  await page.locator('[name="password"]').fill('QA_PASSWORD');
  await page.locator('.auth-form button').click();
  await page.waitForSelector('.editor-shell');
  await page.screenshot({ path: 'docs/screenshots/editor.png' });
  reportPass('owner login opens the editor through the Supabase SDK');
  await page.locator('[data-bind="profile.headline"]').fill('Nội dung bản nháp');
  await page.locator('[data-action="save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-save-status]')?.textContent === 'Đã lưu bản nháp');
  assert.equal(draft.profile.headline, 'Nội dung bản nháp');
  const visitor = await context.newPage();
  await visitor.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await visitor.locator('h1').innerText(), 'Ý tưởng\nthành hình.');
  reportPass('saving a draft does not change what visitors see');
  await page.locator('[data-tab="blocks"]').click();
  await page.locator('[data-action="add-block"][data-type="heading"]').click();
  await page.locator('.block-inspector textarea').fill('Tác phẩm kiểm tra');
  await page.locator('[data-action="add-image"]').click();
  await page.locator('[data-picker-upload]').setInputFiles({ name: 'qa-image.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('[data-action="pick-media"]').catch(async error => { console.error('Upload status:', await page.locator('#toast').textContent()); throw error; });
  await page.locator('[data-action="pick-media"]').click();
  await page.waitForSelector('.editable-block.selected .resize-handle');
  await page.locator('.editable-block.selected .resize-handle').evaluate(x => x.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const handle = await page.locator('.editable-block.selected .resize-handle').boundingBox();
  await page.mouse.move(handle.x + 10, handle.y + 10); await page.mouse.down(); await page.mouse.move(handle.x + 150, handle.y + 60, { steps: 8 }); await page.mouse.up();
  const resizedHeight = await page.locator('[data-bind$="style.height"]').inputValue();
  assert.ok(Number(resizedHeight) > 360);
  reportPass('uploading, selecting an image and dragging its resize handle work');
  await page.locator('[data-action="preview"]').click();
  await page.locator('[data-device="mobile"]').click();
  assert.equal(await page.locator('.preview-viewport').evaluate(x => x.scrollWidth > x.clientWidth), false);
  await page.locator('[data-action="end-preview"]').click();
  await page.locator('[data-action="publish"]').click();
  await page.waitForFunction(() => document.querySelector('[data-action="export-html"]')?.disabled === false);
  await visitor.reload({ waitUntil: 'networkidle' });
  assert.equal(await visitor.locator('h1').innerText(), 'Nội dung bản nháp');
  assert.equal(Object.keys(published.assets).length, 1);
  reportPass('mobile preview and publication with public image assets work');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action="export-html"]').click();
  const exported = await downloadPromise, filePath = await exported.path();
  const html = await readFile(filePath, 'utf8');
  assert.ok(html.includes('data:image/png;base64,'));
  assert.ok(!html.includes('QA_PASSWORD') && !html.includes('QA_REFRESH') && !html.includes('sb_publishable_'));
  assert.ok(!html.includes('editor-shell') && !html.includes('#/editor'));
  const offline = await browser.newPage(); await offline.route('**/*', route => route.abort());
  await offline.setContent(html);
  assert.equal(await offline.locator('h1').innerText(), 'Nội dung bản nháp');
  assert.ok(await offline.locator('.media-block img').evaluate(x => x.complete && x.naturalWidth > 0));
  await offline.locator('[data-lightbox]').click();
  assert.equal(await offline.locator('dialog[open]').count(), 1);
  await offline.locator('.export-lightbox button').click();
  reportPass('exported HTML renders offline with embedded images and no owner data');
  await page.locator('[data-action="logout"]').click();
  await page.waitForSelector('.auth-form');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('mabi-owner-session')), null);
  reportPass('logout removes the editor and its stored session');
  assert.deepEqual(errors, []);
  console.log('Browser QA passed: ' + report.length + ' checks, no page errors.');
} finally { await browser.close(); server?.kill(); }
