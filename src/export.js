import { portfolioMarkup, projectMarkup } from './view.js';
import { escape as e, clone } from './model.js';
import { download } from './ui.js';

const blobData = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
function offlineRuntime(theme) {
  document.addEventListener('click', function(event) {
    const menu = event.target.closest('.menu-toggle');
    if (menu) { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.closest('.site-header').classList.toggle('menu-open', open); }
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      document.querySelectorAll('[data-filter]').forEach(item => { item.classList.toggle('active', item === filter); item.setAttribute('aria-pressed', String(item === filter)); });
      document.querySelectorAll('[data-gallery]').forEach(item => item.hidden = filter.dataset.filter !== 'all' && item.dataset.gallery !== filter.dataset.filter);
    }
    if (event.target.closest('.site-header a')) { document.querySelector('.site-header').classList.remove('menu-open'); document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false'); }
    const imageButton = event.target.closest('[data-lightbox]');
    if (imageButton?.querySelector('img')) {
      const dialog = document.createElement('dialog'), img = document.createElement('img'), close = document.createElement('button');
      dialog.className = 'export-lightbox'; img.src = imageButton.querySelector('img').src; img.alt = imageButton.querySelector('img').alt;
      close.textContent = '×'; close.setAttribute('aria-label', 'Đóng ảnh'); close.onclick = () => dialog.close();
      dialog.append(close, img); document.body.append(dialog); dialog.onclose = () => dialog.remove(); dialog.onclick = e => { if (e.target === dialog) dialog.close(); }; dialog.showModal();
    }
  });
  if ((!theme.stars && !theme.mouseGlow) || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover)').matches) return;
  const layer = document.createElement('div'), glow = document.createElement('div'); layer.className = 'cursor-layer'; layer.setAttribute('aria-hidden', 'true');
  layer.style.setProperty('--glow-intensity', theme.glowIntensity); layer.style.setProperty('--primary', theme.primary);
  glow.className = 'cursor-glow'; if (theme.mouseGlow) layer.append(glow); document.body.append(layer);
  let last = 0;
  document.addEventListener('pointermove', event => {
    glow.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)';
    if (!theme.stars || performance.now() - last < 70 || layer.children.length > 18) return;
    last = performance.now(); const particle = document.createElement('span'); particle.className = 'star-particle'; particle.textContent = '✦';
    particle.style.cssText = 'left:' + event.clientX + 'px;top:' + event.clientY + 'px;--size:14px;font-size:14px;--drift:' + (Math.random() * 60 - 30) + 'px';
    layer.append(particle); particle.onanimationend = () => particle.remove();
  }, { passive: true });
}
export async function exportPortfolio(snapshot, progress = () => {}) {
  const copy = clone(snapshot), [cssResponse] = await Promise.all([fetch(new URL('../assets/style.css', import.meta.url))]);
  if (!cssResponse.ok) throw new Error('Không tải được kiểu giao diện để xuất HTML.');
  const css = await cssResponse.text();
  for (const [id, asset] of Object.entries(copy.assets)) {
    progress('Đang đưa ảnh/video vào bản chia sẻ…');
    const response = await fetch(asset.url);
    if (!response.ok) throw new Error('Không tải được tệp ' + asset.name + '. Thử xuất lại khi kết nối ổn định.');
    const blob = await response.blob();
    copy.assets[id].url = await blobData(new Blob([blob], { type: asset.mime }));
  }
  const title = e(copy.document.profile.name + ' — ' + copy.document.profile.alias + ' Portfolio');
  const detail = copy.document.projects.map(project => `<section id="project-${e(project.id)}">${projectMarkup(project, copy.document, copy.assets, true)}</section>`).join('');
  const script = '(' + offlineRuntime.toString() + ')(' + JSON.stringify(copy.document.theme).replace(/</g, '\\u003c') + ')';
  // This document intentionally contains no editor, configuration, account data or API client.
  const html = `<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body>${portfolioMarkup(copy.document, copy.assets, { exported: true })}${detail}<script>${script}<\/script></body></html>`;
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), 'Mabi-Portfolio.html');
}
