"use client";

// Employee record page — VIEW + in-place EDIT (the app-wide pattern for full records).
// Mirrors the HR Sheet "Employee Lists" schema (A–AE).
//
// Phase 6 wired both halves: the record reads `main_1_hr` and Save writes it. The stub it
// replaced (console.log) was survivable while the roster was sample data and is not now —
// HR editing a real colleague's phone number would have been told nothing and lost it.
//
// Sensitive sections stay gated: money on `financials.view_comp`, PII/legal on
// `people.view_sensitive`. The gate is repeated in lib/mutations/employees.ts, because
// `update` on those columns was never revoked from `authenticated` — only `select` was.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Lock, Check, X, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { useRbac } from "@/components/RbacProvider";
import { formatDate } from "@/lib/format";
import { createEmployee, updateEmployee } from "@/lib/mutations/employees";
import { setProbation } from "@/lib/mutations/probation";
import { todayISO } from "@/lib/momentum";
import {
  employeeFullName,
  DEPARTMENT_LABEL,
  type Department,
  type Employee,
  type EmployeeStatus,
  type Gender,
} from "@/lib/team";
import { cn } from "@/lib/cn";

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const DEPARTMENTS: Department[] = ["management", "sales", "support"];
const GENDER_LABEL: Record<Gender, string> = { male: "ชาย", female: "หญิง" };

