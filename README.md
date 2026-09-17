# HAUS CRM

ระบบ CRM หน้าเว็บของ **Haus Living Estate** — Next.js 15 + Tailwind v4 ต่อกับ Supabase
design tokens อยู่ใน `app/globals.css` (semantic tokens เท่านั้น — อ่านหัวไฟล์ก่อนแก้สี)

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env.local   # แล้วใส่ค่า Supabase
npm run dev                  # http://localhost:3000
```

| Script | ทำอะไร |
|---|---|
| `npm run dev` | dev server บน port 3000 |
| `npm run build` | build production |
| `npm run start` | รัน production build (port 3000) |

## Environment

ใส่ค่าใน `.env.local` (ดูตัวอย่างที่ `.env.example`):

| ตัวแปร | ค่า |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL ของ Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable / anon key (read-only) |

## โครงสร้างโปรเจกต์

```
app/                     หน้าเว็บ (App Router)
  layout.tsx             root: ฟอนต์ + ThemeProvider (สว่าง/มืด/ระบบ)
  (app)/layout.tsx       shell: Sidebar (ย่อได้, จำด้วย cookie) + Topbar + providers
  globals.css            design tokens — primitives → semantic → @theme map
  page.tsx               / — แดชบอร์ด แท็บ ขาย (ของตัวเอง) และ ทีม (performance.view_team; lib/teamDashboard.ts)
  pipeline/page.tsx      /pipeline — บอร์ดดีลตามสเตจ
  leads/page.tsx         /leads — ตาราง CRM ผู้ซื้อ
  listings/page.tsx      /listings — ตารางทรัพย์ (v_main_listing)
  styleguide/page.tsx    /styleguide — โทเคน + component ทั้งหมด
components/
  Shell.tsx Sidebar.tsx Topbar.tsx IdentityMenu.tsx   เปลือกแอป (เมนู, breadcrumb, บัญชี/ธีม/ดูในมุมมอง)
  GlobalSearch.tsx       ⌘K ค้นหาลีด/ทรัพย์/โครงการ/คน (server action `searchAll` ใน lib/search.ts)
  lib/navCounts.ts       ตัวเลขบนเมนู — นับเฉพาะงานที่ต้องทำ ซ่อนเมื่อเป็น 0
  ui/                    component library (Button, Card, Stat, Table, ...)
lib/
  supabase.ts            Supabase client (anon, read-only)
  queries.ts             ฟังก์ชันดึงข้อมูล + type
  format.ts              เงิน (฿x ล้าน), วันที่ พ.ศ., .num
  pipeline.ts status.ts  map สเตจ/สถานะ → สี dot
  nav.ts cn.ts           เมนู + util รวม className
