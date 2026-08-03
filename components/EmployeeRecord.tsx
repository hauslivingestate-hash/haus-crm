"use client";

// Employee record page — VIEW + in-place EDIT (the app-wide pattern for full records).
// Mirrors the HR Sheet "Employee Lists" schema (A–AE). Design phase: Save is stubbed
// (console.log, no persist). Sensitive sections gated: money on `financials.view_comp`,
// PII/legal docs on `people.view_sensitive`. See DATA_MODEL.md → HR Sheet.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Lock, Check, X, MapPin, Camera, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { useRbac } from "@/components/RbacProvider";
import { formatThaiDate } from "@/lib/format";
import { listZones } from "@/lib/zones";
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
}: {
  employee: Employee | null;
  initialMode: "view" | "edit";
}) {
  const router = useRouter();
  const { can } = useRbac();
  const canMoney = can("financials.view_comp");
  const canPii = can("people.view_sensitive");
  const canManage = can("people.manage");
  const isNew = employee === null;

  const [mode, setMode] = React.useState<"view" | "edit">(initialMode);
  const zones = listZones();

  const seed = React.useCallback(() => {
    const e = employee;
    return {
      code: e?.code ?? "",
      status: (e?.status ?? "active") as EmployeeStatus,
      position: e?.position ?? "",
      department: (e?.department ?? "sales") as Department,
      zoneCodes: e?.zoneCodes ?? [],
      firstNameTh: e?.firstNameTh ?? "",
      lastNameTh: e?.lastNameTh ?? "",
      firstNameEn: e?.firstNameEn ?? "",
      lastNameEn: e?.lastNameEn ?? "",
      nickname: e?.nickname ?? "",
      avatarUrl: e?.avatarUrl ?? "",
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

  const toggleZone = (zc: string) =>
    setF((prev) => ({
      ...prev,
      zoneCodes: prev.zoneCodes.includes(zc)
        ? prev.zoneCodes.filter((x) => x !== zc)
        : [...prev.zoneCodes, zc],
    }));

  // Avatar: design-first preview via an in-browser object URL (not persisted). Wiring =
  // upload the picked File to a storage bucket and store the returned URL in avatarUrl.
  const fileRef = React.useRef<HTMLInputElement>(null);
  const objectUrlRef = React.useRef<string | null>(null);
  const pickedFileRef = React.useRef<File | null>(null);
  const revokePreview = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };
  React.useEffect(() => revokePreview, []);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    revokePreview();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    pickedFileRef.current = file;
    set("avatarUrl", url);
  };
  const removePhoto = () => {
    revokePreview();
    pickedFileRef.current = null;
    set("avatarUrl", "");
  };

  const save = () => {
    if (!canSave) return;
    const draft = {
      ...f,
      gender: f.gender || undefined,
      ...(canMoney
        ? { salary: f.salary ? Number(f.salary) : undefined, commissionRate: f.commissionPct ? Number(f.commissionPct) / 100 : undefined }
        : {}),
      ...(canPii ? {} : { idCardNo: undefined, bankAccount: undefined, payslipDriveUrl: undefined, agreementFilesUrl: undefined }),
    };
    const avatarFile = pickedFileRef.current;
    console.log(`[stub] ${isNew ? "create" : "update"} employee (no write):`, draft, {
      avatarFile: avatarFile ? { name: avatarFile.name, size: avatarFile.size, type: avatarFile.type } : null,
    });
    if (isNew) router.push("/team");
    else setMode("view");
  };

  const cancel = () => {
    revokePreview();
    pickedFileRef.current = null;
    if (isNew) router.push("/team");
    else {
      setF(seed());
      setMode("view");
    }
  };

  const zoneNames = f.zoneCodes
    .map((c) => zones.find((z) => z.zone_id === c)?.name_thai)
    .filter((n): n is string => !!n);

  return (
    <div className="space-y-4">
      {/* Identity header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar
              name={f.nickname || "?"}
              tone="crimson"
              src={f.avatarUrl || undefined}
              className="h-16 w-16 text-h3"
            />
            {editing && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="เปลี่ยนรูปโปรไฟล์"
                  title="เปลี่ยนรูปโปรไฟล์"
                  className="absolute -bottom-1 -right-1 size-7 grid place-items-center rounded-full bg-accent text-text-onaccent border-2 border-surface hover:bg-accent-hover transition-colors"
                >
                  <Camera size={14} strokeWidth={2} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFile}
                  className="hidden"
                />
              </>
            )}
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
            {editing && f.avatarUrl && (
              <button
                type="button"
                onClick={removePhoto}
                className="mt-2 inline-flex items-center gap-1 text-label text-red hover:underline"
              >
                <Trash2 size={11} strokeWidth={1.75} /> ลบรูปโปรไฟล์
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          {editing ? (
            <>
              <Button size="sm" onClick={save} disabled={!canSave}>
                <Check size={15} strokeWidth={2} /> บันทึก
              </Button>
              <Button variant="secondary" size="sm" onClick={cancel}>
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

      {editing && (
        <p className="text-label text-text-subtle">โหมดออกแบบ: การเปลี่ยนแปลงยังไม่ถูกบันทึกจริง</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Role / placement */}
        <Section title="ข้อมูลงาน">
          <F label="รหัสพนักงาน" view={f.code} edit={editing}>
            <Input value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="เช่น S-006" />
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
          <F label="แผนก" view={DEPARTMENT_LABEL[f.department]} edit={editing}>
            <select value={f.department} onChange={(e) => set("department", e.target.value as Department)} className={field}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>
              ))}
            </select>
          </F>
          <div className="flex flex-col gap-1.5">
            <span className="text-label text-text-muted">โซนที่ดูแล (ฝ่ายขาย)</span>
            {editing ? (
              <div className="flex flex-wrap gap-1.5">
                {zones.map((z) => (
                  <button
                    key={z.zone_id}
                    type="button"
                    onClick={() => toggleZone(z.zone_id)}
                    className={cn(
                      "text-small rounded-md px-2.5 h-8 border transition-colors",
                      f.zoneCodes.includes(z.zone_id)
                        ? "bg-accent text-text-onaccent border-accent"
                        : "border-border-strong text-text-muted hover:bg-surface-2"
                    )}
                  >
                    {z.name_thai}
                  </button>
                ))}
              </div>
            ) : zoneNames.length ? (
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
          <F label="วันเกิด" view={f.birthday ? formatThaiDate(f.birthday) : ""} edit={editing}>
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
          <F label="วันเริ่มงาน" view={f.startDate ? formatThaiDate(f.startDate) : ""} edit={editing}>
            <input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={cn(field, "w-auto")} />
          </F>
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
