import { escape as e, uid, clone, makeBlock, findGroup, moveItem, mediaInUse } from './model.js';
import { blockMarkup, portfolioMarkup, projectMarkup, bindPortfolio, cursorEffect } from './view.js';
import { star, plus, toast, modal, closeModal, confirmAction, download } from './ui.js';
import { exportPortfolio } from './export.js';

const tabs = [['profile', '01', 'Thông tin cá nhân'], ['blocks', '02', 'Ảnh & bố cục'], ['experience', '03', 'Kinh nghiệm'], ['skills', '04', 'Công cụ'], ['education', '05', 'Học vấn'], ['projects', '06', 'Dự án'], ['sections', '07', 'Các mục trên trang'], ['media', '08', 'Thư viện ảnh / video'], ['theme', '09', 'Màu sắc & hiệu ứng']];
const text = (label, path, value, options = '') => `<label class="field"><span>${label}</span><input data-bind="${path}" value="${e(value)}" ${options}></label>`;
const area = (label, path, value, rows = 4) => `<label class="field"><span>${label}</span><textarea rows="${rows}" data-bind="${path}">${e(value)}</textarea></label>`;
const range = (label, path, value, min, max, step = 1) => `<label class="field range-field"><span>${label}<output>${value}</output></span><input type="range" data-bind="${path}" value="${value}" min="${min}" max="${max}" step="${step}" data-number></label>`;
const check = (label, path, value) => `<label class="check-field"><input type="checkbox" data-bind="${path}" ${value ? 'checked' : ''}><span>${label}</span></label>`;
const select = (label, path, value, items) => `<label class="field"><span>${label}</span><select data-bind="${path}">${items.map(([id, title]) => `<option value="${e(id)}" ${String(id) === String(value) ? 'selected' : ''}>${e(title)}</option>`).join('')}</select></label>`;
const note = message => `<p class="panel-note">${message}</p>`;
const getAt = (obj, path) => path.split('.').reduce((v, key) => v?.[key], obj);
const setAt = (obj, path, value) => { const keys = path.split('.'); const key = keys.pop(); const parent = keys.reduce((v, part) => v[part], obj); parent[key] = value; };

