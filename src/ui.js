import { escape as e } from './model.js';
export const star = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 2C35 24 40 29 62 32C40 35 35 40 32 62C29 40 24 35 2 32C24 29 29 24 32 2Z" fill="currentColor"/></svg>';
export const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const plus = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
export function toast(message, error = false) {
  const root = document.getElementById('toast');
  root.textContent = String(message); root.className = error ? 'visible error' : 'visible';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => root.className = '', error ? 9000 : 4500);
}
let cleanupModal;
export function closeModal() {
  cleanupModal?.(); cleanupModal = null;
  document.getElementById('modal-root').innerHTML = ''; document.body.classList.remove('modal-open');
}
export function modal(content, onReady = () => {}, wide = false) {
  closeModal();
  const previous = document.activeElement;
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><section class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="Hộp thoại"><button class="modal-close icon-button" data-close aria-label="Đóng">×</button>${content}</section></div>`;
  document.body.classList.add('modal-open');
  const handler = event => {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab') {
      const nodes = [...root.querySelectorAll('button,input,textarea,select,a[href]')].filter(x => !x.disabled);
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
      if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
    }
  };
  document.addEventListener('keydown', handler);
  cleanupModal = () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  root.querySelector('[data-close]').onclick = closeModal;
  root.querySelector('.modal-backdrop').onclick = event => { if (event.target.classList.contains('modal-backdrop')) closeModal(); };
  onReady(root); root.querySelector('input,button,textarea')?.focus();
}
export function confirmAction(title, description, action, label = 'Xoá') {
  modal(`<h2>${e(title)}</h2><p>${e(description)}</p><div class="modal-actions"><button class="button quiet" data-cancel>Huỷ</button><button class="button danger" data-confirm>${e(label)}</button></div>`, root => {
    root.querySelector('[data-cancel]').onclick = closeModal;
    root.querySelector('[data-confirm]').onclick = async event => {
      event.target.disabled = true;
      try { await action(); closeModal(); } catch (error) { toast(error.message, true); event.target.disabled = false; }
    };
  });
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
