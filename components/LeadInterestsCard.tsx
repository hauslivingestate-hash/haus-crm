"use client";

/* ทรัพย์ที่สนใจ — the units this buyer is shopping, and the place to add one.
 *
 * Was a read-only link to a single listing. `listing_code` could only be set when the lead
 * was CREATED, so a buyer who rang back about a different unit could not be recorded at all
 * — which is also why the ผู้สนใจ card on a listing was thinner than reality.
 *
 * Now backed by lead_listing_interest (many per lead). See lib/mutations/leadInterests.ts
 * for why the older single `listing_code` column still exists and what it means. */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Plus, X, LoaderCircle, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ListingCombobox } from "@/components/ListingCombobox";
import { useRbac } from "@/components/RbacProvider";
import { addLeadInterest, removeLeadInterest } from "@/lib/mutations/leadInterests";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface LeadInterest {
  listing_id: string;
  listing_name: string | null;
  asking_price: number | null;
  listing_status: string | null;
}

export function LeadInterestsCard({
  leadId,
  interests,
  /** The unit the deal is about — marked, so it is obvious which one the closing card
      prices against when a buyer is looking at several. */
  dealListing,
}: {
  leadId: string;
  interests: LeadInterest[];
  dealListing: string | null;
}) {
  const router = useRouter();
  const { can } = useRbac();
  const editable = can("leads.edit") || can("leads.assign") || can("roles.manage");

  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function add(code: string) {
    if (!code) return;
    setBusy(code);
    setError(null);
    const res = await addLeadInterest(leadId, code);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAdding(false);
    router.refresh();
  }

  async function remove(code: string) {
    setBusy(code);
    setError(null);
    const res = await removeLeadInterest(leadId, code);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ทรัพย์ที่สนใจ
          {interests.length > 1 && (
            <span className="num text-text-subtle">{interests.length}</span>
          )}
        </CardTitle>
        {editable && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-label text-text-muted hover:text-text transition-colors"
          >
            <Plus size={13} strokeWidth={2} /> เพิ่มทรัพย์
          </button>
        )}
      </CardHeader>

      {adding && (
        <div className="border-b border-border px-4 py-3">
          {/* The same picker the intake form uses, so a code that names no listing cannot
              be added from either place. */}
          <ListingCombobox value="" onPick={(code) => add(code)} placeholder="ค้นหารหัส / ชื่อโครงการ…" />
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="mt-2 text-label text-text-subtle hover:text-text transition-colors"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {error && <p className="px-4 pt-3 text-small text-red">{error}</p>}

      {interests.length === 0 ? (
        <CardContent>
          <span className="text-small text-text-subtle">ยังไม่ระบุทรัพย์ที่สนใจ</span>
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {interests.map((it) => (
              <li key={it.listing_id} className="flex items-center">
                <Link
                  href={`/listings/${it.listing_id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2">
                    <Building2 size={16} strokeWidth={1.75} className="text-text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="num text-body font-medium">{it.listing_id}</span>
                      {it.listing_id === dealListing && interests.length > 1 && (
                        <span className="rounded-full bg-accent-wash px-1.5 py-0.5 text-label font-medium text-accent">
                          ดีล
                        </span>
                      )}
                    </div>
                    <div className="truncate text-label text-text-subtle">
                      {[it.listing_name, it.listing_status].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  {it.asking_price != null && (
                    <span className="num shrink-0 text-small text-text-muted">
                      {formatBaht(it.asking_price)}
                    </span>
                  )}
                  <ArrowRight size={14} strokeWidth={1.75} className="shrink-0 text-text-subtle" />
                </Link>
                {editable && (
                  <button
                    type="button"
                    onClick={() => remove(it.listing_id)}
                    disabled={busy === it.listing_id}
                    aria-label={`เอา ${it.listing_id} ออก`}
                    className={cn(
                      "mr-2 grid size-7 shrink-0 place-items-center rounded-md text-text-subtle transition-colors",
                      "hover:bg-surface-hover hover:text-red disabled:opacity-50"
                    )}
                  >
                    {busy === it.listing_id ? (
                      <LoaderCircle size={13} className="animate-spin" />
                    ) : (
                      <X size={14} strokeWidth={1.75} />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
