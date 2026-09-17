-- รูปทรัพย์ (Ben, 2026-08-17): เก็บใน Supabase Storage ให้เซลอัปเอง สูงสุด 20 รูป/ทรัพย์
--
-- เดิมทุกหน้าโชว์รูป stock จาก Unsplash โดยไม่มีอะไรบอกว่าเป็นรูปตัวอย่าง — ตอนเป็นเดโม
-- ไม่เป็นไร แต่ระบบขึ้นของจริงแล้ว ถ้าเซลเปิดจอให้ลูกค้าดูจะกลายเป็นการโชว์บ้านผิดหลัง
--
-- ตาราง `main_8_listing_photo` มีอยู่แล้วพร้อม RLS (ดู/แก้ ตามสิทธิ์ทรัพย์) เหลือแค่ bucket
--
-- ⚠️ ไฟล์ในนี้คือ "ไฟล์สำหรับแสดงผล" ไม่ใช่ต้นฉบับ — ย่อ 1920px + WebP 82% ที่ฝั่งเบราว์เซอร์
-- ก่อนอัป · ต้นฉบับความละเอียดเต็มยังอยู่ใน Google Drive (photo_album_link, 360 ทรัพย์)
-- ซึ่งฝ่ายการตลาดใช้ส่งขึ้น DDproperty / Livinginsider ต่อไป

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  -- public read: รูปบ้านไม่ใช่ข้อมูลลับ (ยังไงก็ต้องขึ้นเว็บประกาศ) และเว็บพอร์ทัลลูกค้า
  -- ใน Phase 8 ต้องอ่านได้โดยไม่ต้อง login · ข้อมูลที่ต้องกันคือเบอร์เจ้าของ ซึ่งอยู่คนละที่
  true,
  -- 2 MB — เพดานฝั่งเซิร์ฟเวอร์ กันไฟล์ที่เลี่ยงการบีบฝั่งเบราว์เซอร์ไปได้
  -- (ตัวบีบตั้งเป้าไว้ที่ 1 MB ซึ่งรูปมือถือทั่วไปจะเหลือ 200-350 KB)
  2097152,
  array['image/webp','image/jpeg','image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage RLS ─────────────────────────────────────────────────────────────
-- storage.objects มี RLS เปิดอยู่แล้วโดย Supabase; policy เป็นของเราเอง
drop policy if exists listing_photos_read   on storage.objects;
drop policy if exists listing_photos_insert on storage.objects;
drop policy if exists listing_photos_update on storage.objects;
drop policy if exists listing_photos_delete on storage.objects;

-- อ่านได้ทุกคนรวม anon — bucket เป็น public อยู่แล้ว เขียน policy ให้ตรงกันจะได้ไม่สับสน
create policy listing_photos_read on storage.objects
  for select to public
  using (bucket_id = 'listing-photos');

-- เขียน/ลบ: สิทธิ์ชุดเดียวกับที่แก้ทรัพย์ได้ ตรงกับ policy ของ main_8_listing_photo
create policy listing_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and ((select has_perm('listings.edit'))
      or (select has_perm('listings.marketing'))
      or (select has_perm('listings.create'))
      or (select has_perm('roles.manage')))
  );

create policy listing_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((select has_perm('listings.edit'))
      or (select has_perm('listings.marketing'))
      or (select has_perm('roles.manage')))
  );

create policy listing_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((select has_perm('listings.edit'))
      or (select has_perm('listings.marketing'))
      or (select has_perm('roles.manage')))
  );

-- ── กัน 20 รูป/ทรัพย์ ที่ชั้น DB ────────────────────────────────────────────
-- ด่านในแอปกันไว้แล้ว แต่ REST ยิงตรงข้ามได้ จึงกันซ้ำตรงนี้
create or replace function public.enforce_listing_photo_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from main_8_listing_photo where listing_id = new.listing_id;
  if n >= 20 then
    raise exception 'ทรัพย์นี้มีรูปครบ 20 รูปแล้ว — ลบรูปเก่าออกก่อนถึงจะเพิ่มได้';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listing_photo_limit on public.main_8_listing_photo;
create trigger trg_listing_photo_limit
before insert on public.main_8_listing_photo
for each row execute function public.enforce_listing_photo_limit();;
