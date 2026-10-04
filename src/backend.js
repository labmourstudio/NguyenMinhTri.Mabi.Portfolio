import { createClient } from '@supabase/supabase-js';
import { defaultDocument, validateDocument, referencedMedia, makeSnapshot, publicAssetUrl, uid, mediaInUse } from './model.js';

export function validateConfig(value) {
  if (!value?.supabaseUrl || !value?.supabasePublishableKey) return null;
  const url = new URL(value.supabaseUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Project URL phải là địa chỉ https://…supabase.co của dự án.');
  const key = value.supabasePublishableKey.trim();
  let allowed = key.startsWith('sb_publishable_');
  if (!allowed) {
    try { const body = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); allowed = body.role === 'anon'; } catch { /* Invalid key. */ }
  }
  if (!allowed) throw new Error('Chỉ dùng publishable key hoặc anon key. Không dùng secret/service_role key.');
  return { supabaseUrl: url.origin, supabasePublishableKey: key };
}

export class Backend {
  constructor(config) {
    this.config = validateConfig(config);
    if (!this.config) throw new Error('Chưa kết nối Supabase.');
    this.client = createClient(this.config.supabaseUrl, this.config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: globalThis.sessionStorage, storageKey: 'mabi-owner-session' },
    });
  }
  async checkOwner() {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return false;
    const { data, error } = await this.client.rpc('is_portfolio_owner');
    if (error) throw error;
    return data === true;
  }
  async login(email, password) {
    const { error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error('Không đăng nhập được. Kiểm tra email và mật khẩu.');
    try {
      if (!await this.checkOwner()) throw new Error('Tài khoản này chưa được cấp quyền chủ sở hữu portfolio.');
    } catch (error) { await this.client.auth.signOut({ scope: 'local' }); throw error; }
  }
  async logout() { const { error } = await this.client.auth.signOut({ scope: 'local' }); if (error) throw error; }
  async loadPublished() {
    const { data, error } = await this.client.from('portfolio_published').select('snapshot').eq('id', 'main').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    validateDocument(data.snapshot.document);
    return data.snapshot;
  }
  async loadDraft() {
    const { data, error } = await this.client.from('portfolio_drafts').select('document,revision').eq('id', 'main').maybeSingle();
    if (error) throw error;
    return data ? { document: validateDocument(data.document), revision: data.revision } : { document: defaultDocument(), revision: 0 };
  }
  async saveDraft(document, expectedRevision) {
    const { data, error } = await this.client.rpc('save_portfolio_draft', { p_document: validateDocument(document), p_expected_revision: expectedRevision });
    if (error) throw new Error(error.message.includes('DRAFT_CONFLICT') ? 'Bản nháp đã được thay đổi ở một cửa sổ khác. Tải bản nháp mới trước khi lưu tiếp.' : 'Chưa lưu được bản nháp: ' + error.message);
    return data;
  }
  async listMedia() {
    const { data, error } = await this.client.from('portfolio_media').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    if (!data.length) return [];
    const { data: signed, error: signError } = await this.client.storage.from('portfolio-drafts').createSignedUrls(data.map(x => x.path), 3600);
    if (signError) throw signError;
    return data.map(item => ({ ...item, mime: item.mime_type, url: signed.find(x => x.path === item.path)?.signedUrl || '' }));
  }
  async upload(file, previous) {
    const types = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm'];
    if (!types.includes(file.type)) throw new Error('Chọn PNG, JPG, WebP, AVIF, GIF, MP4 hoặc WebM.');
    const max = file.type.startsWith('video/') ? 40 : 15;
    if (file.size > max * 1024 * 1024) throw new Error('Tệp vượt quá ' + max + ' MB.');
    const id = previous?.id || uid();
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' }[file.type];
    const path = id + '/' + uid() + '.' + extension;
    let width = 0, height = 0;
    if (file.type.startsWith('image/')) {
      const image = await createImageBitmap(file).catch(() => { throw new Error('Tệp ảnh không đọc được.'); });
      width = image.width; height = image.height; image.close();
    }
    const { error } = await this.client.storage.from('portfolio-drafts').upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const row = { id, name: previous?.name || file.name, path, mime_type: file.type, size: file.size, width, height };
    const result = previous ? await this.client.from('portfolio_media').update(row).eq('id', id).select().single() : await this.client.from('portfolio_media').insert(row).select().single();
    if (result.error) { await this.client.storage.from('portfolio-drafts').remove([path]); throw result.error; }
    const { data, error: signedError } = await this.client.storage.from('portfolio-drafts').createSignedUrl(path, 3600);
    if (signedError) throw signedError;
    return { ...result.data, mime: file.type, url: data.signedUrl };
  }
  async renameMedia(id, name) {
    const { error } = await this.client.from('portfolio_media').update({ name }).eq('id', id);
    if (error) throw error;
  }
  async deleteMedia(item) {
    const [draft, published] = await Promise.all([this.loadDraft(), this.loadPublished()]);
    if (mediaInUse(item.id, draft.document, published)) throw new Error('Tệp này đang được dùng trong bản nháp hoặc bản đã xuất bản. Gỡ tệp khỏi các trang và xuất bản lại trước khi xoá vĩnh viễn.');
    const { data, error } = await this.client.from('portfolio_media').delete().eq('id', item.id).select('id');
    if (error) throw error;
    if (!data.length) throw new Error('Tệp vẫn đang được sử dụng hoặc bạn không có quyền xoá.');
    for (const bucket of ['portfolio-drafts', 'portfolio-public']) {
      const { data: files, error: listError } = await this.client.storage.from(bucket).list(item.id, { limit: 1000 });
      if (listError) throw listError;
      if (files?.length) {
        const { error: removeError } = await this.client.storage.from(bucket).remove(files.map(x => item.id + '/' + x.name));
        if (removeError) throw removeError;
      }
    }
  }
  async publish(document, revision, media, progress = () => {}) {
    const assets = {}, uploaded = [];
    try {
      const ids = [...referencedMedia(document)];
      for (let index = 0; index < ids.length; index++) {
        const item = media.find(x => x.id === ids[index]);
        if (!item) throw new Error('Một ảnh/video trong portfolio đã bị xoá.');
        progress('Chuẩn bị ảnh ' + (index + 1) + '/' + ids.length);
        const url = publicAssetUrl(this.config.supabaseUrl, item.path);
        const { data: blob, error: downloadError } = await this.client.storage.from('portfolio-drafts').download(item.path);
        if (downloadError) throw downloadError;
        const { error: uploadError } = await this.client.storage.from('portfolio-public').upload(item.path, blob, { upsert: false, contentType: item.mime_type });
        if (uploadError && !['409', '400'].includes(String(uploadError.statusCode))) throw uploadError;
        if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError;
        if (!uploadError) uploaded.push(item.path);
        assets[item.id] = { ...item, mime: item.mime_type, url };
      }
      const snapshot = makeSnapshot(document, assets);
      progress('Đang xuất bản');
      const { error } = await this.client.rpc('publish_portfolio', { p_snapshot: snapshot, p_expected_revision: revision });
      if (error) throw new Error(error.message.includes('DRAFT_CONFLICT') ? 'Có bản nháp mới ở cửa sổ khác. Tải lại trước khi xuất bản.' : error.message);
      return snapshot;
    } catch (error) {
      // Another editor can publish a file after we upload it. Never delete a
      // shared file while rolling back a failed publication.
      if (uploaded.length) {
        try {
          const current = await this.loadPublished();
          const used = new Set(Object.values(current?.assets || {}).map(x => x.url));
          const unused = uploaded.filter(path => !used.has(publicAssetUrl(this.config.supabaseUrl, path)));
          if (unused.length) await this.client.storage.from('portfolio-public').remove(unused);
        } catch { /* Keep uploaded objects when the current publication cannot be checked. */ }
      }
      throw error;
    }
  }
}
