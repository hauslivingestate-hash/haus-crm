# HAUS CRM

ระบบ CRM หน้าเว็บของ **Haus Living Estate** — Next.js 15 + Tailwind v4 ต่อกับ Supabase
สร้างตาม design system ใน [`haus-design-system`](../haus-design-system) (tokens, components, rules)

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
  layout.tsx             shell: ฟอนต์ + Sidebar
  globals.css            design tokens (จาก haus-design-system/tokens.css)
  page.tsx               / — แดชบอร์ด (KPI, pipeline, ผลงานเซล)
  pipeline/page.tsx      /pipeline — บอร์ดดีลตามสเตจ
  leads/page.tsx         /leads — ตาราง CRM ผู้ซื้อ
  listings/page.tsx      /listings — ตารางทรัพย์ (v_main_listing)
  styleguide/page.tsx    /styleguide — โทเคน + component ทั้งหมด
components/
  Sidebar.tsx Topbar.tsx PipelineBoard.tsx   ส่วนประกอบหน้า
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

- **ห้าม hard-code hex** ใน component — ใช้ token utility (`bg-surface`, `text-accent`, ...)
- ทุกตัวเลขใส่ `className="num"` (IBM Plex Mono, tabular)
- Status = จุดสี + ข้อความ (ไม่ใช่ pill ทึบ) · โครงสร้างด้วย border ไม่ใช่ shadow
- Accent เดียวคือ crimson `#a32638` · โลโก้ maroon `#631222` ไม่ใช้เป็น UI accent

ดูรายละเอียดเต็มที่ [`../haus-design-system/DESIGN_SYSTEM.md`](../haus-design-system/DESIGN_SYSTEM.md)
