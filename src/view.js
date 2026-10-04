import { escape as e, color, number, safeUrl } from './model.js';
import { star, arrow, modal } from './ui.js';

export function themeStyle(theme) {
  return `--primary:${color(theme.primary)};--secondary:${color(theme.secondary, '#c8edff')};--paper:${color(theme.background, '#f2f7ff')};--ink:${color(theme.text, '#0f2448')};--glass-opacity:${number(theme.glassOpacity, 0.05, 0.95, 0.55)};--glass-blur:${number(theme.blur, 0, 60, 24)}px;--glass-border:${number(theme.border, 0, 4, 1)}px;--glow-intensity:${number(theme.glowIntensity, 0, 1, 0.6)};`;
}
const assetSrc = (assets, id) => safeUrl(assets[id]?.url, { media: true });
function image(assets, id, classes = '', style = '') {
  const item = assets[id], src = assetSrc(assets, id);
  return src ? `<img class="${classes}" src="${e(src)}" alt="${e(item.name || 'Ảnh portfolio')}" style="${style}" loading="lazy" decoding="async">` : '';
}
export function blockMarkup(block, assets) {
  const s = block.style || {};
  const span = number(s.span, 1, 4, 2), height = number(s.height, 60, 1000, 280);
  const css = `--span:${span};--block-height:${height}px;--block-radius:${number(s.radius, 0, 80, 24)}px;opacity:${number(s.opacity, 0.1, 1, 1)};`;
  const fonts = { sans: 'var(--sans)', serif: 'var(--serif)', mono: 'monospace' };
  const textCss = `font-family:${fonts[s.font] || fonts.sans};font-size:clamp(14px,${number(s.size, 12, 120, 18) / 14}vw,${number(s.size, 12, 120, 18)}px);font-weight:${number(s.weight, 300, 800, 400)};line-height:${number(s.lineHeight, 0.9, 2.5, 1.5)};text-align:${['left', 'center', 'right'].includes(s.align) ? s.align : 'left'};color:${color(s.color, '#0f2448')};${s.gradient ? `background-image:linear-gradient(120deg,${color(s.color)},${color(s.gradient)});background-clip:text;-webkit-text-fill-color:transparent;` : ''}`;
  if (block.type === 'heading' || block.type === 'text') {
    const tag = block.type === 'heading' ? 'h' + number(block.level, 1, 3, 2) : 'p';
    return `<div class="content-block text-block" data-block="${e(block.id)}" style="${css}"><${tag} style="${textCss}">${e(block.text)}</${tag}></div>`;
  }
  if (block.type === 'button') {
    const url = safeUrl(block.url);
    return `<div class="content-block button-block" data-block="${e(block.id)}" style="${css}">${url ? `<a class="button glass-button" href="${e(url)}" ${/^https?:/.test(url) ? 'target="_blank" rel="noopener noreferrer"' : ''}>${e(block.label)} ${arrow}</a>` : `<span class="button quiet">${e(block.label)}</span>`}</div>`;
  }
  const src = assetSrc(assets, block.mediaId);
  const mediaStyle = `object-fit:${s.fit === 'contain' ? 'contain' : 'cover'};object-position:${number(s.x, 0, 100, 50)}% ${number(s.y, 0, 100, 50)}%;`;
  const content = src ? (block.type === 'video' ? `<video src="${e(src)}" style="${mediaStyle}" controls playsinline preload="metadata" aria-label="${e(block.caption || assets[block.mediaId]?.name)}"></video>` : `<button class="media-open" data-lightbox="${e(block.mediaId)}" aria-label="Xem ảnh ${e(block.caption || assets[block.mediaId]?.name)}">${image(assets, block.mediaId, '', mediaStyle)}<span class="image-expand">${arrow}</span></button>`) : `<div class="missing-media">${star}<span>${block.type === 'video' ? 'Video' : 'Ảnh'} đang được cập nhật</span></div>`;
  return `<figure class="content-block media-block" data-block="${e(block.id)}" style="${css}">${content}${block.caption ? `<figcaption>${e(block.caption)}</figcaption>` : ''}</figure>`;
}
export const blocksMarkup = (blocks, assets) => `<div class="block-grid">${blocks.map(x => blockMarkup(x, assets)).join('')}</div>`;
const heading = section => `<div class="section-heading"><p class="eyebrow">${e(section.kicker)}</p><h2>${e(section.title)}</h2></div>`;
const labels = { about: 'Giới thiệu', works: 'Sản phẩm', experience: 'Kinh nghiệm', skills: 'Công cụ', education: 'Học vấn', projects: 'Dự án', contact: 'Liên hệ' };
function nav(doc) {
  return `<header class="site-header glass"><a class="wordmark" href="#home" aria-label="Về đầu trang">${e(doc.profile.alias || 'Mabi').toUpperCase()}<span>${star}</span></a><nav aria-label="Điều hướng chính">${doc.layout.filter(x => x.visible && x.id !== 'contact').map(x => `<a href="#${e(x.id)}" data-nav="${e(x.id)}">${e(labels[x.id] || x.title)}</a>`).join('')}</nav>${doc.layout.find(x => x.id === 'contact')?.visible ? `<a class="header-contact" href="#contact">Kết nối ${arrow}</a>` : ''}<button class="menu-toggle" aria-label="Mở menu" aria-expanded="false"><span></span><span></span></button></header>`;
}
function portrait(doc, assets) {
  if (!assetSrc(assets, doc.profile.portraitId)) return `<div class="portrait-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="glass-sculpture"><span>${star}</span></div><span class="floating-star star-a">${star}</span><span class="floating-star star-b">${star}</span><span class="art-caption">A SPACE FOR<br>WHAT COMES NEXT.</span><span class="art-coordinate">CREATIVE / ${e((doc.profile.alias || 'Mabi').toUpperCase())}</span></div>`;
  const p = doc.profile.portrait;
  const style = `transform:translate(${number(p.x, -150, 150, 0)}px,${number(p.y, -150, 150, 0)}px) rotate(${number(p.rotation, -30, 30, 0)}deg) scale(${number(p.scale, 0.2, 2.5, 1)}) scaleX(${p.flip ? -1 : 1});opacity:${number(p.opacity, 0.1, 1, 1)};filter:${p.shadow ? 'drop-shadow(0 20px 24px #0f24483a)' : 'none'};`;
  return `<div class="portrait-art has-portrait ${p.glow ? 'portrait-glow' : ''} ${p.depth ? 'portrait-depth' : ''}"><div class="orbit orbit-one"></div><span class="floating-star star-a">${star}</span>${image(assets, doc.profile.portraitId, 'personal-portrait', style)}</div>`;
}
function emptyWorks() {
  return `<div class="empty-works"><div class="empty-work-main glass"><span class="empty-tag">YOUR CREATIVE SPACE</span><div class="empty-symbol">${star}</div><span class="empty-work-title">Những ý tưởng<br>đang chờ thành hình.</span><span class="empty-work-foot">SẢN PHẨM SẼ XUẤT HIỆN TẠI ĐÂY ${arrow}</span></div><div class="empty-work-side glass"><div class="wire-circle"></div><span>THIẾT KẾ / SÁNG TẠO</span></div><div class="empty-work-small glass">${star}<span>Mỗi tác phẩm,<br>một câu chuyện.</span></div></div>`;
}
function sectionMarkup(section, doc, assets, options) {
  const head = heading(section);
  let content = '';
  if (section.id === 'about') {
    content = `<div class="about-layout"><div>${head}<p class="about-intro">${e(doc.profile.intro || 'Một góc nhỏ để lưu lại những điều mình làm, những điều mình học và những điều mình muốn tạo nên.')}</p>${doc.profile.role ? `<span class="role-chip">${e(doc.profile.role)}</span>` : ''}</div><div class="about-card glass"><div class="about-monogram">${e((doc.profile.alias || 'Mabi').slice(0, 1).toUpperCase())}<span>${star}</span></div><div class="about-card-bottom"><p>${e(doc.profile.name)}</p><span>${e(doc.profile.location || 'THIẾT KẾ · Ý TƯỞNG · SÁNG TẠO')}</span></div></div></div>`;
  } else if (section.id === 'works') {
    const groups = doc.galleries;
    const hasWorks = groups.some(x => x.blocks.length);
    content = `${head}<div class="work-filter" role="group" aria-label="Lọc sản phẩm"><button data-filter="all" class="active" aria-pressed="true">Tất cả</button>${groups.map(x => `<button data-filter="${e(x.id)}" aria-pressed="false">${e(x.title)}</button>`).join('')}</div>${hasWorks ? groups.map(x => `<div class="gallery-group" data-gallery="${e(x.id)}">${x.blocks.length ? `<h3 class="gallery-label">${e(x.title)}</h3>${blocksMarkup(x.blocks, assets)}` : `<p class="empty-note">Mục ${e(x.title)} đang chờ những sản phẩm đầu tiên.</p>`}</div>`).join('') : emptyWorks()}`;
  } else if (section.id === 'experience') {
    content = `<div class="split-section">${head}<div class="timeline">${doc.experience.length ? doc.experience.map((x, i) => `<article class="timeline-item glass"><span class="timeline-index">${String(i + 1).padStart(2, '0')}</span><div><p class="eyebrow">${e(x.period)}</p><h3>${e(x.role)}</h3><p class="company">${e(x.company)}</p><p class="preserve-lines">${e(x.description)}</p>${x.projectId && doc.projects.some(p => p.id === x.projectId) ? `<a class="text-link" href="${options.exported ? '#project-' : '#/project/'}${e(x.projectId)}">Xem sản phẩm liên quan ${arrow}</a>` : ''}</div></article>`).join('') : `<div class="empty-info glass"><span class="outline-number">01</span><h3>Đang viết tiếp hành trình.</h3><p>Kinh nghiệm và những công việc đã thực hiện sẽ được cập nhật tại đây.</p></div>`}</div></div>`;
  } else if (section.id === 'skills') {
    content = `${head}<div class="skill-grid">${doc.skills.length ? doc.skills.map(x => `<article class="skill-card glass"><span class="skill-letter">${e(x.name.slice(0, 2).toUpperCase())}</span><p class="eyebrow">${e(x.category)}</p><h3>${e(x.name)}</h3><p>${e(x.level)}</p>${x.description ? `<span>${e(x.description)}</span>` : ''}</article>`).join('') : ['DESIGN', 'VIDEO', '3D', 'OPERATION'].map((x, i) => `<div class="skill-card glass empty-skill"><span class="skill-letter">${['✦', '↗', '◇', '⌘'][i]}</span><p class="eyebrow">${x}</p><h3>Không ngừng khám phá.</h3><p>Công cụ sẽ được cập nhật.</p></div>`).join('')}</div>`;
  } else if (section.id === 'education') {
    content = `${head}<div class="education-grid">${doc.education.length ? doc.education.map(x => `<article class="education-card glass"><span class="education-icon">${star}</span><p class="eyebrow">${e(x.period)}</p><h3>${e(x.school)}</h3><p>${e(x.program)}</p>${x.note ? `<div class="education-note">${e(x.note)}</div>` : ''}</article>`).join('') : `<article class="education-card glass empty-education"><span class="education-icon">${star}</span><div><h3>Học để tạo nên điều mới.</h3><p>Thông tin học vấn, khoá học và chứng chỉ sẽ được thêm tại đây.</p></div></article>`}</div>`;
  } else if (section.id === 'projects') {
    content = `${head}<div class="project-grid">${doc.projects.length ? doc.projects.map((x, i) => `<a class="project-card glass" href="${options.exported ? '#project-' : '#/project/'}${e(x.id)}"><div class="project-cover">${image(assets, x.coverId) || `<span>${star}</span>`}<span class="project-open">${arrow}</span></div><div class="project-caption"><p class="eyebrow">PROJECT / ${String(i + 1).padStart(2, '0')}</p><h3>${e(x.title)}</h3><p>${e(x.summary)}</p><span>${e(x.role)}</span></div></a>`).join('') : `<div class="project-empty glass"><div class="project-orbit">${star}</div><div><p class="eyebrow">IDEAS IN PROGRESS</p><h3>Mọi dự án lớn<br>đều bắt đầu từ một ý tưởng.</h3><p>Dự án và câu chuyện phía sau sẽ xuất hiện ở đây.</p></div></div>`}</div>`;
  } else if (section.id === 'contact') {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.profile.email) ? doc.profile.email : '';
    content = `<div class="contact-inner"><div>${head}${email ? `<a class="contact-email" href="mailto:${e(email)}">${e(email)} ${arrow}</a>` : '<p class="contact-pending">Thông tin liên hệ sẽ sớm được cập nhật.</p>'}</div><span class="contact-star">${star}</span></div><div class="contact-links">${doc.profile.socials.filter(x => safeUrl(x.url)).map(x => `<a href="${e(safeUrl(x.url))}" target="_blank" rel="noopener noreferrer">${e(x.label)} ${arrow}</a>`).join('')}${doc.profile.phone ? `<a href="tel:${e(doc.profile.phone.replace(/[^+0-9]/g, ''))}">${e(doc.profile.phone)}</a>` : ''}</div>`;
  } else {
    const group = doc.custom.find(x => x.id === section.id);
    content = `${head}${group ? blocksMarkup(group.blocks, assets) : ''}`;
  }
  return `<section class="portfolio-section section-${e(section.id)} ${section.id === 'contact' ? 'contact-section' : ''}" id="${e(section.id)}" data-section="${e(section.id)}"><div class="section-container">${content}</div></section>`;
}
export function portfolioMarkup(doc, assets = {}, options = {}) {
  const worksVisible = doc.layout.some(x => x.id === 'works' && x.visible);
  return `<div class="portfolio" style="${themeStyle(doc.theme)}">${nav(doc)}<main><section class="hero" id="home" data-section="home"><div class="hero-halo"></div><div class="hero-container"><div class="hero-copy"><p class="eyebrow hero-eyebrow"><span class="tiny-star">${star}</span>${e(doc.profile.eyebrow)}</p><h1>${e(doc.profile.headline)}</h1><p class="hero-name">${e(doc.profile.name)}<span>/ ${e(doc.profile.alias)}</span></p><p class="hero-description">${e(doc.profile.subtitle)}</p><div class="hero-actions">${worksVisible ? `<a class="button primary" href="#works">Khám phá sản phẩm ${arrow}</a>` : ''}${doc.layout.some(x => x.id === 'experience' && x.visible) ? '<a class="button glass-button" href="#experience">Hành trình của mình <span>↓</span></a>' : ''}</div></div><div class="hero-visual">${portrait(doc, assets)}<div class="visual-label glass"><span class="label-dot"></span><span>THINK. CREATE. REPEAT.</span><span>${star}</span></div></div></div><div class="hero-bottom"><span>${e(doc.profile.name.toUpperCase())} / PERSONAL PORTFOLIO</span><a href="#${e(doc.layout.find(x => x.visible)?.id || 'home')}">CUỘN ĐỂ KHÁM PHÁ <span>↓</span></a><span class="hero-edition">THE CREATIVE SIDE</span></div></section>${doc.layout.filter(x => x.visible).map(x => sectionMarkup(x, doc, assets, options)).join('')}</main><footer class="site-footer"><a class="wordmark" href="#home">${e((doc.profile.alias || 'Mabi').toUpperCase())}<span>${star}</span></a><p>© ${new Date().getFullYear()} ${e(doc.profile.name)}.</p><a href="#home">Về đầu trang ↑</a></footer></div>`;
}
export function projectMarkup(project, doc, assets, exported = false) {
  return `<div class="portfolio project-page" style="${themeStyle(doc.theme)}"><header class="project-header"><a class="wordmark" href="${exported ? '#home' : '#'}">${e((doc.profile.alias || 'Mabi').toUpperCase())}<span>${star}</span></a><a class="text-link" href="${exported ? '#projects' : '#projects'}">← Trở về portfolio</a></header><main><div class="section-container project-intro"><p class="eyebrow">PROJECT / CASE STUDY</p><h1>${e(project.title)}</h1><p class="project-summary">${e(project.summary)}</p><div class="project-meta"><span>${e(project.role)}</span>${safeUrl(project.url) ? `<a class="text-link" href="${e(safeUrl(project.url))}" target="_blank" rel="noopener noreferrer">Xem dự án ${arrow}</a>` : ''}</div>${assetSrc(assets, project.coverId) ? `<div class="project-hero-image">${image(assets, project.coverId)}</div>` : ''}${blocksMarkup(project.blocks, assets)}</div></main></div>`;
}
export function bindPortfolio(root, assets) {
  const controller = new AbortController(), signal = controller.signal;
  root.addEventListener('click', event => {
    const menu = event.target.closest('.menu-toggle');
    if (menu) { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); root.querySelector('.site-header')?.classList.toggle('menu-open', open); }
    if (event.target.closest('.site-header a')) { root.querySelector('.site-header')?.classList.remove('menu-open'); root.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'false'); }
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      root.querySelectorAll('[data-filter]').forEach(x => { x.classList.toggle('active', x === filter); x.setAttribute('aria-pressed', String(x === filter)); });
      root.querySelectorAll('[data-gallery]').forEach(x => x.hidden = filter.dataset.filter !== 'all' && x.dataset.gallery !== filter.dataset.filter);
    }
    const expand = event.target.closest('[data-lightbox]');
    if (expand && assetSrc(assets, expand.dataset.lightbox)) modal(`<div class="lightbox-image">${image(assets, expand.dataset.lightbox)}</div><p class="lightbox-caption">${e(assets[expand.dataset.lightbox].name)}</p>`, () => {}, true);
  }, { signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { root.querySelector('.site-header')?.classList.remove('menu-open'); root.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'false'); } }, { signal });
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) root.querySelectorAll('[data-nav]').forEach(x => x.classList.toggle('nav-active', x.dataset.nav === entry.target.dataset.section));
  }, { rootMargin: '-15% 0px -55% 0px' });
  root.querySelectorAll('[data-section]').forEach(x => observer.observe(x));
  return () => { controller.abort(); observer.disconnect(); };
}
export function cursorEffect(theme) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover)').matches || (!theme.stars && !theme.mouseGlow)) return () => {};
  const layer = document.createElement('div'); layer.className = 'cursor-layer'; layer.setAttribute('aria-hidden', 'true'); layer.style.cssText = themeStyle(theme);
  const glow = document.createElement('div'); glow.className = 'cursor-glow';
  if (theme.mouseGlow) layer.append(glow);
  document.body.append(layer);
  let last = 0, x = -1000, y = -1000, raf = 0;
  const onMove = event => {
    x = event.clientX; y = event.clientY;
    if (!raf) raf = requestAnimationFrame(() => { glow.style.transform = `translate(${x}px,${y}px)`; raf = 0; });
    if (theme.stars && performance.now() - last > 70 && layer.querySelectorAll('.star-particle').length < 18) {
      last = performance.now();
      const particle = document.createElement('span'); particle.className = 'star-particle'; particle.innerHTML = star;
      particle.style.cssText = `left:${x}px;top:${y}px;--size:${8 + Math.random() * 12}px;--drift:${Math.random() * 60 - 30}px;`;
      layer.append(particle); particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }
    const card = event.target.closest?.('.glass');
    if (card) { const bounds = card.getBoundingClientRect(); card.style.setProperty('--reflection-x', `${x - bounds.left}px`); card.style.setProperty('--reflection-y', `${y - bounds.top}px`); }
  };
  document.addEventListener('pointermove', onMove, { passive: true });
  return () => { document.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); layer.remove(); };
}
