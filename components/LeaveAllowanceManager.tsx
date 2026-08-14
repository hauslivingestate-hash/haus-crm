"use client";

import * as React from "react";
import { AlertTriangle, Infinity as InfinityIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { useLeave } from "@/components/LeaveProvider";
import { overQuota } from "@/lib/leave";
import { setLeaveAllowance } from "@/lib/mutations/leave";
import { todayISO } from "@/lib/momentum";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

// ตั้งค่า → โควตาวันลา. Annual days per LEAVE TYPE — deliberately per-type, since
// ลาพักร้อน / ลาป่วย / ลากิจ have different statutory limits and maternity/sterilisation
// aren't drawn from an annual pool at all.
//
// The seeded numbers are Thai statutory MINIMUMS used as placeholders, not this company's
// policy — the banner says so, loudly, because a quota people trust and act on must not be
// a guess. Blank = untracked (no quota enforced).
export function LeaveAllowanceManager() {
  const { allowances, requests } = useLeave();
  const router = useRouter();
  const year = todayISO().slice(0, 4);
  const breaches = overQuota(requests, allowances, year);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Typing shows immediately; the row is written when the field loses focus, so a quota
  // isn't saved half-typed ("1" on the way to "15").
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  // Only an EMPTY field means "unlimited". A non-numeric keystroke used to fall through to
  // null, silently switching an enforced quota off and emptying the breach list — the exact
  // failure this screen exists to prevent. Garbage input is now ignored instead.
  const commit = async (type: string, raw: string) => {
    const trimmed = raw.trim();
    let next: number | null;
    if (trimmed === "") {
      next = null; // explicit "no annual quota"
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        setDraft((d) => {
          const { [type]: _drop, ...rest } = d;
          return rest; // reject, snap back to the saved value
        });
        return;
      }
      next = Math.round(n);
    }
    const before = allowances.find((a) => a.type === type)?.daysPerYear ?? null;
    if (before === next) return;

    setBusy(true);
    setError(null);
    try {
      const res = await setLeaveAllowance(type, next);
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="px-4 py-3 border-b border-border">
          <div className="text-h3">โควตาวันลาต่อปี</div>
          <p className="text-label text-text-subtle mt-0.5">
            เว้นว่าง = ไม่จำกัดโควตา (เช่น ลาคลอด ลาเพื่อทำหมัน)
          </p>
        </div>
        <CardContent className="flex flex-col gap-2">
          {allowances.map((a) => (
            <div key={a.type} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-body">{a.type}</div>
                {a.note && <div className="text-label text-text-subtle">{a.note}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  value={draft[a.type] ?? (a.daysPerYear == null ? "" : String(a.daysPerYear))}
                  onChange={(e) => setDraft((d) => ({ ...d, [a.type]: e.target.value }))}
                  onBlur={(e) => void commit(a.type, e.target.value)}
                  disabled={busy}
                  inputMode="numeric"
                  placeholder="—"
                  className="w-20 num text-right disabled:opacity-50"
                />
                <span className="text-small text-text-subtle w-16">
                  {a.daysPerYear == null ? (
                    <span className="inline-flex items-center gap-1">
                      <InfinityIcon size={13} strokeWidth={1.75} /> ไม่จำกัด
                    </span>
                  ) : (
                    "วัน/ปี"
                  )}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red/30 bg-red-bg/50 px-3.5 py-2.5 text-small text-red">
          {error}
        </div>
      )}

      {/* Placeholder warning — the single most important thing on this screen. */}
      <div className="rounded-md border border-amber/30 bg-amber-bg/40 px-3.5 py-3 flex items-start gap-2.5">
        <AlertTriangle size={15} strokeWidth={1.75} className="text-amber mt-0.5 shrink-0" />
        <div className="text-small text-text-muted">
          <span className="font-medium text-text">ตัวเลขนี้เป็นค่าตั้งต้น ไม่ใช่นโยบายบริษัท</span> —
          ใส่ไว้เป็นขั้นต่ำตามกฎหมายแรงงานเท่านั้น กรุณาให้ HR ยืนยันจำนวนวันจริงของแต่ละประเภท
          รวมถึงว่าวันลาที่เหลือ<span className="text-text">ทบไปปีถัดไป</span>ได้ไหม
          และพนักงาน<span className="text-text">ปีแรก</span>ได้เท่าไหร่
        </div>
      </div>

      {/* Who this quota would already flag — makes the consequence concrete before saving. */}
      <Card>
        <div className="px-4 py-3 border-b border-border">
          <div className="text-h3">เกินโควตาปี {Number(year) + 543}</div>
          <p className="text-label text-text-subtle mt-0.5">
            คำนวณจากใบลาที่อนุมัติแล้ว ตามตัวเลขด้านบน
          </p>
        </div>
        <CardContent>
          {breaches.length === 0 ? (
            <p className="text-small text-text-subtle">ไม่มีใครเกินโควตา</p>
          ) : (
            <div className="flex flex-col gap-2">
              {breaches.map((b) => (
                <div key={b.employeeId} className="flex items-center gap-2 flex-wrap">
                  <span className="text-body font-medium w-16 shrink-0">{b.nickname}</span>
                  {b.rows.map((r) => (
                    <Pill key={r.type} tone="red">
                      {r.type} <span className={cn("num")}>{r.used}</span>/{r.allowance}
                    </Pill>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
