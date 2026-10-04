import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { defaultDocument } from '../src/model.js';
let db;
const owner = '11111111-1111-4111-a111-111111111111', other = '22222222-2222-4222-a222-222222222222', file = '33333333-3333-4333-a333-333333333333';
async function role(name, user = '') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); await db.exec('set role ' + name); }
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated; grant select,insert,update,delete on storage.objects to anon,authenticated;
    insert into auth.users values('${owner}','owner@example.com'),('${other}','other@example.com');`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_portfolio.sql', import.meta.url), 'utf8'));
  await db.query('insert into private.portfolio_owners values($1)', [owner]);
});
after(async () => { await db.close(); });
test('owner can save/publish and stale or unsaved documents are rejected', async () => {
  await role('authenticated', owner);
  const doc = defaultDocument();
  assert.equal((await db.query('select public.save_portfolio_draft($1,0) as rev', [JSON.stringify(doc)])).rows[0].rev, 1);
  await assert.rejects(db.query('select public.save_portfolio_draft($1,0)', [JSON.stringify(doc)]), /DRAFT_CONFLICT/);
  await assert.rejects(db.query('select public.publish_portfolio($1,1)', [JSON.stringify({ document: { ...doc, version: 2 }, assets: {} })]), /UNSAVED_DOCUMENT/);
  await db.query('select public.publish_portfolio($1,1)', [JSON.stringify({ document: doc, assets: {} })]);
});
test('anonymous reads published data but cannot read drafts or write any document', async () => {
  await role('anon');
  assert.equal((await db.query('select * from public.portfolio_published')).rows.length, 1);
  await assert.rejects(db.query('select * from public.portfolio_drafts'), /permission denied/);
  await assert.rejects(db.query('select * from public.portfolio_media'), /permission denied/);
  await assert.rejects(db.query("update public.portfolio_published set snapshot='{}'"), /permission denied/);
  await assert.rejects(db.query("select public.save_portfolio_draft('{\"version\":1}',0)"), /permission denied/);
  await assert.rejects(db.query("select public.publish_portfolio('{}',1)"), /permission denied/);
  assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
});
test('a signed-in non-owner still cannot read drafts, save, publish or upload', async () => {
  await role('authenticated', other);
  assert.equal((await db.query('select public.is_portfolio_owner() as owner')).rows[0].owner, false);
  assert.equal((await db.query('select * from public.portfolio_drafts')).rows.length, 0);
  assert.equal((await db.query('select * from public.portfolio_media')).rows.length, 0);
  await assert.rejects(db.query("select public.save_portfolio_draft('{\"version\":1}',1)"), /OWNER_REQUIRED/);
  await assert.rejects(db.query("select public.publish_portfolio('{}',1)"), /OWNER_REQUIRED/);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('portfolio-drafts','private.png')"), /row-level security/);
  await assert.rejects(db.query('select * from private.portfolio_owners'), /permission denied/);
});
test('media references prevent permanent deletion in either draft or published state', async () => {
  await role('authenticated', owner);
  await db.query('insert into public.portfolio_media(id,name,path,mime_type,size) values($1,$2,$3,$4,100)', [file, 'photo', file + '/photo.png', 'image/png']);
  const doc = defaultDocument(); doc.profile.portraitId = file;
  await db.query('select public.save_portfolio_draft($1,1)', [JSON.stringify(doc)]);
  assert.equal((await db.query('delete from public.portfolio_media where id=$1 returning id', [file])).rows.length, 0);
  await db.query('select public.publish_portfolio($1,2)', [JSON.stringify({ document: doc, assets: {} })]);
  doc.profile.portraitId = '';
  await db.query('select public.save_portfolio_draft($1,2)', [JSON.stringify(doc)]);
  assert.equal((await db.query('delete from public.portfolio_media where id=$1 returning id', [file])).rows.length, 0);
  await db.query('select public.publish_portfolio($1,3)', [JSON.stringify({ document: doc, assets: {} })]);
  assert.equal((await db.query('delete from public.portfolio_media where id=$1 returning id', [file])).rows.length, 1);
});
test('private Storage is readable only by the owner', async () => {
  await role('authenticated', owner);
  await db.query("insert into storage.objects(bucket_id,name) values('portfolio-drafts','photo.png')");
  assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
  await role('authenticated', other);
  assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
  await role('anon');
  assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
});
