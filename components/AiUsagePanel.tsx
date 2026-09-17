"use client";

import { Sparkles, Check, Trash2, AlertCircle, Clock } from "lucide-react";
import { AI_MODEL, AI_USD_THB } from "@/lib/ai/model";
import type { AiUsageSummary } from "@/lib/ai/usage";
import { formatBaht } from "@/lib/format";

/* ตั้งค่า ▸ AI — what the parser costs and whether it is earning it.
 *
 * Two questions, and the second is the one that decides whether this feature stays:
 *
 *   SPEND    tokens × the tier's price. Shown for this month, because that is the window a
 *            budget is read against, with the all-time figure beside it for scale.
 *   QUALITY  saved vs discarded. A draft that gets thrown away cost the same as one that
 *            got saved, and a high discard rate is the signal to change the prompt or drop a
 *            tier — not something to discover from a bill.
 *
 * The permissions themselves are NOT here. They live in บทบาท & สิทธิ์ with every other
 * permission, because "who may spend this" is a role question and splitting it out would
 * give the CEO two places to look.
 */
export function AiUsagePanel({ usage }: { usage: AiUsageSummary }) {
  const reviewed = usage.saved + usage.discarded;
  const keepRate = reviewed ? Math.round((usage.saved / reviewed) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="เดือนนี้"
          value={`≈ ${formatBaht(Math.round(usage.costThbThisMonth))}`}
          hint={`${usage.parsesThisMonth} ครั้ง`}
        />
        <Stat
          label="รวมทั้งหมด"
          value={`≈ ${formatBaht(Math.round(usage.costThb))}`}
          hint={`${usage.parses} ครั้ง`}
        />
        <Stat
          label="เฉลี่ยต่อครั้ง"
          value={usage.parses ? `≈ ${formatBaht(Math.round(usage.costThb / usage.parses))}` : "—"}
          hint={`โมเดล ${usage.models.length ? usage.models.join(" · ") : AI_MODEL}`}
        />
        <Stat
          label="ใช้ดราฟต์จริง"
          value={keepRate == null ? "—" : `${keepRate}%`}
          hint={reviewed ? `จาก ${reviewed} รายการที่ตรวจแล้ว` : "ยังไม่มีรายการที่ตรวจ"}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-3">
        <div className="text-small font-medium">ผลของดราฟต์</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tally icon={<Check size={14} className="text-green" />} label="บันทึกเป็นข้อมูลจริง" n={usage.saved} />
          <Tally icon={<Trash2 size={14} className="text-text-subtle" />} label="ทิ้ง" n={usage.discarded} />
          <Tally icon={<AlertCircle size={14} className="text-red" />} label="อ่านไม่สำเร็จ" n={usage.failed} />
          <Tally icon={<Clock size={14} className="text-text-subtle" />} label="รอตรวจ" n={usage.pending} />
        </div>
        <p className="text-label text-text-subtle">
          “ทิ้ง” ไม่ใช่ความผิดพลาดเสมอไป — แต่ถ้าสัดส่วนทิ้งสูงขึ้นเรื่อย ๆ แปลว่า AI อ่านได้ไม่ดีพอ
          ควรแก้คำสั่ง (lib/ai/extract.ts) หรือเปลี่ยนโมเดล ไม่ใช่รอให้รู้จากบิล
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-2 p-3 text-label text-text-muted flex items-start gap-2">
        <Sparkles size={14} strokeWidth={2} className="text-accent mt-0.5 shrink-0" />
        <span>
          ตัวเลขบาทเป็นค่าประมาณ แปลงจากดอลลาร์ที่ {AI_USD_THB} บาท/ดอลลาร์ (แก้ค่าได้ที่
          <span className="num"> AI_USD_THB</span> ใน lib/ai/model.ts) · ค่าใช้จ่ายจริงดูได้ที่หน้าบิลของ OpenAI ·
          สิทธิ์ว่าใครใช้ AI ได้บ้าง ตั้งที่ <span className="text-text">บทบาท &amp; สิทธิ์</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-0.5 min-w-0">
      <span className="text-label uppercase text-text-subtle">{label}</span>
      <span className="num text-h2 truncate">{value}</span>
      <span className="text-label text-text-subtle truncate">{hint}</span>
    </div>
  );
}

function Tally({ icon, label, n }: { icon: React.ReactNode; label: string; n: number }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0">{icon}</span>
      <span className="num text-body font-medium">{n}</span>
      <span className="text-label text-text-subtle truncate">{label}</span>
    </div>
  );
}
