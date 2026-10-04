export const uid = () => crypto.randomUUID();
export const clone = value => structuredClone(value);
export const escape = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
export const number = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
export const color = (value, fallback = '#175dff') => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
export function safeUrl(value, { media = false } = {}) {
  const url = String(value || '').trim();
  if (url.startsWith('#') && !media) return url;
  if (media && /^data:(image\/(png|jpeg|webp|avif|gif)|video\/(mp4|webm));base64,[a-z0-9+/=]+$/i.test(url)) return url;
  try { const parsed = new URL(url); return (media ? ['https:', 'http:', 'blob:'] : ['https:', 'http:', 'mailto:', 'tel:']).includes(parsed.protocol) ? url : ''; } catch { return ''; }
}
export function makeBlock(type = 'text') {
  return { id: uid(), type, text: type === 'heading' ? 'Tiêu đề mới' : type === 'text' ? 'Viết nội dung của bạn tại đây.' : '', mediaId: '', url: '', label: 'Xem thêm', caption: '', level: 2,
    style: { span: type === 'text' || type === 'heading' ? 4 : 2, height: type === 'image' || type === 'video' ? 360 : 180, radius: 24, fit: 'cover', x: 50, y: 50, font: 'sans', size: type === 'heading' ? 40 : 18, weight: type === 'heading' ? 600 : 400, lineHeight: 1.5, align: 'left', color: '#0f2448', gradient: '', opacity: 1 } };
}
export function defaultDocument() {
  return { version: 1,
    profile: { name: 'Nguyễn Minh Trí', alias: 'Mabi', eyebrow: 'PERSONAL / CREATIVE PORTFOLIO', headline: 'Ý tưởng\nthành hình.', subtitle: 'Một không gian dành cho thiết kế, ý tưởng và những điều đang được tạo nên.', intro: '', role: '', location: '', email: '', phone: '', socials: [], portraitId: '',
      portrait: { scale: 1, x: 0, y: 0, rotation: 0, flip: false, opacity: 1, shadow: true, glow: true, depth: true } },
    theme: { primary: '#175dff', secondary: '#c8edff', background: '#f2f7ff', text: '#0f2448', glassOpacity: 0.55, blur: 24, border: 1, glowIntensity: 0.6, stars: true, mouseGlow: true },
    layout: [
      { id: 'about', title: 'Một chút về mình.', kicker: '01 / GIỚI THIỆU', visible: true },
      { id: 'works', title: 'Không gian sáng tạo.', kicker: '02 / SẢN PHẨM', visible: true },
      { id: 'experience', title: 'Hành trình làm việc.', kicker: '03 / KINH NGHIỆM', visible: true },
      { id: 'skills', title: 'Bộ công cụ của mình.', kicker: '04 / CÔNG CỤ & PHẦN MỀM', visible: true },
      { id: 'education', title: 'Luôn tiếp tục học hỏi.', kicker: '05 / HỌC VẤN', visible: true },
      { id: 'projects', title: 'Từ ý tưởng đến dự án.', kicker: '06 / DỰ ÁN', visible: true },
      { id: 'contact', title: 'Cùng tạo nên\nđiều tiếp theo.', kicker: '07 / LIÊN HỆ', visible: true },
    ],
    galleries: [{ id: uid(), title: 'Thiết kế đồ hoạ', blocks: [] }, { id: uid(), title: 'Dự án cá nhân', blocks: [] }],
    experience: [], skills: [], education: [], projects: [], custom: [] };
}
export function validateDocument(doc) {
  if (!doc || doc.version !== 1 || typeof doc.profile !== 'object' || typeof doc.theme !== 'object') throw new Error('Nội dung portfolio không đúng định dạng.');
  for (const key of ['layout', 'galleries', 'experience', 'skills', 'education', 'projects', 'custom']) if (!Array.isArray(doc[key])) throw new Error('Thiếu mục ' + key);
  const textKeys = ['name', 'alias', 'eyebrow', 'headline', 'subtitle', 'intro', 'role', 'location', 'email', 'phone', 'portraitId'];
  for (const key of textKeys) if (typeof doc.profile[key] !== 'string') throw new Error('Thông tin cá nhân không đúng định dạng.');
  if (!Array.isArray(doc.profile.socials) || !doc.profile.portrait) throw new Error('Thông tin ảnh/liên hệ không đúng định dạng.');
  const ids = new Set();
  for (const group of [...doc.galleries, ...doc.projects, ...doc.custom]) {
    if (!group || typeof group.id !== 'string' || !Array.isArray(group.blocks)) throw new Error('Mục nội dung không hợp lệ.');
    for (const block of group.blocks) {
      if (!block || !['heading', 'text', 'image', 'video', 'button'].includes(block.type) || typeof block.id !== 'string' || !block.style || ids.has(block.id)) throw new Error('Ô nội dung không hợp lệ.');
      ids.add(block.id);
    }
  }
  return clone(doc);
}
export function referencedMedia(doc) {
  const ids = new Set();
  if (doc.profile.portraitId) ids.add(doc.profile.portraitId);
  for (const group of [...doc.galleries, ...doc.projects, ...doc.custom]) {
    if (group.coverId) ids.add(group.coverId);
    for (const block of group.blocks) if (block.mediaId) ids.add(block.mediaId);
  }
  return ids;
}
export function findGroup(doc, id) { return [...doc.galleries, ...doc.projects, ...doc.custom].find(x => x.id === id); }
export function moveItem(array, from, to) {
  if (from < 0 || from >= array.length || to < 0 || to >= array.length || from === to) return;
  array.splice(to, 0, array.splice(from, 1)[0]);
}
export function mediaInUse(id, draft, published) {
  return referencedMedia(draft).has(id) || (published ? referencedMedia(published.document).has(id) : false);
}
export function makeSnapshot(doc, media, publishedAt = new Date().toISOString()) {
  const document = validateDocument(doc);
  const references = referencedMedia(document);
  const assets = {};
  for (const id of references) {
    const item = media[id];
    if (!item || !safeUrl(item.url, { media: true })) throw new Error('Ảnh/video đang được sử dụng không còn tồn tại.');
    assets[id] = { id, name: String(item.name || ''), mime: item.mime, url: item.url, width: item.width || 0, height: item.height || 0 };
  }
  return { document, assets, publishedAt };
}
export function publicAssetUrl(url, path) {
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(path)) throw new Error('Đường dẫn ảnh không hợp lệ.');
  return url.replace(/\/$/, '') + '/storage/v1/object/public/portfolio-public/' + path;
}
