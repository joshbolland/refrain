create table if not exists public.recording_lyric_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recording_id uuid not null references public.recordings (id) on delete cascade,
  lyric_file_id uuid not null references public.lyric_files (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recording_id, lyric_file_id)
);

create index if not exists recording_lyric_links_user_recording_idx
  on public.recording_lyric_links (user_id, recording_id);

create index if not exists recording_lyric_links_user_lyric_file_idx
  on public.recording_lyric_links (user_id, lyric_file_id);

alter table public.recording_lyric_links enable row level security;

grant select, insert, delete on table public.recording_lyric_links to authenticated;

drop policy if exists "Users can select their recording lyric links"
  on public.recording_lyric_links;

drop policy if exists "Users can insert their recording lyric links"
  on public.recording_lyric_links;

drop policy if exists "Users can delete their recording lyric links"
  on public.recording_lyric_links;

create policy "Users can select their recording lyric links"
  on public.recording_lyric_links
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their recording lyric links"
  on public.recording_lyric_links
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.recordings
      where recordings.id = recording_id
        and recordings.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.lyric_files
      where lyric_files.id = lyric_file_id
        and lyric_files.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their recording lyric links"
  on public.recording_lyric_links
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
