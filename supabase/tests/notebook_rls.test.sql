begin;
select plan(8);

select has_table('public', 'notebook_projects', 'project table exists');
select has_function('public', 'apply_project_mutation', array['uuid', 'uuid', 'bigint', 'jsonb'], 'optimistic mutation RPC exists');
select policies_are('public', 'notebook_projects', array['owners manage projects'], 'projects have only the owner policy');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

insert into public.notebook_projects (id, user_id, title, profile_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'mine', 'glsl-webgl2');
select is((select count(*)::integer from public.notebook_projects), 1, 'owner can read their project');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*)::integer from public.notebook_projects), 0, 'another user cannot read the project');
select throws_ok(
  $$insert into public.notebook_projects (id, user_id, title, profile_id) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'forged', 'glsl-webgl2')$$,
  '42501', null, 'another user cannot write an owned row'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
insert into public.notebook_original_sources (id, project_id, user_id, raw_code, collected_at, content_hash)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'original', now(), 'sha256');
select throws_ok(
  $$update public.notebook_original_sources set raw_code = 'changed' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  'P0001', 'Original sources are immutable', 'original source cannot be updated'
);

select is(
  (select status from public.apply_project_mutation(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    999,
    '{"project":{"title":"stale"}}'::jsonb
  )),
  'conflict',
  'stale base revision returns a conflict'
);

select * from finish();
rollback;
