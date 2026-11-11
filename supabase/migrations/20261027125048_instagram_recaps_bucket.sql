insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('instagram-recaps', 'instagram-recaps', true, array['image/jpeg','image/png'], 5242880)
on conflict (id) do nothing;
create policy "tmp_upload_instagram_recaps" on storage.objects for insert to anon
with check (bucket_id = 'instagram-recaps' and name like '2026-10-27/%');;
