alter table public.recordings
  add column if not exists local_uri text,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists sync_status text check (sync_status in ('ready', 'needs-reupload'));

update public.recordings
set
  local_uri = coalesce(local_uri, uri),
  sync_status = case
    when storage_bucket is not null and storage_path is not null then 'ready'
    when coalesce(local_uri, uri) is not null then 'needs-reupload'
    else coalesce(sync_status, 'ready')
  end
where local_uri is null or sync_status is null;

create index if not exists recordings_user_storage_path_idx
  on public.recordings (user_id, storage_path);