export async function mountEditor(root, backend, options = {}) {
  const [draft, media, published] = await Promise.all([backend.loadDraft(), backend.listMedia(), backend.loadPublished()]);
  const state = { doc: draft.document, revision: draft.revision, media, published, tab: 'profile', groupId: draft.document.galleries[0]?.id, selected: '', dirty: false, busy: false, conflict: false, saving: false, preview: false, previewDevice: 'desktop', previewProject: '', undo: [], redo: [], search: '', version: 0 };
  const controller = new AbortController(), signal = controller.signal;
  let timer, mediaTimer, disposed = false, savePromise, previewCleanup;
  const assetMap = () => Object.fromEntries(state.media.map(x => [x.id, x]));
  const group = () => findGroup(state.doc, state.groupId);
  const selected = () => group()?.blocks.find(x => x.id === state.selected);
  const record = () => { state.undo.push(clone(state.doc)); if (state.undo.length > 40) state.undo.shift(); state.redo = []; };
  function change(fn, render = true) { if (state.busy || state.conflict) return; record(); fn(); state.dirty = true; state.version++; scheduleSave(); if (render) draw(); else updateStatus(); }
  function scheduleSave() { clearTimeout(timer); if (!state.conflict) timer = setTimeout(() => save().catch(error => toast(error.message, true)), 1800); }
  function updateStatus() {
    const label = root.querySelector('[data-save-status]');
    if (label) { label.textContent = state.conflict ? 'Có bản nháp mới ở cửa sổ khác' : state.saving ? 'Đang lưu…' : state.dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu bản nháp'; label.classList.toggle('unsaved', state.dirty || state.conflict); }
    root.querySelector('[data-action="undo"]')?.toggleAttribute('disabled', !state.undo.length || state.busy);
    root.querySelector('[data-action="redo"]')?.toggleAttribute('disabled', !state.redo.length || state.busy);
  }
  async function save() {
    clearTimeout(timer);
    if (savePromise) { await savePromise; if (state.dirty) return save(); return; }
    if (state.conflict) throw new Error('Tải bản nháp mới trước khi tiếp tục lưu. Bạn có thể tải bản sao nội dung hiện tại để giữ lại thay đổi.');
    if (!state.dirty && state.revision > 0) return;
    const version = state.version, document = clone(state.doc);
    state.saving = true; updateStatus();
    savePromise = backend.saveDraft(document, state.revision).then(revision => {
      state.revision = revision;
      if (version === state.version) state.dirty = false;
    }).catch(error => { if (/cửa sổ khác/.test(error.message)) state.conflict = true; throw error; }).finally(() => { savePromise = null; state.saving = false; updateStatus(); });
    return savePromise;
  }
  function entryActions(key, index, extra = '') {
    return `<div class="entry-actions">${extra}<button class="small-button" data-action="entry-up" data-key="${key}" data-index="${index}" aria-label="Chuyển lên" ${index === 0 ? 'disabled' : ''}>↑</button><button class="small-button" data-action="entry-down" data-key="${key}" data-index="${index}" aria-label="Chuyển xuống" ${index === state.doc[key].length - 1 ? 'disabled' : ''}>↓</button><button class="small-button remove" data-action="entry-remove" data-key="${key}" data-index="${index}">Xoá mục</button></div>`;
  }
  function profilePanel() {
    const p = state.doc.profile, portrait = state.media.find(x => x.id === p.portraitId);
    return `<div class="panel-heading"><p>PROFILE / INTRODUCTION</p><h1>Giới thiệu chính mình.</h1><span>Tên, lời giới thiệu và thông tin liên hệ của portfolio.</span></div><div class="form-grid"><section class="editor-card"><h2>Trang mở đầu</h2>${text('Tên hiển thị', 'profile.name', p.name)}${text('Tên ngắn / nghệ danh', 'profile.alias', p.alias)}${text('Dòng nhãn nhỏ', 'profile.eyebrow', p.eyebrow)}${area('Tiêu đề lớn (Enter để xuống dòng)', 'profile.headline', p.headline, 2)}${area('Giới thiệu ngắn trên trang đầu', 'profile.subtitle', p.subtitle, 3)}${text('Vai trò / chuyên môn', 'profile.role', p.role)}${area('Giới thiệu bản thân', 'profile.intro', p.intro, 5)}</section><div><section class="editor-card"><h2>Ảnh cá nhân</h2><div class="portrait-upload">${portrait ? `<img src="${e(portrait.url)}" alt="Ảnh cá nhân">` : `<span>${star}</span><p>Thêm ảnh PNG hoặc WebP tách nền.</p>`}</div><div class="row-actions"><button class="button primary" data-action="choose-portrait">${portrait ? 'Đổi ảnh' : 'Chọn ảnh'}</button>${portrait ? '<button class="button quiet" data-action="remove-portrait">Gỡ khỏi trang</button>' : ''}</div>${portrait ? `${range('Kích thước', 'profile.portrait.scale', p.portrait.scale, .2, 2.5, .05)}${range('Vị trí ngang', 'profile.portrait.x', p.portrait.x, -150, 150)}${range('Vị trí dọc', 'profile.portrait.y', p.portrait.y, -150, 150)}${range('Góc xoay', 'profile.portrait.rotation', p.portrait.rotation, -30, 30)}${range('Độ rõ', 'profile.portrait.opacity', p.portrait.opacity, .1, 1, .05)}${check('Lật ảnh', 'profile.portrait.flip', p.portrait.flip)}${check('Bóng đổ', 'profile.portrait.shadow', p.portrait.shadow)}${check('Ánh sáng phía sau', 'profile.portrait.glow', p.portrait.glow)}${check('Lớp ánh sáng phía trước', 'profile.portrait.depth', p.portrait.depth)}` : ''}</section><section class="editor-card"><h2>Liên hệ</h2>${text('Email liên hệ công khai', 'profile.email', p.email, 'type="email"')}${text('Số điện thoại', 'profile.phone', p.phone, 'type="tel"')}${text('Địa điểm', 'profile.location', p.location)}${p.socials.map((x, i) => `<div class="social-form">${text('Tên liên kết', `profile.socials.${i}.label`, x.label)}${text('Địa chỉ liên kết', `profile.socials.${i}.url`, x.url, 'type="url"')}<button class="small-button remove" data-action="social-remove" data-index="${i}">Gỡ</button></div>`).join('')}<button class="button quiet" data-action="add-social">${plus} Thêm liên kết</button></section></div></div>`;
  }
  function entriesPanel(key) {
    const names = { experience: ['EXPERIENCE', 'Hành trình làm việc.', 'Thêm kinh nghiệm'], skills: ['TOOLS & SKILLS', 'Bộ công cụ của bạn.', 'Thêm công cụ'], education: ['EDUCATION', 'Những nơi bạn học hỏi.', 'Thêm học vấn'], projects: ['PROJECTS / CASE STUDIES', 'Kể câu chuyện của dự án.', 'Thêm dự án'] };
    const [label, title, add] = names[key];
    return `<div class="panel-heading"><p>${label}</p><h1>${title}</h1><span>Nội dung để trống sẽ không được tự điền thông tin.</span></div><div class="entry-list">${state.doc[key].map((x, i) => {
      const prefix = `${key}.${i}`;
      let fields = '';
      if (key === 'experience') fields = `${text('Tên công ty / thương hiệu', `${prefix}.company`, x.company)}${text('Vị trí / vai trò', `${prefix}.role`, x.role)}${text('Thời gian', `${prefix}.period`, x.period)}${area('Công việc, trách nhiệm và kết quả', `${prefix}.description`, x.description, 5)}${select('Dự án liên quan', `${prefix}.projectId`, x.projectId, [['', 'Không gắn dự án'], ...state.doc.projects.map(p => [p.id, p.title])])}`;
      if (key === 'skills') fields = `${text('Tên công cụ', `${prefix}.name`, x.name)}${text('Nhóm công cụ', `${prefix}.category`, x.category)}${select('Mức sử dụng', `${prefix}.level`, x.level, [['Sử dụng thường xuyên', 'Sử dụng thường xuyên'], ['Có kinh nghiệm sử dụng', 'Có kinh nghiệm sử dụng'], ['Đang học', 'Đang học']])}${area('Mô tả ngắn', `${prefix}.description`, x.description, 2)}`;
      if (key === 'education') fields = `${text('Trường / đơn vị đào tạo', `${prefix}.school`, x.school)}${text('Ngành / chương trình', `${prefix}.program`, x.program)}${text('Thời gian', `${prefix}.period`, x.period)}${area('Ghi chú, học bổng, chứng chỉ', `${prefix}.note`, x.note, 3)}`;
      if (key === 'projects') fields = `${text('Tên dự án', `${prefix}.title`, x.title)}${text('Vai trò của bạn', `${prefix}.role`, x.role)}${area('Giới thiệu dự án', `${prefix}.summary`, x.summary, 3)}${text('Link dự án (nếu có)', `${prefix}.url`, x.url, 'type="url"')}<div class="project-cover-editor">${x.coverId && assetMap()[x.coverId] ? `<img src="${e(assetMap()[x.coverId].url)}" alt="Ảnh bìa">` : `<span>${star}</span>`}<button class="button quiet" data-action="project-cover" data-index="${i}">Chọn ảnh bìa</button>${x.coverId ? `<button class="small-button" data-action="project-cover-remove" data-index="${i}">Gỡ ảnh</button>` : ''}</div><button class="button primary" data-action="project-blocks" data-id="${x.id}">Thiết kế nội dung dự án →</button>`;
      return `<section class="editor-card entry-card"><div class="entry-number">${String(i + 1).padStart(2, '0')}</div>${fields}${entryActions(key, i)}</section>`;
    }).join('')}${!state.doc[key].length ? `<div class="editor-empty">${star}<h2>Chưa có nội dung.</h2><p>Thêm mục đầu tiên khi bạn sẵn sàng.</p></div>` : ''}</div><button class="button primary add-entry" data-action="add-entry" data-key="${key}">${plus} ${add}</button>`;
  }
  function sectionsPanel() {
    return `<div class="panel-heading"><p>PAGE / SECTIONS</p><h1>Sắp xếp không gian của bạn.</h1><span>Đổi tên, ẩn mục, sắp xếp thứ tự hoặc thêm mục nội dung tự do.</span></div><div class="entry-list section-editor-list">${state.doc.layout.map((x, i) => `<section class="editor-card section-row"><span class="section-order">${String(i + 1).padStart(2, '0')}</span><div>${text('Tiêu đề', `layout.${i}.title`, x.title)}${text('Nhãn nhỏ', `layout.${i}.kicker`, x.kicker)}${check('Hiển thị trên portfolio', `layout.${i}.visible`, x.visible)}</div><div>${entryActions('layout', i, state.doc.custom.some(c => c.id === x.id) ? `<button class="small-button" data-action="project-blocks" data-id="${x.id}">Sửa nội dung</button>` : '')}</div></section>`).join('')}</div><button class="button primary" data-action="add-section">${plus} Thêm mục tự do</button>`;
  }
  function blockInspector() {
    const b = selected();
    if (!b) return `<div class="inspector-empty">${star}<p>Chọn một ô để chỉnh nội dung, kích thước và phong cách.</p></div>`;
    const g = group(), rootKey = state.doc.galleries.includes(g) ? 'galleries' : state.doc.projects.includes(g) ? 'projects' : 'custom';
    const prefix = `${rootKey}.${state.doc[rootKey].indexOf(g)}.blocks.${g.blocks.indexOf(b)}`;
    let fields = `<h2>Chỉnh ô ${b.type === 'image' ? 'ảnh' : b.type === 'video' ? 'video' : b.type === 'heading' ? 'tiêu đề' : b.type === 'button' ? 'nút' : 'văn bản'}</h2>`;
    if (b.type === 'text' || b.type === 'heading') fields += `${area('Nội dung', `${prefix}.text`, b.text, 5)}${b.type === 'heading' ? select('Cấp tiêu đề', `${prefix}.level`, b.level, [[1, 'H1 — Tiêu đề lớn'], [2, 'H2 — Tiêu đề mục'], [3, 'H3 — Tiêu đề nhỏ']]) : ''}${select('Font', `${prefix}.style.font`, b.style.font, [['sans', 'Hiện đại'], ['serif', 'Có chân'], ['mono', 'Monospace']])}${range('Cỡ chữ', `${prefix}.style.size`, b.style.size, 12, 120)}${select('Độ đậm', `${prefix}.style.weight`, b.style.weight, [[300, 'Mảnh'], [400, 'Thường'], [500, 'Vừa'], [600, 'Đậm vừa'], [700, 'Đậm'], [800, 'Rất đậm']])}${range('Giãn dòng', `${prefix}.style.lineHeight`, b.style.lineHeight, .9, 2.5, .1)}${select('Căn chữ', `${prefix}.style.align`, b.style.align, [['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']])}${text('Màu chữ', `${prefix}.style.color`, b.style.color, 'type="color"')}${text('Màu gradient (để trống nếu không dùng)', `${prefix}.style.gradient`, b.style.gradient, 'placeholder="#175dff"')}`;
    if (b.type === 'image' || b.type === 'video') fields += `<button class="button quiet" data-action="block-media">Đổi ${b.type === 'video' ? 'video' : 'ảnh'}</button>${area('Chú thích / nội dung thay thế', `${prefix}.caption`, b.caption, 2)}${select('Cách hiển thị', `${prefix}.style.fit`, b.style.fit, [['cover', 'Lấp đầy ô / crop'], ['contain', 'Giữ toàn bộ ảnh']])}${range('Crop ngang (%)', `${prefix}.style.x`, b.style.x, 0, 100)}${range('Crop dọc (%)', `${prefix}.style.y`, b.style.y, 0, 100)}${range('Bo góc', `${prefix}.style.radius`, b.style.radius, 0, 80)}<label class="field"><span>Tỷ lệ nhanh</span><select data-ratio><option value="">Tự điều chỉnh</option><option value="1:1">1:1 — Vuông</option><option value="2:1">2:1 — Ngang</option><option value="1:2">1:2 — Dọc</option><option value="2:2">2:2 — Vuông lớn</option></select></label>`;
    if (b.type === 'button') fields += `${text('Tên nút', `${prefix}.label`, b.label)}${text('Liên kết (https://… hoặc #works)', `${prefix}.url`, b.url)}`;
    fields += `${range('Chiều rộng (số cột)', `${prefix}.style.span`, b.style.span, 1, 4)}${range('Chiều cao (px)', `${prefix}.style.height`, b.style.height, 60, 1000, 10)}${range('Độ rõ', `${prefix}.style.opacity`, b.style.opacity, .1, 1, .05)}<div class="row-actions"><button class="small-button" data-action="block-up">↑ Lên</button><button class="small-button" data-action="block-down">↓ Xuống</button><button class="small-button" data-action="block-duplicate">Nhân đôi</button><button class="small-button remove" data-action="block-remove">Gỡ ô</button></div>`;
    return fields;
  }
  function blocksCanvas() {
    const g = group();
    if (!g) return '<div class="editor-empty"><p>Thêm một nhóm sản phẩm để bắt đầu.</p></div>';
    return `<div class="edit-block-grid">${g.blocks.map(b => `<div class="editable-block ${state.selected === b.id ? 'selected' : ''}" style="--span:${b.style.span}" data-select-block="${b.id}"><div class="block-edit-bar"><button draggable="true" data-drag="${b.id}" class="drag-handle" aria-label="Kéo để đổi thứ tự">⠿</button><span>${b.type === 'heading' ? 'Tiêu đề' : b.type === 'text' ? 'Văn bản' : b.type === 'image' ? 'Ảnh' : b.type === 'video' ? 'Video' : 'Nút'}</span><button class="block-small-delete" data-action="quick-remove" data-id="${b.id}" aria-label="Gỡ ô">×</button></div>${blockMarkup(b, assetMap())}<button class="resize-handle" data-resize="${b.id}" aria-label="Kéo để đổi kích thước">⌟</button></div>`).join('')}</div>${!g.blocks.length ? `<div class="block-drop-zone"><span>${plus}</span><h3>Thả ảnh vào đây.</h3><p>Hoặc dùng các nút phía trên để thêm ảnh, chữ và tiêu đề.</p><button class="button primary" data-action="add-image">Chọn ảnh / video</button></div>` : ''}`;
  }
  function blocksPanel() {
    const g = group(), groups = [...state.doc.galleries, ...state.doc.custom, ...state.doc.projects];
    const rootKey = state.doc.galleries.includes(g) ? 'galleries' : state.doc.projects.includes(g) ? 'projects' : 'custom';
    return `<div class="panel-heading"><p>CONTENT / FREE GRID</p><h1>Để tác phẩm lên tiếng.</h1><span>Kéo ⠿ để đổi thứ tự. Kéo góc dưới để thay kích thước ô.</span></div><div class="group-controls"><label class="field"><span>Nhóm / trang đang chỉnh</span><select data-group>${groups.map(x => `<option value="${x.id}" ${x.id === state.groupId ? 'selected' : ''}>${e(x.title)}${state.doc.projects.includes(x) ? ' / Dự án' : ''}</option>`).join('')}</select></label><button class="button quiet" data-action="add-gallery">${plus} Thêm nhóm</button>${g && state.doc.galleries.includes(g) ? '<button class="small-button remove" data-action="remove-gallery">Gỡ nhóm</button>' : ''}</div>${g ? text('Tên nhóm / dự án', `${rootKey}.${state.doc[rootKey].indexOf(g)}.title`, g.title) : ''}<div class="block-toolbar"><button class="button primary" data-action="add-image">${plus} Ảnh / video</button><button class="button quiet" data-action="add-block" data-type="heading">Tiêu đề</button><button class="button quiet" data-action="add-block" data-type="text">Văn bản</button><button class="button quiet" data-action="add-block" data-type="button">Nút liên kết</button></div><div class="builder-layout"><div class="builder-canvas" data-canvas>${blocksCanvas()}</div><aside class="block-inspector editor-card" data-inspector>${blockInspector()}</aside></div>`;
  }
  function mediaMarkup(choosing = false, kind = '') {
    const items = state.media.filter(x => x.name.toLowerCase().includes(state.search.toLowerCase()) && (!kind || x.mime_type.startsWith(kind)));
    return `<div class="media-grid">${items.map(x => `<article class="media-card"><button class="media-thumb" data-action="${choosing ? 'pick-media' : 'inspect-media'}" data-id="${x.id}" aria-label="${choosing ? 'Chọn' : 'Quản lý'} ${e(x.name)}">${x.mime_type.startsWith('video/') ? `<video src="${e(x.url)}" preload="metadata" muted></video><span class="video-label">VIDEO</span>` : `<img src="${e(x.url)}" alt="${e(x.name)}" loading="lazy">`}</button><span class="media-name" title="${e(x.name)}">${e(x.name)}</span><span class="media-size">${(x.size / 1024 / 1024).toFixed(1)} MB${x.width ? ' · ' + x.width + ' × ' + x.height : ''}</span>${choosing ? '' : `<button class="small-button" data-action="inspect-media" data-id="${x.id}">Quản lý tệp</button>`}</article>`).join('')}</div>${items.length ? '' : '<div class="media-empty">Chưa có tệp phù hợp. Tải ảnh hoặc video lên để bắt đầu.</div>'}`;
  }
  function mediaPanel() {
    return `<div class="panel-heading"><p>MEDIA / LIBRARY</p><h1>Mọi tác phẩm, cùng một nơi.</h1><span>Một ảnh có thể dùng ở nhiều vị trí. Gỡ khỏi trang giữ nguyên tệp trong thư viện.</span></div><div class="media-tools"><input class="search-input" placeholder="Tìm tên ảnh / video…" aria-label="Tìm tệp" data-search value="${e(state.search)}"><label class="button primary upload-label">${plus} Tải lên<input type="file" data-upload multiple accept="image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4,video/webm" hidden></label></div>${note('Ảnh tối đa 15 MB; video tối đa 40 MB. Kho ảnh chưa xuất bản chỉ chủ sở hữu truy cập được.')}<div data-media-results>${mediaMarkup()}</div>`;
  }
  function themePanel() {
    const t = state.doc.theme;
    return `<div class="panel-heading"><p>APPEARANCE / LIQUID GLASS</p><h1>Màu sắc mang dấu ấn riêng.</h1><span>Điều chỉnh màu, chất kính và ánh sáng. Xem trước để kiểm tra kết quả.</span></div><div class="form-grid"><section class="editor-card"><h2>Bảng màu</h2>${text('Màu chủ đạo', 'theme.primary', t.primary, 'type="color"')}${text('Màu phụ', 'theme.secondary', t.secondary, 'type="color"')}${text('Nền', 'theme.background', t.background, 'type="color"')}${text('Màu chữ chính', 'theme.text', t.text, 'type="color"')}<div class="theme-swatch" style="background:${e(t.primary)}">MABI ${star}</div></section><section class="editor-card"><h2>Kính & ánh sáng</h2>${range('Độ rõ lớp kính', 'theme.glassOpacity', t.glassOpacity, .05, .95, .05)}${range('Độ mờ nền (blur)', 'theme.blur', t.blur, 0, 60)}${range('Độ dày viền', 'theme.border', t.border, 0, 4, .5)}${range('Cường độ ánh sáng', 'theme.glowIntensity', t.glowIntensity, 0, 1, .05)}${check('Tinh tú 4 cánh theo chuột', 'theme.stars', t.stars)}${check('Vùng sáng theo chuột', 'theme.mouseGlow', t.mouseGlow)}${note('Hiệu ứng tự giảm trên thiết bị cảm ứng và khi người xem bật chế độ giảm chuyển động.')}</section></div>`;
  }
  function draw() {
    if (disposed) return;
    previewCleanup?.(); previewCleanup = null;
    if (state.preview) { drawPreview(); return; }
    const panel = state.tab === 'profile' ? profilePanel() : state.tab === 'blocks' ? blocksPanel() : state.tab === 'sections' ? sectionsPanel() : state.tab === 'media' ? mediaPanel() : state.tab === 'theme' ? themePanel() : entriesPanel(state.tab);
    root.innerHTML = `<div class="editor-shell"><aside class="editor-sidebar"><a class="editor-brand" href="#home">${star}<span>MABI<span>PORTFOLIO EDITOR</span></span></a><div class="owner-badge"><span class="owner-dot"></span> Không gian riêng của bạn</div><nav aria-label="Công cụ chỉnh sửa">${tabs.map(([id, index, label]) => `<button class="editor-tab ${id === state.tab ? 'active' : ''}" data-tab="${id}"><span>${index}</span>${label}</button>`).join('')}</nav><div class="sidebar-bottom"><a href="${e(location.pathname)}" target="_blank" rel="noopener noreferrer">Mở trang công khai ↗</a><button data-action="export-draft">Tải bản sao nội dung</button><button data-action="reload">Tải bản nháp mới</button><button data-action="logout">Đăng xuất</button></div></aside><div class="editor-workspace"><header class="editor-topbar"><span data-save-status></span><div class="editor-top-actions"><button class="small-button" data-action="undo" aria-label="Hoàn tác">↶</button><button class="small-button" data-action="redo" aria-label="Làm lại">↷</button><button class="button quiet" data-action="save">Lưu nháp</button><button class="button quiet" data-action="preview">Xem trước</button><button class="button primary" data-action="publish">Xuất bản ${star}</button></div></header>${state.conflict ? '<div class="conflict-banner">Có thay đổi ở cửa sổ khác. Tải bản sao nội dung đang sửa, rồi tải bản nháp mới để tiếp tục.</div>' : ''}<main class="editor-main" ${state.busy || state.conflict ? 'inert' : ''}>${panel}</main><footer class="editor-footer"><span>${state.published ? 'Bản công khai: ' + new Date(state.published.publishedAt).toLocaleString('vi-VN') : 'Chưa có phiên bản xuất bản'}</span><div><button data-action="copy-link" ${state.published ? '' : 'disabled'}>Sao chép link chia sẻ ↗</button><button data-action="export-html" ${state.published ? '' : 'disabled'}>Xuất bản HTML để gửi</button></div></footer></div></div>`;
    root.querySelectorAll('[data-action="publish"],[data-action="save"],[data-action="logout"],[data-action="reload"]').forEach(x => x.disabled = state.busy);
    updateStatus();
  }
  function updateCanvas() { const canvas = root.querySelector('[data-canvas]'); if (canvas) canvas.innerHTML = blocksCanvas(); }
  function drawPreview() {
    root.innerHTML = `<div class="editor-preview"><header class="preview-toolbar"><button class="button quiet" data-action="end-preview">← Tiếp tục chỉnh sửa</button><div class="preview-devices">${[['desktop', 'Máy tính'], ['tablet', 'Máy tính bảng'], ['mobile', 'Điện thoại']].map(([id, label]) => `<button data-device="${id}" class="${state.previewDevice === id ? 'active' : ''}">${label}</button>`).join('')}</div><span>BẢN NHÁP / CHỈ BẠN XEM</span></header><div class="preview-stage"><div class="preview-viewport preview-${state.previewDevice}" data-preview-page></div></div></div>`;
    const target = root.querySelector('[data-preview-page]');
    const p = state.doc.projects.find(x => x.id === state.previewProject);
    target.innerHTML = p ? projectMarkup(p, state.doc, assetMap()) : portfolioMarkup(state.doc, assetMap());
    const disposeView = bindPortfolio(target, assetMap()), disposeCursor = cursorEffect(state.doc.theme);
    previewCleanup = () => { disposeView(); disposeCursor(); };
    target.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      event.preventDefault();
      if (link.hash.startsWith('#/project/')) { state.previewProject = link.hash.slice(10); draw(); }
      else if (state.previewProject) { state.previewProject = ''; draw(); root.querySelector('[data-preview-page] ' + (link.hash || '#home'))?.scrollIntoView(); }
      else { try { target.querySelector(link.hash || '#home')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { /* Ignore malformed anchors. */ } }
    });
  }
  async function uploadFiles(files, addToGroup = false, replace) {
    if (state.busy || state.conflict) return;
    state.busy = true; draw();
    const added = [];
    try {
      for (const file of files) {
        toast('Đang tải ' + file.name + '…');
        const item = await backend.upload(file, replace); added.push(item);
        state.media = [item, ...state.media.filter(x => x.id !== item.id)];
      }
      if (addToGroup && group()) { record(); for (const item of added) { const b = makeBlock(item.mime_type.startsWith('video/') ? 'video' : 'image'); b.mediaId = item.id; group().blocks.push(b); state.selected = b.id; } state.dirty = true; state.version++; scheduleSave(); }
      toast('Đã tải ' + added.length + ' tệp vào thư viện.');
    } finally { state.busy = false; draw(); }
  }
  function mediaPicker(callback, kind = '') {
    state.search = '';
    const content = `<h2>Chọn ảnh / video</h2><div class="media-tools"><input class="search-input" data-picker-search placeholder="Tìm tệp…" aria-label="Tìm tệp"><label class="button primary upload-label">Tải lên<input type="file" data-picker-upload multiple accept="${kind === 'image/' ? 'image/png,image/jpeg,image/webp,image/avif,image/gif' : 'image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4,video/webm'}" hidden></label></div><div data-picker-items>${mediaMarkup(true, kind)}</div>`;
    modal(content, modalRoot => {
      modalRoot.querySelector('[data-picker-search]').oninput = event => { state.search = event.target.value; modalRoot.querySelector('[data-picker-items]').innerHTML = mediaMarkup(true, kind); };
      modalRoot.querySelector('[data-picker-upload]').onchange = async event => {
        const input = event.target; input.disabled = true;
        try { await uploadFiles([...input.files]); modalRoot.querySelector('[data-picker-items]').innerHTML = mediaMarkup(true, kind); }
        catch (error) { toast(error.message, true); } finally { input.disabled = false; input.value = ''; }
      };
      modalRoot.addEventListener('click', event => { const pick = event.target.closest('[data-action="pick-media"]'); if (pick) { const item = state.media.find(x => x.id === pick.dataset.id); callback(item); closeModal(); } });
    }, true);
  }
  function inspectMedia(item) {
    modal(`<h2>Quản lý tệp</h2><div class="media-inspect-preview">${item.mime_type.startsWith('video/') ? `<video src="${e(item.url)}" controls></video>` : `<img src="${e(item.url)}" alt="${e(item.name)}">`}</div><label class="field"><span>Tên tệp</span><input data-media-name value="${e(item.name)}"></label><div class="row-actions"><button class="button primary" data-rename>Lưu tên</button><label class="button quiet upload-label">Thay tệp<input type="file" data-replace hidden accept="image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4,video/webm"></label><button class="button danger" data-delete>Xoá vĩnh viễn</button></div>${note('Thay tệp chỉ cập nhật bản nháp. Người xem thấy ảnh cũ cho đến khi bạn xuất bản lại.')}`, modalRoot => {
      modalRoot.querySelector('[data-rename]').onclick = async event => {
        const name = modalRoot.querySelector('[data-media-name]').value.trim();
        if (!name) return toast('Nhập tên tệp.', true);
        event.target.disabled = true;
        try { await backend.renameMedia(item.id, name); item.name = name; draw(); toast('Đã đổi tên tệp.'); closeModal(); } catch (error) { toast(error.message, true); event.target.disabled = false; }
      };
      modalRoot.querySelector('[data-replace]').onchange = async event => { try { await uploadFiles([...event.target.files], false, item); closeModal(); } catch (error) { toast(error.message, true); } };
      modalRoot.querySelector('[data-delete]').onclick = () => {
        if (mediaInUse(item.id, state.doc, state.published)) return toast('Tệp đang được sử dụng. Gỡ khỏi trang và xuất bản lại trước khi xoá vĩnh viễn.', true);
        confirmAction('Xoá vĩnh viễn tệp?', 'Tệp ' + item.name + ' sẽ bị xoá khỏi thư viện và kho ảnh.', async () => {
          await save(); await backend.deleteMedia(item); state.media = state.media.filter(x => x.id !== item.id); draw(); toast('Đã xoá tệp.');
        });
      };
    });
  }
  async function action(name, button) {
    const index = Number(button.dataset.index), key = button.dataset.key;
    if (name === 'save') { await save(); toast('Đã lưu bản nháp.'); }
    if (name === 'preview') { state.preview = true; state.previewProject = ''; draw(); }
    if (name === 'end-preview') { state.preview = false; draw(); }
    if (name === 'undo' && state.undo.length && !state.busy && !state.conflict) { state.redo.push(clone(state.doc)); state.doc = state.undo.pop(); state.dirty = true; state.version++; scheduleSave(); draw(); }
    if (name === 'redo' && state.redo.length && !state.busy && !state.conflict) { state.undo.push(clone(state.doc)); state.doc = state.redo.pop(); state.dirty = true; state.version++; scheduleSave(); draw(); }
    if (name === 'choose-portrait') mediaPicker(item => change(() => state.doc.profile.portraitId = item.id), 'image/');
    if (name === 'remove-portrait') change(() => state.doc.profile.portraitId = '');
    if (name === 'add-social') change(() => state.doc.profile.socials.push({ label: '', url: '' }));
    if (name === 'social-remove') change(() => state.doc.profile.socials.splice(index, 1));
    if (name === 'add-entry') change(() => state.doc[key].push(key === 'experience' ? { id: uid(), company: '', role: '', period: '', description: '', projectId: '' } : key === 'skills' ? { id: uid(), name: '', category: '', level: 'Đang học', description: '' } : key === 'education' ? { id: uid(), school: '', program: '', period: '', note: '' } : { id: uid(), title: 'Dự án mới', summary: '', role: '', coverId: '', url: '', blocks: [] }));
    if (name === 'entry-up' || name === 'entry-down') change(() => moveItem(state.doc[key], index, index + (name === 'entry-up' ? -1 : 1)));
    if (name === 'entry-remove') {
      if (key === 'layout' && !state.doc.custom.some(x => x.id === state.doc.layout[index].id)) { change(() => state.doc.layout[index].visible = false); return; }
      confirmAction('Gỡ mục này?', 'Nội dung của mục sẽ được gỡ khỏi bản nháp. Bạn có thể hoàn tác sau khi gỡ.', () => change(() => {
        if (key === 'layout') state.doc.custom = state.doc.custom.filter(x => x.id !== state.doc.layout[index].id);
        if (key === 'projects') state.doc.experience.forEach(x => { if (x.projectId === state.doc.projects[index].id) x.projectId = ''; });
        state.doc[key].splice(index, 1);
      }), 'Gỡ mục');
    }
    if (name === 'project-cover') mediaPicker(item => change(() => state.doc.projects[index].coverId = item.id), 'image/');
    if (name === 'project-cover-remove') change(() => state.doc.projects[index].coverId = '');
    if (name === 'project-blocks') { state.groupId = button.dataset.id; state.tab = 'blocks'; state.selected = ''; draw(); }
    if (name === 'add-gallery') change(() => { const g = { id: uid(), title: 'Nhóm sản phẩm mới', blocks: [] }; state.doc.galleries.push(g); state.groupId = g.id; state.selected = ''; });
    if (name === 'remove-gallery') confirmAction('Gỡ nhóm sản phẩm?', 'Các ô trong nhóm được gỡ khỏi bản nháp; tệp ảnh vẫn ở thư viện.', () => change(() => { state.doc.galleries = state.doc.galleries.filter(x => x.id !== state.groupId); state.groupId = state.doc.galleries[0]?.id; state.selected = ''; }), 'Gỡ nhóm');
    if (name === 'add-section') change(() => { const id = uid(); state.doc.custom.push({ id, title: 'Mục mới', blocks: [] }); state.doc.layout.splice(Math.max(0, state.doc.layout.findIndex(x => x.id === 'contact')), 0, { id, title: 'Mục mới', kicker: 'CREATIVE / NEW SECTION', visible: true }); });
    if (name === 'add-block' && group()) change(() => { const b = makeBlock(button.dataset.type); group().blocks.push(b); state.selected = b.id; });
    if (name === 'add-image' && group()) mediaPicker(item => change(() => { const b = makeBlock(item.mime_type.startsWith('video/') ? 'video' : 'image'); b.mediaId = item.id; group().blocks.push(b); state.selected = b.id; }));
    if (name === 'block-media' && selected()) mediaPicker(item => change(() => { selected().mediaId = item.id; selected().type = item.mime_type.startsWith('video/') ? 'video' : 'image'; }));
    if ((name === 'block-remove' || name === 'quick-remove') && group()) change(() => { group().blocks = group().blocks.filter(x => x.id !== (button.dataset.id || state.selected)); state.selected = ''; });
    if (name === 'block-duplicate' && selected()) change(() => { const b = clone(selected()); b.id = uid(); group().blocks.splice(group().blocks.indexOf(selected()) + 1, 0, b); state.selected = b.id; });
    if ((name === 'block-up' || name === 'block-down') && selected()) change(() => { const i = group().blocks.indexOf(selected()); moveItem(group().blocks, i, i + (name === 'block-up' ? -1 : 1)); });
    if (name === 'inspect-media') inspectMedia(state.media.find(x => x.id === button.dataset.id));
    if (name === 'export-draft') download(new Blob([JSON.stringify(state.doc, null, 2)], { type: 'application/json' }), 'mabi-ban-sao-noi-dung.json');
    if (name === 'reload') confirmAction('Tải bản nháp mới?', 'Nội dung chưa lưu ở cửa sổ này sẽ được thay bằng bản nháp đã lưu. Bạn có thể tải bản sao trước khi tiếp tục.', async () => { const latest = await backend.loadDraft(); state.doc = latest.document; state.revision = latest.revision; state.dirty = false; state.conflict = false; state.undo = []; state.redo = []; state.media = await backend.listMedia(); draw(); }, 'Tải bản nháp');
    if (name === 'logout') { try { if (!state.conflict) await save(); } catch (error) { toast(error.message, true); } state.busy = true; draw(); try { await backend.logout(); options.onLogout?.(); } finally { state.busy = false; } }
    if (name === 'copy-link') {
      const url = location.origin + location.pathname;
      try { await navigator.clipboard.writeText(url); toast('Đã sao chép link công khai. Người xem chỉ có thể xem.'); } catch { modal(`<h2>Link chia sẻ</h2><label class="field"><input value="${e(url)}" readonly aria-label="Link chia sẻ"></label>`, m => { m.querySelector('input').select(); }); }
    }
    if (name === 'publish' && !state.conflict) {
      state.busy = true; draw();
      try { await save(); state.published = await backend.publish(clone(state.doc), state.revision, state.media, message => toast(message + '…')); toast('Đã xuất bản. Link chia sẻ hiển thị phiên bản mới.'); }
      finally { state.busy = false; draw(); }
    }
    if (name === 'export-html') { if (!state.published) return; state.busy = true; draw(); try { await exportPortfolio(state.published, message => toast(message)); toast('Đã tải bản HTML chỉ để xem.'); } finally { state.busy = false; draw(); } }
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button && !button.disabled) { event.preventDefault(); action(button.dataset.action, button).catch(error => { toast(error.message, true); draw(); }); return; }
    const tab = event.target.closest('[data-tab]');
    if (tab) { state.tab = tab.dataset.tab; state.selected = ''; draw(); return; }
    const device = event.target.closest('[data-device]');
    if (device) { state.previewDevice = device.dataset.device; draw(); return; }
    const block = event.target.closest('[data-select-block]');
    if (block && !event.target.closest('[data-resize]')) { event.preventDefault(); state.selected = block.dataset.selectBlock; draw(); }
  }, { signal });
  root.addEventListener('input', event => {
    const input = event.target;
    if (input.dataset.bind) {
      const previous = getAt(state.doc, input.dataset.bind);
      const value = input.type === 'checkbox' ? input.checked : input.dataset.number !== undefined || typeof previous === 'number' ? Number(input.value) : input.value;
      change(() => setAt(state.doc, input.dataset.bind, value), false);
      input.closest('.range-field')?.querySelector('output')?.replaceChildren(String(value));
      if (state.tab === 'blocks') updateCanvas();
      if (state.tab === 'theme') { const swatch = root.querySelector('.theme-swatch'); if (swatch) swatch.style.background = state.doc.theme.primary; }
    }
    if (input.hasAttribute('data-search')) { state.search = input.value; root.querySelector('[data-media-results]').innerHTML = mediaMarkup(); }
  }, { signal });
  root.addEventListener('change', event => {
    const input = event.target;
    if (input.hasAttribute('data-group')) { state.groupId = input.value; state.selected = ''; draw(); }
    if (input.hasAttribute('data-ratio') && input.value && selected()) change(() => { const [w, h] = input.value.split(':').map(Number); selected().style.span = w; selected().style.height = Math.round((root.querySelector('[data-canvas]').clientWidth - 54) / 4 * h); });
    if (input.hasAttribute('data-upload')) uploadFiles([...input.files]).catch(error => toast(error.message, true));
  }, { signal });
  let dragId;
  root.addEventListener('dragstart', event => { const handle = event.target.closest('[data-drag]'); if (!handle) return; dragId = handle.dataset.drag; event.dataTransfer.setData('text/plain', dragId); event.dataTransfer.effectAllowed = 'move'; }, { signal });
  root.addEventListener('dragover', event => { if (event.target.closest('[data-canvas]') || (state.tab === 'media' && event.dataTransfer.types.includes('Files'))) event.preventDefault(); }, { signal });
  root.addEventListener('drop', event => {
    if (!event.target.closest('[data-canvas]') && state.tab !== 'media') return;
    event.preventDefault();
    if (event.dataTransfer.files.length) uploadFiles([...event.dataTransfer.files], state.tab === 'blocks').catch(error => toast(error.message, true));
    else if (dragId && group()) { const target = event.target.closest('[data-select-block]'); if (target) change(() => moveItem(group().blocks, group().blocks.findIndex(x => x.id === dragId), group().blocks.findIndex(x => x.id === target.dataset.selectBlock))); dragId = ''; }
  }, { signal });
  root.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-resize]'); if (!handle || state.busy || state.conflict) return;
    event.preventDefault(); event.stopPropagation();
    const b = group()?.blocks.find(x => x.id === handle.dataset.resize); if (!b) return;
    const before = clone(state.doc), startX = event.clientX, startY = event.clientY, startSpan = b.style.span, startHeight = b.style.height;
    const box = handle.closest('.editable-block'), width = (root.querySelector('[data-canvas]').clientWidth - 54) / 4;
    const resize = move => { b.style.span = Math.max(1, Math.min(4, startSpan + Math.round((move.clientX - startX) / width))); b.style.height = Math.max(60, Math.min(1000, Math.round((startHeight + move.clientY - startY) / 10) * 10)); box.style.setProperty('--span', b.style.span); box.querySelector('.content-block').style.setProperty('--block-height', b.style.height + 'px'); };
    const end = () => { window.removeEventListener('pointermove', resize); window.removeEventListener('pointerup', end); if (b.style.span !== startSpan || b.style.height !== startHeight) { state.undo.push(before); state.redo = []; state.dirty = true; state.version++; scheduleSave(); } state.selected = b.id; draw(); };
    window.addEventListener('pointermove', resize, { signal }); window.addEventListener('pointerup', end, { once: true, signal });
  }, { signal });
  window.addEventListener('beforeunload', event => { if (state.dirty || state.saving) { event.preventDefault(); event.returnValue = ''; } }, { signal });
  const auth = backend.client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' && !session && !disposed) options.onLogout?.(); });
  mediaTimer = setInterval(async () => { try { state.media = await backend.listMedia(); if (state.preview || state.tab === 'blocks' || state.tab === 'media') draw(); } catch { /* Preserve the current canvas during a temporary connection error. */ } }, 45 * 60 * 1000);
  draw();
  const dispose = () => { disposed = true; clearTimeout(timer); clearInterval(mediaTimer); previewCleanup?.(); auth.data.subscription.unsubscribe(); controller.abort(); };
  dispose.save = save;
  return dispose;
}
