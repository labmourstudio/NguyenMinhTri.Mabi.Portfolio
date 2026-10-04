import { Backend, validateConfig } from './backend.js';
import { defaultDocument, escape as e } from './model.js';
import { portfolioMarkup, projectMarkup, bindPortfolio, cursorEffect } from './view.js';
import { mountEditor } from './editor.js';
import { star, arrow, toast, download } from './ui.js';

const root = document.getElementById('app');
const base = new URL('.', location.href);
let config, backend, cleanup, editorCleanup, currentRoute = '', routing = false;
try {
  const response = await fetch(new URL('portfolio-config.json', base), { cache: 'no-store' });
  if (!response.ok) throw new Error('Không đọc được cấu hình website.');
  config = validateConfig(await response.json());
} catch (error) { toast(error.message, true); }

function unavailable(title, description) {
  root.innerHTML = `<main class="unavailable-page">${star}<h1>${e(title)}</h1><p>${e(description)}</p><button class="button primary" data-retry>Thử lại ${arrow}</button><a class="text-link" href="#home">Về trang chính</a></main>`;
  root.querySelector('[data-retry]').onclick = () => route(true);
}
function setup() {
  root.innerHTML = `<main class="setup-page"><div class="setup-container"><header class="setup-header"><a class="wordmark" href="#home">MABI<span>${star}</span></a><a href="#home">← Trang xem portfolio</a></header><p class="eyebrow">ONE-TIME SETUP / THIẾT LẬP MỘT LẦN</p><h1>Chuẩn bị không gian riêng.</h1><p class="setup-description">GitHub Pages hiển thị website. Supabase giữ tài khoản đăng nhập, nội dung và ảnh của bạn. Hoàn thành các bước này một lần để bắt đầu chỉnh sửa.</p><div class="setup-steps"><section class="setup-step"><h2><span>01</span> Tạo kho dữ liệu của bạn</h2><p>Mở Supabase, đăng nhập rồi chọn <strong>New project</strong>. Đặt tên <strong>Mabi Portfolio</strong> và tự lưu mật khẩu cơ sở dữ liệu.</p><a class="button glass-button" href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Mở Supabase ${arrow}</a></section><section class="setup-step"><h2><span>02</span> Chuẩn bị dữ liệu & tài khoản</h2><p>Tải tệp bên dưới, mở <strong>SQL Editor</strong> của dự án Supabase, dán toàn bộ nội dung tệp và chọn <strong>Run</strong>.</p><a class="button glass-button" href="./001_portfolio.sql" download>Tải tệp thiết lập</a><p>Trong <strong>Authentication → Users → Add user</strong>, tạo tài khoản bằng email và mật khẩu của bạn, bật <strong>Auto Confirm User</strong>. Tắt <strong>Allow new users to sign up</strong> trong phần cài đặt Authentication.</p><p>Quay lại SQL Editor và chạy đoạn dưới sau khi thay email bằng email tài khoản vừa tạo:</p><pre class="setup-sql"><code>insert into private.portfolio_owners (user_id)
select id from auth.users
where email = 'EMAIL_CUA_BAN'
on conflict do nothing;</code></pre></section><section class="setup-step"><h2><span>03</span> Kết nối website</h2><p>Tìm <strong>Project URL</strong> trong phần kết nối dự án và <strong>Publishable key</strong> trong <strong>Settings → API Keys</strong>. Khóa công khai này dùng được trong website.</p><form data-setup-form>${'<label class="field"><span>Project URL</span><input name="url" type="url" required placeholder="https://abcdefgh.supabase.co" autocomplete="off"></label><label class="field"><span>Publishable key (hoặc anon key)</span><input name="key" required placeholder="sb_publishable_…" autocomplete="off"></label>'}<button class="button primary" type="submit">Kiểm tra kết nối & tải cấu hình ${arrow}</button><p class="setup-state" role="status"></p></form><p>Sau khi tải <code>portfolio-config.json</code>, mở repo GitHub và thay tệp cùng tên ở thư mục gốc bằng tệp vừa tải. Chọn <strong>Commit changes</strong>. Website sẽ kết nối được trên tất cả thiết bị.</p></section></div><div class="setup-footer"><a href="./HUONG_DAN.md" target="_blank">Đọc hướng dẫn chi tiết ↗</a></div></div></main>`;
  root.querySelector('[data-setup-form]').onsubmit = async event => {
    event.preventDefault();
    const form = event.target, button = form.querySelector('button'), status = form.querySelector('.setup-state');
    button.disabled = true; status.textContent = 'Đang kiểm tra…'; status.className = 'setup-state';
    try {
      const value = validateConfig({ supabaseUrl: form.url.value.trim(), supabasePublishableKey: form.key.value.trim() });
      const candidate = new Backend(value); await candidate.loadPublished();
      sessionStorage.setItem('mabi-setup-config', JSON.stringify(value));
      download(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), 'portfolio-config.json');
      status.innerHTML = 'Kết nối thành công. Thay tệp cấu hình trên GitHub để link chia sẻ hoạt động. <button type="button" class="button primary" data-login-now>Tiếp tục đăng nhập</button>';
      status.querySelector('[data-login-now]').onclick = () => { backend = candidate; login(); };
    } catch (error) { status.className = 'setup-state error'; status.textContent = 'Chưa kết nối được: ' + error.message + ' Kiểm tra bước 02 và thông tin dự án.'; }
    finally { button.disabled = false; }
  };
}
function login() {
  root.innerHTML = `<main class="auth-page"><section class="auth-art"><a class="wordmark" href="#home">MABI<span>${star}</span></a><div class="auth-art-content"><span>${star}</span><h1>Ý tưởng của bạn.<br>Không gian của bạn.</h1><p>Thêm tác phẩm, kể câu chuyện và tạo nên một portfolio mang dấu ấn riêng.</p></div><span class="auth-art-footer">MABI / PERSONAL CREATIVE SPACE</span></section><section class="auth-form-side"><form class="auth-form"><p class="eyebrow">OWNER ACCESS / KHÔNG GIAN RIÊNG</p><h2>Chào mừng trở lại.</h2><p>Đăng nhập tài khoản chủ sở hữu để chỉnh sửa portfolio. Khách xem chỉ truy cập bản đã xuất bản.</p><label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" placeholder="Email của bạn" required></label><label class="field"><span>Mật khẩu</span><input name="password" type="password" autocomplete="current-password" placeholder="Mật khẩu" required></label><button class="button primary" type="submit">Đăng nhập ${arrow}</button><p class="auth-error" role="alert"></p><a class="auth-bottom-link" href="#home">← Trở về portfolio</a></form></section></main>`;
  root.querySelector('.auth-form').onsubmit = async event => {
    event.preventDefault(); const form = event.target, button = form.querySelector('button');
    button.disabled = true; form.querySelector('.auth-error').textContent = '';
    try { await backend.login(form.email.value, form.password.value); form.password.value = ''; await route(true); }
    catch (error) { form.querySelector('.auth-error').textContent = error.message; }
    finally { button.disabled = false; }
  };
}
async function route(force = false) {
  if (routing) return;
  const hash = location.hash, nextRoute = hash.startsWith('#/editor') ? 'editor' : hash.startsWith('#/project/') ? 'project' : 'home';
  if (!force && nextRoute === currentRoute && nextRoute === 'home') return;
  routing = true;
  try {
    if (editorCleanup && nextRoute !== 'editor') {
      try { await editorCleanup.save(); } catch (error) { toast(error.message, true); history.replaceState(null, '', '#/editor'); return; }
    }
    cleanup?.(); cleanup = null; editorCleanup?.(); editorCleanup = null;
    currentRoute = nextRoute;
    if (nextRoute === 'editor') {
      let editorConfig = config;
      if (!editorConfig) { try { editorConfig = validateConfig(JSON.parse(sessionStorage.getItem('mabi-setup-config'))); } catch { /* Show setup for an invalid local configuration. */ } }
      if (!editorConfig) { setup(); return; }
      backend ||= new Backend(editorConfig);
      try {
        if (!await backend.checkOwner()) { login(); return; }
        root.innerHTML = '<div class="loading-screen"><span class="loading-star">✦</span><span>ĐANG MỞ KHÔNG GIAN RIÊNG</span></div>';
        editorCleanup = await mountEditor(root, backend, { onLogout: () => setTimeout(() => route(true), 0) });
      } catch (error) { unavailable('Chưa mở được editor.', 'Kiểm tra kết nối Supabase và quyền chủ sở hữu. ' + error.message); }
      return;
    }
    const publicBackend = config ? (backend || new Backend(config)) : null;
    let snapshot;
    try { snapshot = publicBackend ? await publicBackend.loadPublished() : null; }
    catch { unavailable('Portfolio đang tạm gián đoạn.', 'Chưa tải được nội dung đã xuất bản. Vui lòng thử lại sau ít phút.'); return; }
    const doc = snapshot?.document || defaultDocument(), assets = snapshot?.assets || {};
    document.title = doc.profile.name + ' — ' + doc.profile.alias + ' Portfolio';
    if (nextRoute === 'project') {
      const project = doc.projects.find(x => x.id === hash.slice(10));
      if (!project) { unavailable('Dự án chưa được xuất bản.', 'Trở về portfolio để xem các dự án hiện có.'); return; }
      root.innerHTML = projectMarkup(project, doc, assets); window.scrollTo(0, 0);
    } else root.innerHTML = portfolioMarkup(doc, assets);
    const disposeView = bindPortfolio(root, assets), disposeCursor = cursorEffect(doc.theme);
    cleanup = () => { disposeView(); disposeCursor(); };
    if (nextRoute === 'home' && hash && !hash.startsWith('#/')) requestAnimationFrame(() => { try { root.querySelector(hash)?.scrollIntoView({ behavior: 'instant' }); } catch { /* Invalid anchor. */ } });
  } finally { routing = false; }
}
window.addEventListener('hashchange', () => route());
await route();
