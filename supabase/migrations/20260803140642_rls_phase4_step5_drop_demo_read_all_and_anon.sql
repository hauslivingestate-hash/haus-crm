-- Phase 4 RLS step 5/5 — ถอน demo_read_all/admin_write + ถอนสิทธิ์ anon
-- ทำเป็นขั้นสุดท้ายโดยตั้งใจ: policy ชุดใหม่ครบทุกตารางแล้ว จึงไม่มีช่วงที่แอปอ่านอะไรไม่ได้
-- ไม่มีคำสั่งที่แตะข้อมูล — drop policy / revoke / enable rls เท่านั้น
do $do$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r'
  loop
    execute format('drop policy if exists demo_read_all on public.%I', t);
    execute format('drop policy if exists admin_write   on public.%I', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$do$;

-- ถอน GRANT ของ anon ไม่ใช่แค่ปิด policy: ถอน policy อย่างเดียวจะได้ [] ซึ่งอ่านเหมือน
-- "ไม่มีข้อมูล" แต่ถอน GRANT จะได้ 42501 permission denied ซึ่งตรงกับความจริง
do $do$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind in ('r','v')
  loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end
$do$;;
