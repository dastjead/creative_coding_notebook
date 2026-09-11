create extension if not exists pgcrypto;

create table public.notebook_projects (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled experiment',
  notes text not null default '',
  tags text[] not null default '{}',
  favorite boolean not null default false,
  profile_id text not null check (profile_id in ('glsl-webgl2', 'p5-webgl', 'three-webgl')),
  draft_code text not null default '',
  current_revision_id uuid,
  last_successful_revision_id uuid,
  run_status text not null default 'draft' check (run_status in ('draft', 'running', 'success', 'error', 'stopped')),
  server_revision bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notebook_original_sources (
  id uuid primary key,
  project_id uuid not null references public.notebook_projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  raw_code text not null,
  source_url text,
  author text,
  collected_at timestamptz not null,
  content_hash text not null
);

create table public.notebook_revisions (
  id uuid primary key,
  project_id uuid not null references public.notebook_projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_revision_id uuid,
  code text not null,
  profile_id text not null,
  profile_version text not null,
  wrapper_version text not null,
  reason text not null,
  result text not null,
  created_at timestamptz not null
);

create table public.notebook_media (
  id uuid primary key,
  project_id uuid not null references public.notebook_projects(id) on delete cascade,
  revision_id uuid,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('asset', 'capture')),
  object_path text not null,
  mime_type text not null,
  byte_length bigint not null,
  checksum text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null,
  unique (user_id, object_path)
);

create table public.notebook_sync_mutations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.notebook_projects(id) on delete cascade,
  client_mutation_id uuid not null,
  server_revision bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_mutation_id)
);

create index notebook_projects_user_updated_idx on public.notebook_projects (user_id, updated_at desc);
create index notebook_revisions_project_created_idx on public.notebook_revisions (project_id, created_at);
create index notebook_media_project_created_idx on public.notebook_media (project_id, created_at);

alter table public.notebook_projects enable row level security;
alter table public.notebook_original_sources enable row level security;
alter table public.notebook_revisions enable row level security;
alter table public.notebook_media enable row level security;
alter table public.notebook_sync_mutations enable row level security;

create policy "owners manage projects" on public.notebook_projects
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage original sources" on public.notebook_original_sources
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage revisions" on public.notebook_revisions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage media metadata" on public.notebook_media
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners read mutation receipts" on public.notebook_sync_mutations
  for select to authenticated using (user_id = auth.uid());

create or replace function public.reject_original_source_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Original sources are immutable';
end;
$$;

create trigger notebook_original_sources_immutable
before update or delete on public.notebook_original_sources
for each row execute function public.reject_original_source_mutation();

