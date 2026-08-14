"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Pencil, Plus, Crown, Check, X, Trash2 } from "lucide-react";
import { primarySale, type Zone } from "@/lib/zones";
import type { Employee } from "@/lib/team";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { SortHeader, useSort } from "@/components/ui/SortHeader";
import { compareValues } from "@/lib/sort";
import { useRbac } from "@/components/RbacProvider";
import { createZone, renameZone, deleteZone, setZoneSales } from "@/lib/mutations/zones";
import { cn } from "@/lib/cn";

// ตั้งค่า → โซน. Phase 6: real `zone` + `zone_sales` rows, and one zone can now hold more
// than one agent — which it always could in the data (พระราม 3 = Mhow + Pup) but not in
// this screen, which showed a single "เซลส์ที่ดูแล" from a sample column that no longer
// exists. The edit pencil was disabled outright.
//
// เจ้าภาพ (is_primary) is the fallback owner for leads with no listing and listings with no
// agent, so it is called out rather than shown as just another name in the list.

const SORT_VALUE: Record<string, (z: Zone) => number | string | null> = {
  code: (z) => z.zone_id,
  name: (z) => z.name_thai,
  assigned: (z) => primarySale(z)?.nickname ?? null,
  listings: (z) => z.listingCount,
};

export function ZonesAdmin({
  zones,
  employees = [],
}: {
  zones: Zone[];
  employees?: Employee[];
}) {
  const router = useRouter();
  const { can } = useRbac();
  const canGovern = can("masterdata.govern") || can("roles.manage");

  const [q, setQ] = React.useState("");
  const { sort, onSort } = useSort();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const busy = saving || refreshing;

  // Only sales-side staff can cover a zone — the CEO included, since Stone holds three.
  const candidates = React.useMemo(
    () =>
      employees
        .filter(
          (e) =>
            e.status === "active" && (e.department === "sales" || e.department === "management")
        )
        .sort((a, b) => a.code.localeCompare(b.code)),
    [employees]
  );

  const run = React.useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          return false;
        }
        startRefresh(() => router.refresh());
        return true;
      } catch (e) {
        // A rejected action would otherwise leave the row looking saved.
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  const query = q.trim().toLowerCase();
  const filtered = zones.filter(
    (z) =>
      !query ||
      z.zone_id.toLowerCase().includes(query) ||
      z.name_thai.toLowerCase().includes(query) ||
      z.name_eng.toLowerCase().includes(query) ||
      z.sales.some((s) => s.nickname.toLowerCase().includes(query))
  );
  const sortFn = SORT_VALUE[sort.key];
  const list = sortFn
    ? [...filtered].sort((a, b) => compareValues(sortFn(a), sortFn(b), sort.dir))
    : filtered;

  const covered = zones.filter((z) => z.sales.length > 0).length;

  return (
    <div className="flex flex-col gap-3">
      {error && <Card className="p-3 text-small text-red bg-red-bg/50 border-red/30">{error}</Card>}

      <Card>
        <div className="flex items-center gap-2.5 p-3 border-b border-border flex-wrap">
          <div className="relative w-full sm:w-auto">
            <Search
              size={14}
              strokeWidth={1.75}
              className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาโซน / รหัส / เซลส์…"
              className="w-full sm:w-64 pl-8"
            />
          </div>
          <div className="text-small text-text-subtle ml-auto">
            มีเซลดูแลแล้ว <span className="num text-text-muted">{covered}</span>/
            <span className="num">{zones.length}</span> โซน
          </div>
          {canGovern && (
            <Button size="sm" onClick={() => setCreating((v) => !v)} disabled={busy}>
              <Plus size={15} strokeWidth={2} /> เพิ่มโซน
            </Button>
          )}
        </div>

        {creating && canGovern && (
          <NewZoneForm
            busy={busy}
            onCancel={() => setCreating(false)}
            onCreate={async (code, th, en) => {
              const ok = await run(() => createZone(code, th, en));
              if (ok) setCreating(false);
            }}
          />
        )}

        {list.length === 0 ? (
          <div className="p-10 text-center text-small text-text-subtle">ไม่พบโซน</div>
        ) : (
          <CardContent className="p-0">
            <Table className="min-w-[720px]">
              <THead>
                <TR>
                  <SortHeader label="รหัส" sortKey="code" sort={sort} onSort={onSort} />
                  <SortHeader label="ชื่อโซน" sortKey="name" sort={sort} onSort={onSort} />
                  <TH>ชื่ออังกฤษ</TH>
                  <SortHeader label="เซลส์ที่ดูแล" sortKey="assigned" sort={sort} onSort={onSort} />
                  <SortHeader label="ทรัพย์" sortKey="listings" sort={sort} onSort={onSort} align="right" />
                  {canGovern && <TH className="text-right">จัดการ</TH>}
                </TR>
              </THead>
              <TBody>
                {list.map((z) =>
                  editing === z.zone_id ? (
                    <TR key={z.zone_id}>
                      <TD colSpan={canGovern ? 6 : 5} className="p-0">
                        <ZoneEditor
                          zone={z}
                          candidates={candidates}
                          busy={busy}
                          onClose={() => setEditing(null)}
                          onSave={async (th, en, codes, primary) => {
                            const renamed =
                              th !== z.name_thai || en !== z.name_eng
                                ? await run(() => renameZone(z.zone_id, th, en))
                                : true;
                            if (!renamed) return;
                            const ok = await run(() => setZoneSales(z.zone_id, codes, primary));
                            if (ok) setEditing(null);
                          }}
                          onDelete={async () => {
                            const ok = await run(() => deleteZone(z.zone_id));
                            if (ok) setEditing(null);
                          }}
                        />
                      </TD>
                    </TR>
                  ) : (
                    <TR key={z.zone_id}>
                      <TD>
                        <span className="num font-medium">{z.zone_id}</span>
                      </TD>
                      <TD className="font-medium">{z.name_thai}</TD>
                      <TD className="text-small text-text-muted">{z.name_eng || "—"}</TD>
                      <TD>
                        {z.sales.length ? (
                          <div className="flex flex-wrap gap-1">
                            {z.sales.map((s) => (
                              <Pill key={s.code} tone={s.isPrimary ? "accent" : "neutral"}>
                                {s.isPrimary && <Crown size={11} strokeWidth={2} />}
                                {s.nickname}
                              </Pill>
                            ))}
                          </div>
                        ) : (
                          <Pill tone="amber">ยังไม่มอบหมาย</Pill>
                        )}
                      </TD>
                      <TD className="num text-right text-text-muted">{z.listingCount}</TD>
                      {canGovern && (
                        <TD className="text-right">
                          <button
                            onClick={() => setEditing(z.zone_id)}
                            disabled={busy}
                            aria-label={`แก้ไขโซน ${z.name_thai}`}
                            className="inline-grid place-items-center size-7 rounded-md text-text-muted hover:bg-surface-2 hover:text-text transition-colors disabled:opacity-50"
                          >
                            <Pencil size={14} strokeWidth={1.75} />
                          </button>
                        </TD>
                      )}
                    </TR>
                  )
                )}
              </TBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <p className="text-label text-text-subtle">
        <Crown size={11} strokeWidth={2} className="inline text-accent" /> = เจ้าภาพโซน (โซนละ 1
        คน) ใช้เป็นผู้ดูแลสำรองเมื่อทรัพย์ยังไม่ระบุเซล หรือลีดไม่ได้ระบุทรัพย์ ·
        ผู้ดูแลตัวจริงของทรัพย์แต่ละหลังตั้งที่หน้าทรัพย์
      </p>
    </div>
  );
}

function NewZoneForm({
  busy,
  onCreate,
  onCancel,
}: {
  busy: boolean;
  onCreate: (code: string, nameThai: string, nameEng: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = React.useState("");
  const [th, setTh] = React.useState("");
  const [en, setEn] = React.useState("");
  return (
    <div className="p-3 border-b border-border bg-surface-2/50 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-label text-text-muted">รหัส</span>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="เช่น RM4"
          className="w-28 num"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-label text-text-muted">ชื่อโซน (ไทย)</span>
        <Input value={th} onChange={(e) => setTh(e.target.value)} className="w-44" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-label text-text-muted">ชื่ออังกฤษ</span>
        <Input value={en} onChange={(e) => setEn(e.target.value)} className="w-44" />
      </label>
      <Button size="sm" onClick={() => onCreate(code, th, en)} disabled={busy || !code || !th}>
        <Check size={15} strokeWidth={2} /> เพิ่ม
      </Button>
      <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
        ยกเลิก
      </Button>
      <p className="text-label text-text-subtle basis-full">
        รหัสโซนกลายเป็นส่วนหนึ่งของรหัสทรัพย์ (เช่น C<span className="text-text-muted">ASK</span>
        020) — ตั้งแล้วเปลี่ยนไม่ได้ และห้ามเป็นคำนำหน้าของรหัสโซนอื่น
      </p>
    </div>
  );
}

function ZoneEditor({
  zone,
  candidates,
  busy,
  onSave,
  onClose,
  onDelete,
}: {
  zone: Zone;
  candidates: Employee[];
  busy: boolean;
  onSave: (nameThai: string, nameEng: string, codes: string[], primary: string | null) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [th, setTh] = React.useState(zone.name_thai);
  const [en, setEn] = React.useState(zone.name_eng);
  const [codes, setCodes] = React.useState<string[]>(zone.sales.map((s) => s.code));
  const [primary, setPrimary] = React.useState<string | null>(primarySale(zone)?.code ?? null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const toggle = (code: string) =>
    setCodes((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      // Dropping the เจ้าภาพ from the zone must clear the flag too, or the save is rejected.
      if (!next.includes(code) && primary === code) setPrimary(null);
      return next;
    });

  return (
    <div className="p-4 bg-surface-2/50 border-y border-border flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-label text-text-muted">รหัส</span>
          <span className="num h-9 inline-flex items-center px-3 rounded-md border border-border bg-surface-2 text-text-subtle">
            {zone.zone_id}
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label text-text-muted">ชื่อโซน (ไทย)</span>
          <Input value={th} onChange={(e) => setTh(e.target.value)} className="w-44" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label text-text-muted">ชื่ออังกฤษ</span>
          <Input value={en} onChange={(e) => setEn(e.target.value)} className="w-44" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-label text-text-muted">
          เซลส์ที่ดูแลโซนนี้ — เลือกได้หลายคน · แตะ <Crown size={11} strokeWidth={2} className="inline" />{" "}
          เพื่อตั้งเป็นเจ้าภาพ
        </span>
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((e) => {
            const on = codes.includes(e.code);
            const isPrimary = primary === e.code;
            return (
              <span key={e.code} className="inline-flex">
                <button
                  type="button"
                  onClick={() => toggle(e.code)}
                  className={cn(
                    "text-small h-8 px-2.5 border transition-colors",
                    on ? "rounded-l-md" : "rounded-md",
                    on
                      ? "bg-accent text-text-onaccent border-accent"
                      : "border-border-strong text-text-muted hover:bg-surface-2"
                  )}
                >
                  {e.nickname}
                  <span className="num text-label opacity-70 ml-1">{e.code}</span>
                </button>
                {on && (
                  <button
                    type="button"
                    onClick={() => setPrimary(isPrimary ? null : e.code)}
                    aria-label={`ตั้ง ${e.nickname} เป็นเจ้าภาพโซน`}
                    className={cn(
                      "h-8 px-2 rounded-r-md border border-l-0 transition-colors",
                      isPrimary
                        ? "bg-amber-bg text-amber border-amber/40"
                        : "border-border-strong text-text-subtle hover:bg-surface-2"
                    )}
                  >
                    <Crown size={13} strokeWidth={2} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => onSave(th, en, codes, primary)} disabled={busy || !th.trim()}>
          <Check size={15} strokeWidth={2} /> {busy ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
          <X size={15} strokeWidth={2} /> ยกเลิก
        </Button>
        {/* Deleting is blocked server-side while listings reference the zone; saying so
            here saves a pointless round trip. */}
        {zone.listingCount === 0 ? (
          confirmDelete ? (
            <button
              onClick={onDelete}
              disabled={busy}
              className="ml-auto h-8 px-3 rounded-md border border-red/30 bg-red-bg text-red text-small font-medium inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 size={13} strokeWidth={2} /> ยืนยันลบโซนนี้
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="ml-auto h-8 px-3 rounded-md border border-border-strong text-text-muted text-small inline-flex items-center gap-1 hover:bg-red-bg hover:text-red hover:border-red/30 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} strokeWidth={1.75} /> ลบโซน
            </button>
          )
        ) : (
          <span className="ml-auto text-label text-text-subtle">
            ลบไม่ได้ — มีทรัพย์ <span className="num">{zone.listingCount}</span> รายการอยู่ในโซนนี้
          </span>
        )}
      </div>
    </div>
  );
}
