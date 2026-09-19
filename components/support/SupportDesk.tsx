"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Upload, Check } from "lucide-react";
import type { ListingRow } from "@/lib/queries";
import { PORTALS, QUEUE_NEXT, portalLinkProblem, type PortalKey } from "@/lib/supportRules";
import { publishListing, finishPortalUpdate } from "@/lib/mutations/support";
import { ListingCopyButton } from "@/components/ListingCopyButton";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatBaht } from "@/lib/format";

/* Every write here follows the two rules the write paths learned the hard way (CLAUDE.md,
   Phase 5 #6): a server action can REJECT as well as return {ok:false}, so it is always
   wrapped in try/catch; and the row stays busy until router.refresh() has landed, or the
   next click acts on the stale render. */
function useAction() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  /** Resolves true when the write succeeded. */
  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      startRefresh(() => router.refresh());
      return true;
    } catch {
      setError("บันทึกไม่สำเร็จ — ตรวจการเชื่อมต่อแล้วลองใหม่");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy: busy || refreshing, error };
}

export type SupportKind = "new" | "update";

export function SupportDesk({
  kind,
  listings,
  staff,
}: {
  kind: SupportKind;
  listings: ListingRow[];
  staff: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      {kind === "new" && (
        <Section
          empty="ไม่มีทรัพย์รอลงประกาศ"
          hint={'ทรัพย์จะเข้าคิวนี้เมื่อเซลเปลี่ยนสถานะเป็น "Ready to Post" ในเว็บ · ต้องมีลิงก์ Livinginsider และ PropertyHub ก่อนกดลงครบ'}
          items={listings}
          render={(l) => <PublishCard key={l.listing_id} listing={l} staff={staff} />}
        />
      )}
      {kind === "update" && (
        <Section
          empty="ไม่มีประกาศรออัปเดต"
          hint={'ทรัพย์จะเข้าคิวนี้เมื่อเซลเปลี่ยนสถานะเป็น "Update" / "Sold" / "Cancel" ในเว็บ'}
          items={listings}
          render={(l) => <UpdateCard key={l.listing_id} listing={l} staff={staff} />}
        />
      )}
    </div>
  );
}

function Section<T>({
  items,
  render,
  empty,
  hint,
}: {
  items: T[];
  render: (item: T) => React.ReactNode;
  empty: string;
  hint: string;
}) {
  return (
    <>
      <p className="text-small text-text-muted">{hint}</p>
      {items.length === 0 ? (
        <Card className="p-10 text-center text-body text-text-subtle">{empty}</Card>
      ) : (
        <div className="flex flex-col gap-3">{items.map(render)}</div>
      )}
    </>
  );
}