create or replace function public.apply_project_mutation(
  p_project_id uuid,
  p_client_mutation_id uuid,
  p_base_server_revision bigint,
  p_payload jsonb
)
returns table(status text, server_revision bigint, remote_payload jsonb)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.notebook_projects%rowtype;
  v_project_payload jsonb := coalesce(p_payload -> 'project', p_payload);
  v_revision bigint;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_project
  from public.notebook_projects
  where id = p_project_id and user_id = v_user_id
  for update;

  if found and exists (
    select 1 from public.notebook_sync_mutations
    where user_id = v_user_id and client_mutation_id = p_client_mutation_id
  ) then
    return query select 'applied'::text, v_project.server_revision, null::jsonb;
    return;
  end if;

  if found and p_base_server_revision is distinct from v_project.server_revision then
    return query select 'conflict'::text, v_project.server_revision, to_jsonb(v_project);
    return;
  end if;

  if not found then
    if p_base_server_revision is not null then
      return query select 'conflict'::text, 0::bigint, null::jsonb;
      return;
    end if;
    insert into public.notebook_projects (
      id, user_id, title, notes, tags, favorite, profile_id, draft_code,
      current_revision_id, last_successful_revision_id, run_status, deleted_at, created_at, updated_at
    ) values (
      p_project_id, v_user_id,
      coalesce(v_project_payload ->> 'title', 'Untitled experiment'),
      coalesce(v_project_payload ->> 'notes', ''),
      coalesce(array(select jsonb_array_elements_text(v_project_payload -> 'tags')), '{}'),
      coalesce((v_project_payload ->> 'favorite')::boolean, false),
      coalesce(v_project_payload ->> 'profileId', 'glsl-webgl2'),
      coalesce(v_project_payload ->> 'draftCode', ''),
      nullif(v_project_payload ->> 'currentRevisionId', '')::uuid,
      nullif(v_project_payload ->> 'lastSuccessfulRevisionId', '')::uuid,
      coalesce(v_project_payload ->> 'status', 'draft'),
      nullif(v_project_payload ->> 'deletedAt', '')::timestamptz,
      coalesce(nullif(v_project_payload ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_project_payload ->> 'updatedAt', '')::timestamptz, now())
    ) returning * into v_project;
  else
    update public.notebook_projects set
      title = coalesce(v_project_payload ->> 'title', title),
      notes = coalesce(v_project_payload ->> 'notes', notes),
      tags = case when v_project_payload ? 'tags' then array(select jsonb_array_elements_text(v_project_payload -> 'tags')) else tags end,
      favorite = coalesce((v_project_payload ->> 'favorite')::boolean, favorite),
      profile_id = coalesce(v_project_payload ->> 'profileId', profile_id),
      draft_code = coalesce(v_project_payload ->> 'draftCode', draft_code),
      current_revision_id = coalesce(nullif(v_project_payload ->> 'currentRevisionId', '')::uuid, current_revision_id),
      last_successful_revision_id = coalesce(nullif(v_project_payload ->> 'lastSuccessfulRevisionId', '')::uuid, last_successful_revision_id),
      run_status = coalesce(v_project_payload ->> 'status', run_status),
      deleted_at = case when v_project_payload ? 'deletedAt' then nullif(v_project_payload ->> 'deletedAt', '')::timestamptz else deleted_at end,
      updated_at = now(),
      server_revision = notebook_projects.server_revision + 1
    where id = p_project_id and user_id = v_user_id
    returning * into v_project;
  end if;

  if p_payload ? 'originalSource' then
    insert into public.notebook_original_sources (
      id, project_id, user_id, raw_code, source_url, author, collected_at, content_hash
    ) values (
      (p_payload #>> '{originalSource,id}')::uuid, p_project_id, v_user_id,
      p_payload #>> '{originalSource,rawCode}', p_payload #>> '{originalSource,sourceUrl}',
      p_payload #>> '{originalSource,author}', (p_payload #>> '{originalSource,collectedAt}')::timestamptz,
      p_payload #>> '{originalSource,contentHash}'
    ) on conflict (id) do nothing;
  end if;

  if p_payload ? 'revision' then
    insert into public.notebook_revisions (
      id, project_id, user_id, parent_revision_id, code, profile_id, profile_version,
      wrapper_version, reason, result, created_at
    ) values (
      (p_payload #>> '{revision,id}')::uuid, p_project_id, v_user_id,
      nullif(p_payload #>> '{revision,parentRevisionId}', '')::uuid,
      p_payload #>> '{revision,code}', p_payload #>> '{revision,profileId}',
      p_payload #>> '{revision,profileVersion}', p_payload #>> '{revision,wrapperVersion}',
      p_payload #>> '{revision,reason}', p_payload #>> '{revision,result}',
      (p_payload #>> '{revision,createdAt}')::timestamptz
    ) on conflict (id) do nothing;
  end if;

  v_revision := v_project.server_revision;
  insert into public.notebook_sync_mutations (user_id, project_id, client_mutation_id, server_revision)
  values (v_user_id, p_project_id, p_client_mutation_id, v_revision);
  return query select 'applied'::text, v_revision, null::jsonb;
end;
$$;

revoke all on function public.apply_project_mutation(uuid, uuid, bigint, jsonb) from public;
grant execute on function public.apply_project_mutation(uuid, uuid, bigint, jsonb) to authenticated;

insert into storage.buckets (id, name, public)
values ('notebook-media', 'notebook-media', false)
on conflict (id) do update set public = false;

create policy "owners read notebook objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'notebook-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners insert notebook objects" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notebook-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners delete notebook objects" on storage.objects
  for delete to authenticated
  using (bucket_id = 'notebook-media' and (storage.foldername(name))[1] = auth.uid()::text);
