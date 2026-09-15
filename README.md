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
- "blue" = navy (`--navy-500`) — ไม่มีน้ำเงินสดในระบบ · แดงเป็นแดงจริง ไม่ใช่ส้มแดง
- Status = จุดสีใน pill เทากลาง (`StatusBadge`) — pill ไม่ย้อมสีสถานะ
- Segmented control ใช้ `SegmentedTrack` / `SegmentedItem` (pill navy) — ห้ามก๊อปคลาสเอง
- `CardHeader` ไม่มีเส้นคั่น; `CardContent` ที่ตามหลังจะดึงขึ้นชิดเอง
- หัวการ์ดแบบเขียนเอง (`h-11 … border-b`) เหลือไว้เฉพาะที่รายการ `divide-y` วางติดหัวโดยไม่มี `CardContent` — เส้นนั้นคือตัวคั่นหัวกับแถวแรก
- โลโก้เป็นรูป (`public/brand/`, render ผ่าน `components/Brand.tsx`) — maroon ในโหมดสว่าง ขาวในโหมดมืด; `--maroon-900` คือสีหมึกของโลโก้ ห้ามใช้เป็นสี UI
- Dark mode: `next-themes` + `class="dark"`; สลับได้จากเมนูบัญชี (avatar) — เปลี่ยน token ต้องเช็คทั้งสองธีม
- ป้ายตัวเลขบนเมนู = งานที่รอทำ ไม่ใช่ยอดรวม และต้องนับด้วยกติกาเดียวกับหน้าที่มันชี้ไป (ดู lib/navCounts.ts)
- ค้นหาได้เท่าที่เปิดเมนูดูได้ — สิทธิ์ของกลุ่มค้นหาอิงจาก `NAV` ใน lib/nav.ts ไม่มีรายการสิทธิ์ชุดที่สอง