```

## แหล่งข้อมูล

อ่านจาก Supabase ผ่าน anon key (server components, **read-only**):
- `v_main_listing` — ทรัพย์ + โซน + owner + Days on Market
- `v_sale_status` — สรุปผลงานเซล
- `main_6_buyer_crm` — pipeline / lead

> **หมายเหตุ RLS:** DB ใช้ policy `demo_read_all` (ให้ anon อ่านทุกแถว) สำหรับ demo เท่านั้น
> ตอนทำ RLS จริง (แยกข้อมูลตาม `created_by`) ต้องลบ policy นี้ก่อน แล้วเขียน policy จริง
> แอพนี้ยังเป็น read-only ยังไม่มี insert/update/delete

## กติกา design system (ห้ามพลาด)

Redesign 2026-09-15: layout จาก reference "Shopall", สีจาก "MoonRow" — ส้ม / navy / พื้นเทาเย็น / การ์ดขาว

- **ห้าม hard-code hex** ใน component — ใช้ token utility (`bg-surface`, `text-accent`, ...) ทั้งหมดอยู่ใน `app/globals.css`
- ทุกตัวเลขใส่ `className="num"` (IBM Plex Mono, tabular)
- **Accent เดียวคือส้ม** (`--accent`) ใช้กับปุ่ม, แถบ, ไอคอน, ตัวเลขใหญ่ · **ข้อความเล็กสีส้มต้องใช้ `text-accent-ink`**
  (ส้มสดบนขาวไม่ผ่าน AA ที่ 3.2:1; ink ผ่านที่ 4.7:1)
- "blue" = navy (`--navy-500`) — ไม่มีน้ำเงินสดในระบบ · แดงเป็นแดงจริง ไม่ใช่ส้มแดง · ยกเว้น `--dot-blue` (จุดสถานะ) ที่เป็นน้ำเงินจริง เพราะจุด navy 8px อ่านเป็นเทาเข้ม
- Status = จุดสีใน pill เทากลาง (`StatusBadge`) — pill ไม่ย้อมสีสถานะ
- **สีของสถานะ / สเตจ มาจาก ตั้งค่า → สีสถานะ เท่านั้น** — ช่องตารางใช้ `lookupFill`, จุดใช้ `lookupDot` (lib/tables/fills.ts; client อ่านจาก `useMasterData().colors`, server จาก `getLookupColors()`) · ห้ามแมป สถานะ→สี ในโค้ด (ยกเว้น owner stage ที่ยังไม่มีสีใน Settings)
- Segmented control ใช้ `SegmentedTrack` / `SegmentedItem` (pill navy) — ห้ามก๊อปคลาสเอง
- `CardHeader` ไม่มีเส้นคั่น; `CardContent` ที่ตามหลังจะดึงขึ้นชิดเอง
- หัวการ์ดแบบเขียนเอง (`h-11 … border-b`) เหลือไว้เฉพาะที่รายการ `divide-y` วางติดหัวโดยไม่มี `CardContent` — เส้นนั้นคือตัวคั่นหัวกับแถวแรก
- โลโก้เป็นรูป (`public/brand/`, render ผ่าน `components/Brand.tsx`) — maroon ในโหมดสว่าง ขาวในโหมดมืด; `--maroon-900` คือสีหมึกของโลโก้ ห้ามใช้เป็นสี UI
- Dark mode: `next-themes` + `class="dark"`; สลับได้จากเมนูบัญชี (avatar) — เปลี่ยน token ต้องเช็คทั้งสองธีม
- ป้ายตัวเลขบนเมนู = งานที่รอทำ ไม่ใช่ยอดรวม และต้องนับด้วยกติกาเดียวกับหน้าที่มันชี้ไป (ดู lib/navCounts.ts)
- รูปโปรไฟล์: เก็บ **path** ใน `main_1_hr.avatar_path` (bucket `avatars`) แล้วแปลงเป็น URL ด้วย `lib/avatar.ts` — ห้ามเก็บ URL เต็มลง DB · ไม่มีรูป = ใช้ตัวย่อชื่อ (`<Avatar>` จัดการให้) · ตั้งรูปได้เฉพาะ `people.manage` / `roles.manage` ที่หน้า ทีม ▸ รายบุคคล
- เพิ่มพนักงานใหม่ = 5 ขั้น 4 หน้า (ประวัติ → รูป → บัญชีผู้ใช้ → บทบาท → ทีม/โซน) · ป้าย **ยังตั้งค่าไม่ครบ** ใน ทีม + checklist ในหน้าประวัติคอยเตือน · เกณฑ์อยู่ที่ `employeeSetupGaps()` (lib/team.ts) ที่เดียว — **ต้องเรียกหลัง `people.manage`/`roles.manage` เท่านั้น** เพราะ `user_roles` มองเห็นแค่แถวตัวเอง
- **หน้าที่ไว้ดู = drawer · หน้าที่ไว้แก้ = หน้าเต็ม** — Lead, ทรัพย์, เซลล์ใหม่ เปิดเป็น slide-over (intercepting route `@drawer/(.)[id]` + `default.tsx` ที่ห้ามลืม ไม่งั้น hard load จะ 404) · ทีม, ผู้ติดต่อ, โครงการ เป็นหน้าเต็ม · component เดียวกันทั้งสองแบบ ต่างแค่ prop `inDrawer` ซึ่งเปลี่ยนได้แค่รูปทรง ห้ามเปลี่ยนเนื้อหา · ⚠️ `lg:` เป็น viewport query ไม่ใช่ container — grid หลายคอลัมน์ต้องปิดเมื่อ `inDrawer`
- **แดชบอร์ดทีม เรียงตาม HAUS V2** — KPI tiles + เป้ารายได้ · แนวโน้ม (2/3) | รายได้ตามเอเจนต์ (1/3) ใช้ `.dash-two-col` · KPI ทีมขาย · กิจกรรมรายวัน — เรียงจาก "ได้เท่าไร" ไป "ทำงานพอไหม" ไป "ทำวันไหน"
- **ทุกการ์ดที่แสดงรายได้ต้องมีปุ่ม Close ⇄ Win** — ทั้งสามเขียน `?basis=` เดียวกัน กดที่ไหนก็เปลี่ยนพร้อมกัน ไม่มี state ที่หลุดจากกันได้ · การ์ดที่อ่าน basis แต่ไม่มีปุ่ม คือการ์ดที่ตัวเลขเปลี่ยนโดยไม่บอกว่าทำไม
- **KPI คือแถวใน `kpi_template` ไม่ใช่ลิสต์ในโค้ด** — `on_tracker` เลือกว่าขึ้นแดชบอร์ดทีมไหม, `focus_week` 1–4 คือจังหวะของเดือน, `shape` = `count` (เทียบเป้า) หรือ `pct` (สัดส่วนของประชากร เป้า 100% เสมอ) · **ไม่มีเป้า ≠ 0** — แสดง `7/–` สีจาง และไม่นับในค่าเฉลี่ย
- **แกน Y ต้องครอบเส้นเป้าเสมอ** — สเกลที่อิงข้อมูลอย่างเดียวจะตัดเส้นเป้าหายไปตอนที่ยังทำไม่ถึง ซึ่งเป็นตอนที่เส้นนั้นสำคัญที่สุด · เพดานปัดขึ้นเป็นเลขกลม (`niceTicks`) · เส้นตารางทึบ เส้นประสงวนไว้ให้ "เกณฑ์" เท่านั้น
- **`bg-dot-*` สำหรับจุด/แถบ · `text-*` สำหรับตัวอักษร** — `--amber-500` ถูกทำให้เข้มจนอ่านบนพื้นขาวได้ (`#946200` = น้ำตาล) ใช้เป็นพื้นแถบไม่ได้ · ผิดเฉพาะโหมดสว่าง โหมดมืดจะดูปกติ
- ค้นหาได้เท่าที่เปิดเมนูดูได้ — สิทธิ์ของกลุ่มค้นหาอิงจาก `NAV` ใน lib/nav.ts ไม่มีรายการสิทธิ์ชุดที่สอง
- **AI วางข้อความ = คิว ไม่ใช่การรอ** — `enqueueParse` คืนค่าทันทีแล้วอ่านต่อใน `after()` · ปิดฟอร์ม/ล็อกจอ/สลับไป LINE ได้ระหว่างรอ ผลไปรออยู่ในถาด (`ai_job`) · ⚠️ `after()` ใช้ไม่ได้กับ static export
- **AI อ่าน โค้ดตัดสิน** — ทุกค่าที่เป็น enum ถูกเช็คกับตาราง lookup จริงอีกรอบหลังโมเดลตอบ · ทำเลไทย→`zone_id`, ชื่อโครงการ→`project_id`, รหัสทรัพย์ที่ไม่มีจริง **ทิ้ง** (เป็น FK) · โมเดลจับคู่เรคอร์ดผิดราว 1 ใน 5 จึงไม่ให้มันทำ
- **ช่องที่ AI อ่านของทรัพย์ มาจาก `lib/listingFields.ts`** — `AI_LISTING_HINTS` เก็บแค่รายชื่อคอลัมน์ + คำใบ้ ส่วนชนิด/label/ตัวเลือก derive จาก registry · assert ตอน import ถ้าคอลัมน์หาย
- **โมดูล zero-import สองตัว (`lib/ai/types.ts`, `lib/ai/model.ts`)** — client component ที่ import *ค่า* จากไฟล์ที่ไต่ไปถึง `server-only`/`next/headers` จะพัง build และ `tsc` จับไม่ได้ (เหมือน `lib/activityHeatmap.ts`)
- **สิทธิ์ AI แยกสองตัว** `ai.parse_lead` / `ai.parse_listing` ตั้งที่ ตั้งค่า ▸ บทบาท & สิทธิ์ · UI ยังบังคับเพิ่มว่าต้องมี `leads.create`/`listings.create` ด้วย ไม่งั้นได้ดราฟต์ที่บันทึกไม่ได้