export function EmployeeRecord({
  employee,
  initialMode,
  zones = [],
}: {
  employee: Employee | null;
  initialMode: "view" | "edit";
  zones?: { code: string; name: string }[];
}) {
  const router = useRouter();
  const { can } = useRbac();
  const canMoney = can("financials.view_comp");
  const canPii = can("people.view_sensitive");
  const canManage = can("people.manage");
  const isNew = employee === null;

  const [mode, setMode] = React.useState<"view" | "edit">(initialMode);
  const [saving, setSaving] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const busy = saving || refreshing;

  const seed = React.useCallback(() => {
    const e = employee;
    return {
      code: e?.code ?? "",
      status: (e?.status ?? "active") as EmployeeStatus,
      position: e?.position ?? "",
      department: (e?.department ?? "sales") as Department,
      firstNameTh: e?.firstNameTh ?? "",
      lastNameTh: e?.lastNameTh ?? "",
      firstNameEn: e?.firstNameEn ?? "",
      lastNameEn: e?.lastNameEn ?? "",
      nickname: e?.nickname ?? "",
      gender: (e?.gender ?? "") as Gender | "",
      nationality: e?.nationality ?? "",
      birthday: e?.birthday ?? "",
      phone: e?.phone ?? "",
      phoneAlt: e?.phoneAlt ?? "",
      email: e?.email ?? "",
      workEmail: e?.workEmail ?? "",
      lineUserId: e?.lineUserId ?? "",
      startDate: e?.startDate ?? "",
      salesSheetUrl: e?.salesSheetUrl ?? "",
      remark: e?.remark ?? "",
      emergencyContact: e?.emergencyContact ?? "",
      emergencyPhone: e?.emergencyPhone ?? "",
      emergencyRelation: e?.emergencyRelation ?? "",
      salary: e?.salary != null ? String(e.salary) : "",
      commissionPct: e?.commissionRate != null ? String(e.commissionRate * 100) : "",
      idCardNo: e?.idCardNo ?? "",
      bankAccount: e?.bankAccount ?? "",
      payslipDriveUrl: e?.payslipDriveUrl ?? "",
      agreementFilesUrl: e?.agreementFilesUrl ?? "",
    };
  }, [employee]);

  const [f, setF] = React.useState(seed);
  const set = <K extends keyof ReturnType<typeof seed>>(k: K, v: ReturnType<typeof seed>[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));
  const editing = mode === "edit";
  const canSave = f.nickname.trim().length > 0;

  // Re-seed only when leaving edit mode, not on every new `employee` prop: router.refresh()
  // hands down a fresh row mid-edit and would otherwise wipe what is being typed.
  React.useEffect(() => {
    if (mode === "view") setF(seed());
  }, [mode, seed]);

  const save = async () => {
    if (!canSave || busy) return;
    // Commission is entered as a percentage and stored as a fraction (0.6 = a 60% split).
    const draft: Record<string, unknown> = {
      status: f.status,
      position: f.position,
      firstNameTh: f.firstNameTh,
      lastNameTh: f.lastNameTh,
      firstNameEn: f.firstNameEn,
      lastNameEn: f.lastNameEn,
      nickname: f.nickname,
      gender: f.gender,
      nationality: f.nationality,
      birthday: f.birthday,
      phone: f.phone,
      phoneAlt: f.phoneAlt,
      email: f.email,
      workEmail: f.workEmail,
      lineUserId: f.lineUserId,
      startDate: f.startDate,
      salesSheetUrl: f.salesSheetUrl,
      remark: f.remark,
      emergencyContact: f.emergencyContact,
      emergencyPhone: f.emergencyPhone,
      emergencyRelation: f.emergencyRelation,
      ...(canMoney
        ? {
            salary: f.salary,
            commissionRate: f.commissionPct === "" ? "" : Number(f.commissionPct) / 100,
          }
        : {}),
      ...(canPii
        ? {
            idCardNo: f.idCardNo,
            bankAccount: f.bankAccount,
            payslipDriveUrl: f.payslipDriveUrl,
            agreementFilesUrl: f.agreementFilesUrl,
          }
        : {}),
    };

    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const res = await createEmployee(draft, f.department);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        // Land on the record under the code the trigger just minted.
        router.push(`/team/${res.code}`);
      } else {
        const res = await updateEmployee(employee.code, draft);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMode("view");
        startRefresh(() => router.refresh());
      }
    } catch (e) {
      // A rejected server action is not the same as `{ok:false}` — without this the record
      // would close as though it had saved.
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (isNew) router.push("/team");
    else {
      setF(seed());
      setError(null);
      setMode("view");
    }
  };

  // Zones come from `zone_sales`, a separate many-to-many table — assigning them is not
  // part of this record's write, so they are shown but not editable here.
  const zoneNames = employee?.zoneNames ?? [];

  return (
    <div className="space-y-4">
      {/* Identity header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3 min-w-0">
          {/* No photo upload: main_1_hr has no avatar column and there is no storage bucket
              yet, so the old picker only ever produced a preview that vanished on save. */}
          <div className="relative shrink-0">
            <Avatar name={f.nickname || "?"} tone="crimson" className="h-16 w-16 text-h3" />
          </div>
          <div className="min-w-0">
            {editing ? (
              <Input
                value={f.nickname}
                onChange={(e) => set("nickname", e.target.value)}
                placeholder="ชื่อเล่น *"
                className="h-9 text-h2 font-semibold w-48"
              />
            ) : (
              <h1 className="text-h1">{f.nickname}</h1>
            )}
            <p className="text-small text-text-muted mt-0.5">
              {employeeFullName({ ...(employee ?? ({} as Employee)), firstNameTh: f.firstNameTh, lastNameTh: f.lastNameTh, firstNameEn: f.firstNameEn, lastNameEn: f.lastNameEn, nickname: f.nickname })}
              {f.code ? ` · ${f.code}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Pill tone={f.status === "active" ? "green" : "neutral"}>
                {f.status === "active" ? "ทำงานอยู่" : "พ้นสภาพ"}
              </Pill>
              {f.position && <Pill tone="neutral">{f.position}</Pill>}
              <Pill tone="neutral">{DEPARTMENT_LABEL[f.department]}</Pill>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          {editing ? (
            <>
              <Button size="sm" onClick={() => void save()} disabled={!canSave || busy}>
                <Check size={15} strokeWidth={2} /> {busy ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
              <Button variant="secondary" size="sm" onClick={cancel} disabled={busy}>
                <X size={15} strokeWidth={2} /> ยกเลิก
              </Button>
            </>
          ) : (
            canManage && (
              <Button variant="secondary" size="sm" onClick={() => setMode("edit")}>
                <Pencil size={14} strokeWidth={1.75} /> แก้ไข
              </Button>
            )
          )}
        </div>
      </div>

      {error && (
        <Card className="p-3 text-small text-red bg-red-bg/50 border-red/30">{error}</Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Role / placement */}
        <Section title="ข้อมูลงาน">
          {/* The code is generated by the set_hr_employee_code trigger from แผนก/ตำแหน่ง and
              is the key every permission runs on — not something to retype by hand. */}
          <F
            label="รหัสพนักงาน"
            view={f.code || (isNew ? "ระบบออกให้อัตโนมัติหลังบันทึก" : "—")}
            edit={false}
          >
            <span />
          </F>
          <F label="สถานะ" view={f.status === "active" ? "ทำงานอยู่" : "พ้นสภาพ"} edit={editing}>
            <select value={f.status} onChange={(e) => set("status", e.target.value as EmployeeStatus)} className={field}>
              <option value="active">ทำงานอยู่</option>
              <option value="terminated">พ้นสภาพ</option>
            </select>
          </F>
          <F label="ตำแหน่ง" view={f.position} edit={editing}>
            <Input value={f.position} onChange={(e) => set("position", e.target.value)} placeholder="เช่น Sales" />
          </F>
          {/* Department only decides the code prefix, and only at creation — changing it
              later would not (and must not) renumber an existing employee. */}
          <F label="แผนก" view={DEPARTMENT_LABEL[f.department]} edit={editing && isNew}>
            <select value={f.department} onChange={(e) => set("department", e.target.value as Department)} className={field}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>
              ))}
            </select>
          </F>
          <div className="flex flex-col gap-1.5">
            <span className="text-label text-text-muted">โซนที่ดูแล (ฝ่ายขาย)</span>
            {zoneNames.length ? (
              <div className="flex flex-wrap gap-1.5">
                {zoneNames.map((n) => (
                  <Pill key={n} tone="neutral">
                    <MapPin size={11} strokeWidth={1.75} /> {n}
                  </Pill>
                ))}
              </div>
            ) : (
              <span className="text-body text-text-subtle">—</span>
            )}
            {editing && (
              <span className="text-label text-text-subtle">
                โซนเก็บอยู่คนละตาราง (zone_sales) — แก้ที่หน้า “ตั้งค่า → โซน”
              </span>
            )}
          </div>
          <p className="text-label text-text-subtle">บทบาท/สิทธิ์ (Role) กำหนดที่หน้า “ตั้งค่า → บทบาทและสิทธิ์”</p>
        </Section>

        {/* Identity */}
        <Section title="ข้อมูลส่วนตัว">
          <Two>
            <F label="ชื่อ (ไทย)" view={f.firstNameTh} edit={editing}>
              <Input value={f.firstNameTh} onChange={(e) => set("firstNameTh", e.target.value)} />
            </F>
            <F label="นามสกุล (ไทย)" view={f.lastNameTh} edit={editing}>
              <Input value={f.lastNameTh} onChange={(e) => set("lastNameTh", e.target.value)} />
            </F>
          </Two>
          <Two>
            <F label="ชื่อ (อังกฤษ)" view={f.firstNameEn} edit={editing}>
              <Input value={f.firstNameEn} onChange={(e) => set("firstNameEn", e.target.value)} />
            </F>
            <F label="นามสกุล (อังกฤษ)" view={f.lastNameEn} edit={editing}>
              <Input value={f.lastNameEn} onChange={(e) => set("lastNameEn", e.target.value)} />
            </F>
          </Two>
          <Two>
            <F label="เพศ" view={f.gender ? GENDER_LABEL[f.gender] : ""} edit={editing}>
              <select value={f.gender} onChange={(e) => set("gender", e.target.value as Gender | "")} className={field}>
                <option value="">—</option>
                <option value="male">ชาย</option>
                <option value="female">หญิง</option>
              </select>
            </F>
            <F label="สัญชาติ" view={f.nationality} edit={editing}>
              <Input value={f.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </F>
          </Two>
          <F label="วันเกิด" view={f.birthday ? formatDate(f.birthday) : ""} edit={editing}>
            <input type="date" value={f.birthday} onChange={(e) => set("birthday", e.target.value)} className={cn(field, "w-auto")} />
          </F>
        </Section>

        {/* Contact */}
        <Section title="ติดต่อ">
          <Two>
            <F label="เบอร์โทร" view={f.phone} edit={editing}>
              <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </F>
            <F label="เบอร์สำรอง" view={f.phoneAlt} edit={editing}>
              <Input value={f.phoneAlt} onChange={(e) => set("phoneAlt", e.target.value)} />
            </F>
          </Two>
          <F label="อีเมล" view={f.email} edit={editing}>
            <Input value={f.email} onChange={(e) => set("email", e.target.value)} />
          </F>
          <F label="อีเมลงาน" view={f.workEmail} edit={editing}>
            <Input value={f.workEmail} onChange={(e) => set("workEmail", e.target.value)} />
          </F>
          <F label="LINE (User ID)" view={f.lineUserId} edit={editing}>
            <Input value={f.lineUserId} onChange={(e) => set("lineUserId", e.target.value)} />
          </F>
        </Section>

        {/* Employment */}
        <Section title="การจ้างงาน">
          <F label="วันเริ่มงาน" view={f.startDate ? formatDate(f.startDate) : ""} edit={editing}>
            <input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={cn(field, "w-auto")} />
          </F>
          {!isNew && employee.department === "sales" && (
            <ProbationControl employee={employee} canManage={canManage} />
          )}
          <F label="ลิงก์ชีทงานขาย" view={f.salesSheetUrl} edit={editing} link>
            <Input value={f.salesSheetUrl} onChange={(e) => set("salesSheetUrl", e.target.value)} placeholder="https://docs.google.com/…" />
          </F>
          <F label="หมายเหตุ" view={f.remark} edit={editing}>
            <textarea value={f.remark} onChange={(e) => set("remark", e.target.value)} rows={2} className={cn(field, "h-auto py-2 resize-none")} />
          </F>
        </Section>

        {/* Emergency */}
        <Section title="ผู้ติดต่อฉุกเฉิน">
          <Two>
            <F label="ชื่อผู้ติดต่อ" view={f.emergencyContact} edit={editing}>
              <Input value={f.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} />
            </F>
            <F label="เบอร์" view={f.emergencyPhone} edit={editing}>
              <Input value={f.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} />
            </F>
          </Two>
          <F label="ความสัมพันธ์" view={f.emergencyRelation} edit={editing}>
            <Input value={f.emergencyRelation} onChange={(e) => set("emergencyRelation", e.target.value)} />
          </F>
        </Section>

        {/* Financials — gated */}
        {canMoney ? (
          <Section title="การเงิน" locked>
            <Two>
              <F label="เงินเดือน (฿)" view={f.salary ? `฿${Number(f.salary).toLocaleString()}` : ""} edit={editing}>
                <Input value={f.salary} onChange={(e) => set("salary", e.target.value)} inputMode="numeric" />
              </F>
              <F label="คอมมิชชั่น (%)" view={f.commissionPct ? `${f.commissionPct}%` : ""} edit={editing}>
                <Input value={f.commissionPct} onChange={(e) => set("commissionPct", e.target.value)} inputMode="decimal" placeholder="เช่น 60" />
              </F>
            </Two>
          </Section>
        ) : (
          <LockedNote label="การเงิน (เงินเดือน/คอมมิชชั่น)" />
        )}

        {/* Sensitive PII — gated */}
        {canPii ? (
          <Section title="ข้อมูลอ่อนไหว" locked>
            <F label="เลขบัตรประชาชน" view={f.idCardNo} edit={editing}>
              <Input value={f.idCardNo} onChange={(e) => set("idCardNo", e.target.value)} />
            </F>
            <F label="บัญชีธนาคาร (KBANK)" view={f.bankAccount} edit={editing}>
              <Input value={f.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
            </F>
            <F label="ลิงก์สลิปเงินเดือน" view={f.payslipDriveUrl} edit={editing} link>
              <Input value={f.payslipDriveUrl} onChange={(e) => set("payslipDriveUrl", e.target.value)} placeholder="https://drive.google.com/…" />
            </F>
            <F label="ลิงก์สัญญาจ้าง" view={f.agreementFilesUrl} edit={editing} link>
              <Input value={f.agreementFilesUrl} onChange={(e) => set("agreementFilesUrl", e.target.value)} placeholder="https://drive.google.com/…" />
            </F>
          </Section>
        ) : (
          <LockedNote label="ข้อมูลอ่อนไหว (บัตร ปชช./บัญชี/สลิป/สัญญา)" />
        )}
      </div>
    </div>
  );
}

/**
 * เซลล์ใหม่ programme membership — the only way onto the /new-sales board.
 *
 * Kept out of the main edit form on purpose: it is not a field about the person, it is an
 * event ("joined the programme", "passed"), and it writes through its own action with its
 * own permission check. Ben, 2026-08-14: the programme restarts from zero, so every current
 * employee is already marked as passed and this is what enrols the next hire.
 */
function ProbationControl({ employee, canManage }: { employee: Employee; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const working = busy || refreshing;

  const inProgram = !!employee.probationStart && !employee.probationPassedAt;

  const run = async (start: string | null, passed: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const res = await setProbation(employee.code, start, passed);
      if (!res.ok) setError(res.error);
      else startRefresh(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label text-text-muted">โปรแกรมเซลล์ใหม่ (โปรเบชั่น)</span>
      <div className="flex items-center gap-2 flex-wrap">
        {inProgram ? (
          <Pill tone="accent">อยู่ในโปรแกรม · เริ่ม {formatDate(employee.probationStart!)}</Pill>
        ) : employee.probationPassedAt ? (
          <Pill tone="green">ผ่านแล้ว · {formatDate(employee.probationPassedAt)}</Pill>
        ) : (
          <span className="text-body text-text-subtle">ไม่เคยเข้าโปรแกรม</span>
        )}
        {canManage &&
          (inProgram ? (
            <button
              onClick={() => void run(employee.probationStart ?? null, todayISO())}
              disabled={working}
              className="h-8 px-3 rounded-md border border-green/30 bg-green-bg text-green text-small font-medium disabled:opacity-50"
            >
              บันทึกว่าผ่านโปรเบชั่น
            </button>
          ) : (
            <button
              onClick={() => void run(todayISO(), null)}
              disabled={working}
              className="h-8 px-3 rounded-md border border-border-strong text-text-muted text-small hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              เข้าโปรแกรมเซลล์ใหม่
            </button>
          ))}
      </div>
      {inProgram && (
        <span className="text-label text-text-subtle">
          เกณฑ์แบบ “สะสมรวม” นับกิจกรรมตั้งแต่วันเริ่มโปรแกรม · เลื่อน Rank อัตโนมัติ
        </span>
      )}
      {error && <span className="text-label text-red">{error}</span>}
    </div>
  );
}

function Section({ title, locked, children }: { title: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-1.5 px-4 pt-4 pb-2 text-small font-medium text-text-muted">
        {locked && <Lock size={12} strokeWidth={2} className="text-amber" />}
        {title}
      </div>
      <CardContent className="pt-0 space-y-3">{children}</CardContent>
    </Card>
  );
}

function Two({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

/** One field: read text in view mode, the passed input in edit mode. */
function F({
  label,
  view,
  edit,
  link,
  children,
}: {
  label: string;
  view: string;
  edit: boolean;
  link?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-label text-text-muted">{label}</span>
      {edit ? (
        children
      ) : link && view ? (
        <a href={view} target="_blank" rel="noreferrer" className="text-body text-accent hover:underline truncate">
          เปิดลิงก์
        </a>
      ) : (
        <span className="text-body text-text break-words">{view || "—"}</span>
      )}
    </label>
  );
}

function LockedNote({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2 py-4 text-small text-text-subtle">
        <Lock size={13} strokeWidth={1.75} />
        {label} — คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้
      </CardContent>
    </Card>
  );
}
