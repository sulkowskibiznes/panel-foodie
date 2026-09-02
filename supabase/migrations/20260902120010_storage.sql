-- Prywatne buckety (SPEC rozdz. 13.4, 16.3). Brak polityk na storage.objects = dostęp
-- wyłącznie kluczem secret po stronie serwera, przez signed URL ważny 10 minut.
-- Ścieżka pliku nigdy nie zawiera nazwy klienta: {client_id}/{asset_id}/original.ext | preview.webp | thumb.webp

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('materialy', 'materialy', false, 314572800,
    array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']),
  ('dokumenty', 'dokumenty', false, 26214400, array['application/pdf']),
  ('faktury',   'faktury',   false, 26214400, array['application/pdf']),
  ('awatary',   'awatary',   false, 5242880,  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
