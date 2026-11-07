-- Phase 6b: Move Maintenance Ticket Photos to Private Supabase Storage Bucket with Size & MIME Limits

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-photos',
  'ticket-photos',
  false,
  1572864, -- 1.5 MB hard limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 1572864,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

alter table jm_letvest.maintenance_tickets
  add column if not exists photo_storage_path text;

alter table jm_letvest.maintenance_tickets
  drop constraint if exists maintenance_tickets_no_base64_storage_path;

alter table jm_letvest.maintenance_tickets
  add constraint maintenance_tickets_no_base64_storage_path
  check (photo_storage_path is null or photo_storage_path !~* '^data:image/');

-- Storage RLS Policies: path format '<workspace_id>/<ticket_id>/<filename>'
drop policy if exists ticket_photos_owner_select on storage.objects;
create policy ticket_photos_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-photos'
    and (storage.foldername(name))[1]::uuid in (
      select id from jm_letvest.workspaces where owner_id = auth.uid()
      union
      select workspace_id from jm_letvest.contacts where user_id = auth.uid()
    )
  );

drop policy if exists ticket_photos_authenticated_insert on storage.objects;
create policy ticket_photos_authenticated_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-photos'
    and (storage.foldername(name))[1]::uuid in (
      select id from jm_letvest.workspaces where owner_id = auth.uid()
      union
      select workspace_id from jm_letvest.contacts where user_id = auth.uid()
    )
  );

drop policy if exists ticket_photos_owner_delete on storage.objects;
create policy ticket_photos_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ticket-photos'
    and (storage.foldername(name))[1]::uuid in (
      select id from jm_letvest.workspaces where owner_id = auth.uid()
    )
  );