function ListingHead({ listing, staff }: { listing: ListingRow; staff: Record<string, string> }) {
  const sale = listing.effective_sale_id ? staff[listing.effective_sale_id] ?? listing.effective_sale_id : "—";
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/listings/${listing.listing_id}`} className="text-body font-semibold text-accent-ink hover:underline num">
            {listing.listing_id}
          </Link>
          <span className="text-body font-medium text-text truncate">{listing.listing_name ?? "ไม่มีชื่อโครงการ"}</span>
          {listing.potential && listing.potential !== "Normal" && <Pill tone="amber">{listing.potential}</Pill>}
        </div>
        <div className="text-small text-text-muted mt-0.5">
          เซล {sale} · {listing.property_type ?? "—"} · {listing.zone_name_thai ?? listing.zone ?? "—"} ·{" "}
          <span className="num">{formatBaht(listing.asking_price)}</span>
        </div>
      </div>
      <div className="w-44 shrink-0">
        <ListingCopyButton listing={listing} />
      </div>
    </div>
  );
}

function PublishCard({ listing, staff }: { listing: ListingRow; staff: Record<string, string> }) {
  const { run, busy, error } = useAction();
  const [links, setLinks] = React.useState<Record<PortalKey, string>>({
    livinginsider_link: listing.livinginsider_link ?? "",
    propertyhub_link: listing.propertyhub_link ?? "",
    ddproperty_link: listing.ddproperty_link ?? "",
  });
  const problems = PORTALS.map((p) => portalLinkProblem(p.key, links[p.key])).filter(Boolean) as string[];
  const ready = PORTALS.every((p) => !p.required || links[p.key].trim()) && problems.length === 0;

  return (
    <Card className="p-4 flex flex-col gap-3">
      <ListingHead listing={listing} staff={staff} />
      <div className="grid gap-2">
        {PORTALS.map((p) => (
          <label key={p.key} className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
            <span className="text-small text-text-muted">
              {p.label}
              {p.required ? <span className="text-red"> *</span> : <span className="text-text-subtle"> (ถ้ามี)</span>}
            </span>
            <Input
              value={links[p.key]}
              onChange={(e) => setLinks((s) => ({ ...s, [p.key]: e.target.value }))}
              placeholder={`วางลิงก์ประกาศ ${p.label}`}
              disabled={busy}
              className="w-full"
            />
          </label>
        ))}
      </div>
      {(problems[0] || error) && <p className="text-small text-red">{problems[0] ?? error}</p>}
      <div className="flex justify-end">
        <Button disabled={!ready || busy} onClick={() => run(() => publishListing(listing.listing_id, links))}>
          <Upload size={15} strokeWidth={1.75} /> {busy ? "กำลังบันทึก…" : "ลงครบแล้ว → Posted"}
        </Button>
      </div>
    </Card>
  );
}

const UPDATE_LABEL: Record<string, { text: string; tone: "blue" | "green" | "red" }> = {
  Update: { text: "แก้ประกาศ", tone: "blue" },
  Sold: { text: "ขายแล้ว — ปิดประกาศ", tone: "green" },
  Cancel: { text: "ยกเลิก — ปิดประกาศ", tone: "red" },
};

function UpdateCard({ listing, staff }: { listing: ListingRow; staff: Record<string, string> }) {
  const { run, busy, error } = useAction();
  const status = listing.listing_status ?? "";
  const meta = UPDATE_LABEL[status];
  const priceChanged = listing.old_price != null && listing.new_price != null && listing.old_price !== listing.new_price;

  return (
    <Card className="p-4 flex flex-col gap-3">
      <ListingHead listing={listing} staff={staff} />
      <div className="flex flex-wrap items-center gap-2 text-small">
        {meta && <Pill tone={meta.tone}>{meta.text}</Pill>}
        {priceChanged && (
          <span className="text-text">
            ราคา <span className="num line-through text-text-subtle">{formatBaht(listing.old_price)}</span> →{" "}
            <span className="num font-semibold">{formatBaht(listing.new_price)}</span>
          </span>
        )}
        {listing.update_remark && <span className="text-text-muted">· {listing.update_remark}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {PORTALS.map((p) =>
          listing[p.key] ? (
            <a
              key={p.key}
              href={listing[p.key] as string}
              target="_blank"
              rel="noreferrer"
              className="h-7 px-2.5 rounded-md border border-border text-small text-text hover:bg-surface-2 inline-flex items-center gap-1"
            >
              {p.label} <ExternalLink size={12} />
            </a>
          ) : (
            <span key={p.key} className="h-7 px-2.5 rounded-md border border-dashed border-border text-small text-text-subtle inline-flex items-center">
              ไม่มี {p.label}
            </span>
          )
        )}
      </div>
      {error && <p className="text-small text-red">{error}</p>}
      <div className="flex justify-end">
        <Button disabled={busy} onClick={() => run(() => finishPortalUpdate(listing.listing_id, status))}>
          <Check size={15} strokeWidth={1.75} /> {busy ? "กำลังบันทึก…" : `อัปเดตแล้ว → ${QUEUE_NEXT[status] ?? "—"}`}
        </Button>
      </div>
    </Card>
  );
}
