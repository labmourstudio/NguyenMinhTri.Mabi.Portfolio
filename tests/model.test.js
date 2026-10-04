import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDocument, makeBlock, makeSnapshot, referencedMedia, mediaInUse, safeUrl, publicAssetUrl, validateDocument } from '../src/model.js';
import { portfolioMarkup, blockMarkup } from '../src/view.js';
import { validateConfig } from '../src/backend.js';

test('new portfolio contains the requested name and no invented qualifications', () => {
  const doc = defaultDocument();
  assert.equal(doc.profile.name, 'Nguyễn Minh Trí');
  for (const key of ['experience', 'education', 'skills', 'projects']) assert.deepEqual(doc[key], []);
  assert.ok(doc.galleries.every(x => !x.blocks.length));
  assert.deepEqual(validateDocument(doc), doc);
});
test('snapshot includes only referenced media and never private storage metadata', () => {
  const doc = defaultDocument(), b = makeBlock('image'); b.mediaId = 'used'; doc.galleries[0].blocks.push(b);
  const snapshot = makeSnapshot(doc, { used: { id: 'used', name: 'Photo', mime: 'image/png', url: 'https://x.supabase.co/public/photo.png', path: 'PRIVATE_PATH', secret: 'NO' }, other: { url: 'https://unused.com/img.png' } });
  assert.deepEqual(Object.keys(snapshot.assets), ['used']);
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_PATH'));
  assert.ok(!JSON.stringify(snapshot).includes('unused.com'));
  doc.profile.name = 'Changed draft';
  assert.equal(snapshot.document.profile.name, 'Nguyễn Minh Trí');
});
test('media in use includes portrait, projects and custom sections', () => {
  const doc = defaultDocument(); doc.profile.portraitId = 'portrait';
  doc.projects.push({ id: 'project', coverId: 'cover', blocks: [] });
  const b = makeBlock('image'); b.mediaId = 'custom-image'; doc.custom.push({ id: 'custom', blocks: [b] });
  assert.deepEqual([...referencedMedia(doc)].sort(), ['cover', 'custom-image', 'portrait']);
  assert.equal(mediaInUse('portrait', defaultDocument(), { document: doc }), true);
  assert.equal(mediaInUse('unused', doc, null), false);
});
test('rendering escapes text and rejects executable links and inline styles', () => {
  const doc = defaultDocument(); doc.profile.name = '<img src=x onerror=alert(1)>';
  assert.ok(portfolioMarkup(doc).includes('&lt;img'));
  const b = makeBlock('button'); b.url = 'javascript:alert(1)';
  assert.ok(!blockMarkup(b, {}).includes('href='));
  b.type = 'text'; b.style.color = 'red;position:fixed';
  assert.ok(!blockMarkup(b, {}).includes('position:fixed'));
  assert.equal(safeUrl('data:text/html,<script>x</script>'), '');
  assert.equal(safeUrl('https://example.com'), 'https://example.com');
});
test('storage paths and configuration cannot accept secrets or an arbitrary server', () => {
  assert.throws(() => publicAssetUrl('https://x.supabase.co', '../evil'));
  assert.equal(validateConfig({ supabaseUrl: '', supabasePublishableKey: '' }), null);
  assert.throws(() => validateConfig({ supabaseUrl: 'https://example.com', supabasePublishableKey: 'sb_publishable_x' }));
  assert.throws(() => validateConfig({ supabaseUrl: 'https://x.supabase.co', supabasePublishableKey: 'sb_secret_x' }));
  const service = ['x', Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'), 'x'].join('.');
  assert.throws(() => validateConfig({ supabaseUrl: 'https://x.supabase.co', supabasePublishableKey: service }));
});
test('public markup contains no owner controls or editor route', () => {
  const html = portfolioMarkup(defaultDocument());
  assert.ok(!html.includes('#/editor'));
  assert.ok(!html.includes('data-action="publish"'));
  assert.ok(!html.includes('OWNER ACCESS'));
});
