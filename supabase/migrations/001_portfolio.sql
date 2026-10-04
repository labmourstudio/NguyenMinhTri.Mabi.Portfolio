-- Run once in the SQL Editor of a dedicated Supabase project.
-- User-facing setup never needs a service_role key.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.portfolio_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table private.portfolio_owners enable row level security;
revoke all on private.portfolio_owners from public, anon, authenticated;

create or replace function public.is_portfolio_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from private.portfolio_owners where user_id = (select auth.uid())); $$;
revoke all on function public.is_portfolio_owner() from public, anon;
grant execute on function public.is_portfolio_owner() to authenticated;

create table if not exists public.portfolio_drafts (
  id text primary key check (id = 'main'), document jsonb not null,
  revision bigint not null default 1, updated_at timestamptz not null default now()
);
create table if not exists public.portfolio_published (
  id text primary key check (id = 'main'), snapshot jsonb not null,
  published_at timestamptz not null default now()
);
create table if not exists public.portfolio_media (
  id uuid primary key, name text not null, path text not null unique,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','image/avif','image/gif','video/mp4','video/webm')),
  size bigint not null check (size > 0 and size <= 41943040),
  width integer not null default 0, height integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.portfolio_drafts enable row level security;
alter table public.portfolio_published enable row level security;
alter table public.portfolio_media enable row level security;
revoke all on public.portfolio_drafts, public.portfolio_published, public.portfolio_media from public, anon, authenticated;
grant select on public.portfolio_published to anon, authenticated;
grant select on public.portfolio_drafts to authenticated;
grant select, insert, update, delete on public.portfolio_media to authenticated;

drop policy if exists "published_read" on public.portfolio_published;
create policy "published_read" on public.portfolio_published for select to anon, authenticated using (true);
drop policy if exists "draft_owner_read" on public.portfolio_drafts;
create policy "draft_owner_read" on public.portfolio_drafts for select to authenticated using ((select public.is_portfolio_owner()));
drop policy if exists "media_owner_read" on public.portfolio_media;
create policy "media_owner_read" on public.portfolio_media for select to authenticated using ((select public.is_portfolio_owner()));
drop policy if exists "media_owner_insert" on public.portfolio_media;
create policy "media_owner_insert" on public.portfolio_media for insert to authenticated with check ((select public.is_portfolio_owner()) and path like id::text || '/%');
drop policy if exists "media_owner_update" on public.portfolio_media;
create policy "media_owner_update" on public.portfolio_media for update to authenticated using ((select public.is_portfolio_owner())) with check ((select public.is_portfolio_owner()) and path like id::text || '/%');
drop policy if exists "media_owner_delete" on public.portfolio_media;
create policy "media_owner_delete" on public.portfolio_media for delete to authenticated using (
  (select public.is_portfolio_owner())
  and not exists (select 1 from public.portfolio_drafts d where position(portfolio_media.id::text in d.document::text) > 0)
  and not exists (select 1 from public.portfolio_published p where position(portfolio_media.id::text in p.snapshot::text) > 0)
);

-- Serialize saves and publications; reject a stale editor rather than overwrite.
create or replace function public.save_portfolio_draft(p_document jsonb, p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare current_revision bigint;
begin
  if not public.is_portfolio_owner() then raise exception 'OWNER_REQUIRED' using errcode = '42501'; end if;
  if jsonb_typeof(p_document) is distinct from 'object' or p_document->>'version' is distinct from '1' then raise exception 'INVALID_DOCUMENT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(426103);
  select revision into current_revision from public.portfolio_drafts where id = 'main' for update;
  if coalesce(current_revision,0) <> p_expected_revision then raise exception 'DRAFT_CONFLICT'; end if;
  insert into public.portfolio_drafts (id,document,revision) values ('main',p_document,coalesce(current_revision,0)+1)
  on conflict (id) do update set document = excluded.document, revision = excluded.revision, updated_at = now();
  return coalesce(current_revision,0)+1;
end; $$;
revoke all on function public.save_portfolio_draft(jsonb,bigint) from public, anon;
grant execute on function public.save_portfolio_draft(jsonb,bigint) to authenticated;

create or replace function public.publish_portfolio(p_snapshot jsonb, p_expected_revision bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare draft_document jsonb; current_revision bigint;
begin
  if not public.is_portfolio_owner() then raise exception 'OWNER_REQUIRED' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(426103);
  select document,revision into draft_document,current_revision from public.portfolio_drafts where id = 'main' for update;
  if current_revision is null or current_revision <> p_expected_revision then raise exception 'DRAFT_CONFLICT'; end if;
  if p_snapshot->'document' is distinct from draft_document then raise exception 'UNSAVED_DOCUMENT'; end if;
  if jsonb_typeof(p_snapshot->'assets') is distinct from 'object' then raise exception 'INVALID_ASSETS'; end if;
  insert into public.portfolio_published(id,snapshot) values('main',jsonb_build_object('document',draft_document,'assets',p_snapshot->'assets','publishedAt',now()))
  on conflict(id) do update set snapshot = excluded.snapshot, published_at = now();
end; $$;
revoke all on function public.publish_portfolio(jsonb,bigint) from public, anon;
grant execute on function public.publish_portfolio(jsonb,bigint) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
('portfolio-drafts','portfolio-drafts',false,41943040,array['image/png','image/jpeg','image/webp','image/avif','image/gif','video/mp4','video/webm']),
('portfolio-public','portfolio-public',true,41943040,array['image/png','image/jpeg','image/webp','image/avif','image/gif','video/mp4','video/webm'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "portfolio_storage_owner_read" on storage.objects;
create policy "portfolio_storage_owner_read" on storage.objects for select to authenticated
using (bucket_id in ('portfolio-drafts','portfolio-public') and (select public.is_portfolio_owner()));
drop policy if exists "portfolio_storage_owner_insert" on storage.objects;
create policy "portfolio_storage_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id in ('portfolio-drafts','portfolio-public') and (select public.is_portfolio_owner()));
drop policy if exists "portfolio_storage_owner_update" on storage.objects;
create policy "portfolio_storage_owner_update" on storage.objects for update to authenticated
using (bucket_id in ('portfolio-drafts','portfolio-public') and (select public.is_portfolio_owner()))
with check (bucket_id in ('portfolio-drafts','portfolio-public') and (select public.is_portfolio_owner()));
drop policy if exists "portfolio_storage_owner_delete" on storage.objects;
create policy "portfolio_storage_owner_delete" on storage.objects for delete to authenticated
using (bucket_id in ('portfolio-drafts','portfolio-public') and (select public.is_portfolio_owner()));
commit;
