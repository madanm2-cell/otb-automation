-- Create the otb-uploads storage bucket for cycle file uploads
insert into storage.buckets (id, name, public)
values ('otb-uploads', 'otb-uploads', false)
on conflict (id) do nothing;

-- Allow authenticated users to upload files
create policy "Authenticated users can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'otb-uploads');

-- Allow authenticated users to read files
create policy "Authenticated users can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'otb-uploads');

-- Allow authenticated users to update (upsert) files
create policy "Authenticated users can update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'otb-uploads');

-- Allow authenticated users to delete files
create policy "Authenticated users can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'otb-uploads');
