-- Phase 6c: Document Uploads for Certificates, Agreements, and Inventories

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-documents',
  'property-documents',
  false,
  10485760, -- 10 MB limit for PDFs and scanned certificates/inventories
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

create table if not exists jm_letvest.documents (
  id text primary key,
  workspace_id uuid not null references jm_letvest.workspaces(id) on delete cascade,
  property_id text not null references jm_letvest.properties(id) on delete cascade,
  category text not null check (category in ('certificate', 'master_lease', 'sub_lease', 'inventory')),
  document_subtype text not null check (document_subtype in (
    'CP12', 'EICR', 'PAT', 'EPC', 'HMO Licence',
    'Head Lease', 'Room Agreement', 'Check-In Inventory', 'Check-Out Inventory'
  )),
  related_record_id text,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  expires_on date,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table jm_letvest.documents enable row level security;

drop policy if exists documents_owner_all on jm_letvest.documents;
create policy documents_owner_all on jm_letvest.documents
  for all to authenticated
  using (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()))
  with check (workspace_id in (select id from jm_letvest.workspaces where owner_id = auth.uid()));

grant select, insert, update, delete on jm_letvest.documents to authenticated;
