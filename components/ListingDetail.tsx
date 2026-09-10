/* Everything a listing's detail view shows. Rendered in two places and only two:

     app/(app)/listings/[id]/page.tsx              → the full page (cold link, refresh)
     app/(app)/listings/@drawer/(.)[id]/page.tsx   → the slide-over (a click from the list)

   Same arrangement as components/LeadDetail.tsx, and for the same reason: a drawer that
   is a hand-copied subset of a page drifts from it. `inDrawer` changes the SHAPE only —
   the 320px sidebar stacks instead of sitting beside the main column. Photos, checklist,
   owner card and agreement are all here either way; the drawer is wider than the lead's
   to give them room. */

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Bed,
  Bath,
  Maximize,
  MapPin,
  Tag,
  KeyRound,
  Landmark,
  ChevronRight,
  Car,
  Ruler,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Dot";
import { Pill } from "@/components/ui/Pill";
import { ListingOwnerCard } from "@/components/ListingOwnerCard";
import { ListingEditButton } from "@/components/ListingEditSheet";
import { ExclusiveAgreementCard } from "@/components/ExclusiveAgreementCard";
import { ListingChecklist } from "@/components/ListingChecklist";
import { ListingTimeline } from "@/components/ListingTimeline";
import { ListingManageCard } from "@/components/ListingManageCard";
import { ListingInterestedLeads } from "@/components/ListingInterestedLeads";
import { ListingCopyButton } from "@/components/ListingCopyButton";
import {
  getListing,
  getProject,
  getNicknameByAuthId,
  getStaffDirectory,
  getListingTimeline,
  getActionTypes,
  getInterestedLeads,
  getListingPhotos,
  getListingChecklistProgress,
  getRoleOptions,
} from "@/lib/queries";
import { ListingPhotoManager } from "@/components/ListingPhotoManager";
import { getAuthContext } from "@/lib/auth";
import {
  formatBaht,
  formatRent,
  formatNumber,
  formatDate,
  formatLandArea,
  daysOnMarketLabel,
  dealType,
} from "@/lib/format";
import { listingStatusDot, potentialTone } from "@/lib/status";
import { cn } from "@/lib/cn";

const DEAL_LABEL: Record<string, string> = {
  sale: "ขาย",
  rent: "เช่า",
  both: "ขาย + เช่า",
  none: "—",
};

export async function ListingDetail({ id, inDrawer = false }: { id: string; inDrawer?: boolean }) {
  const listing = await getListing(id);
  if (!listing) notFound();

  const deal = dealType(listing.asking_price, listing.rental_price);
  // Resolve by the FK, not by matching the project's English name: the source sheet put
  // Thai names in the English column often enough that a name match found 1 of 508 rows.
  const project = await getProject(listing.project_id);
  const creatorName = await getNicknameByAuthId(listing.created_by);

  // Who manages this listing, resolved from the real FK — and whether that is the viewer.
  // Decided here rather than in the card, so the owner-contact gate is computed from the
  // session's employee code instead of a display-name comparison in the browser.
  const auth = await getAuthContext();
  const staff = await getStaffDirectory();
  const managingAgent =
    staff.find((s) => s.code === listing.effective_sale_id) ?? null;
  const isManager =
    !!auth?.employeeCode && auth.employeeCode === listing.effective_sale_id;
  const [timeline, actionTypes, interested] = await Promise.all([
    getListingTimeline(listing.listing_id),
    getActionTypes(),
    getInterestedLeads(listing.listing_id),
  ]);
  // Only actions that mean something on a property — the action_type table's own `attach`
  // column decides, so a new one added in ตั้งค่า appears here without a code change.
  const listingActions = actionTypes
    .filter((a) => a.attach === "listing" || a.attach === "either")
    .map((a) => a.name);
  // employee_code → nickname, resolved once here rather than per row in the client.
  const nicknameOf: Record<string, string> = Object.fromEntries(
    staff.map((s) => [s.code, s.nickname ?? s.code])
  );
  const photos = await getListingPhotos(listing.listing_id);
  // Same set the photo table's own policies ask for.
  const canEditPhotos = !!auth?.permissions.some((p) =>
    ["listings.edit", "listings.marketing", "listings.create", "roles.manage"].includes(p)
  );

  // Checklist progress + the role roster for its responsibility chips. Loaded here rather
  // than in a layout provider: holding every listing's ticks app-wide would mean fetching the
  // whole company's checklist state on every page.
  const [checklistProgress, roleOptions] = await Promise.all([
    getListingChecklistProgress(listing.listing_id),
    getRoleOptions(),
  ]);
  // Same set the checklist table's own policies ask for. Checklist work is cross-team, so
  // this is deliberately wider than "the agent who owns this listing".
  const canEditChecklist = !!auth?.permissions.some((p) =>
    ["listings.edit", "listings.marketing", "checklists.manage", "roles.manage"].includes(p)
  );

  // Price move (Listings cols J → K). Only meaningful when BOTH sides are present.
  const hasPriceMove = listing.old_price != null && listing.new_price != null;
  const priceDelta =
    hasPriceMove && listing.old_price
      ? ((listing.new_price! - listing.old_price) / listing.old_price) * 100
      : null;

  // Portal listings. `propertyhub_link` is the view's name for the sheet's "Facebook Link"
  // column, which holds PropertyHub URLs in practice (see DATA_MODEL.md §1).
  const PORTALS = [
    { name: "DDproperty", url: listing.ddproperty_link, date: null as string | null },
    { name: "Livinginsider", url: listing.livinginsider_link, date: listing.livinginsider_date },
    { name: "PropertyHub", url: listing.propertyhub_link, date: null as string | null },
  ];
  const postedCount = PORTALS.filter((p) => p.url).length;

  return (
    <div className={cn("space-y-4", inDrawer ? "p-4 lg:p-5" : "p-4 lg:p-6")}>
        {/* Identity header — inline block (Shelter-style). Stacks on mobile. The right
            padding in the drawer clears the floating ✕ over this corner. */}
        <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", inDrawer && "pr-11")}>
          <div className="min-w-0">
            <div className="num text-[11px] text-text-subtle">
              {listing.listing_id} · {listing.property_type ?? "—"} · {DEAL_LABEL[deal]}
            </div>
            <h1 className="text-h1">{listing.listing_name ?? listing.listing_id}</h1>
            <p className="text-small text-text-muted mt-0.5 inline-flex items-center gap-1">
              <MapPin size={12} strokeWidth={1.75} />
              {listing.zone_name_thai ?? "—"}
              {listing.zone && <span className="num text-text-subtle ml-1">{listing.zone}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            {listing.potential && (
              <Pill tone={potentialTone(listing.potential)}>{listing.potential}</Pill>
            )}
            <StatusBadge color={listingStatusDot(listing.listing_status)}>
              {listing.listing_status ?? "—"}
            </StatusBadge>
            <ListingEditButton listing={listing} />
          </div>
        </div>

        <div
          className={cn(
            "grid grid-cols-1 gap-4 items-start",
            !inDrawer && "lg:grid-cols-[1fr_320px]"
          )}
        >
          {/* Main column */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Photos — real uploads (Supabase Storage), 20 max. The stock images that
                used to sit here showed a house that was not this house, with nothing
                saying so.

                FIRST CARD, above the status pills (Ben, 2026-09-10): you recognise a
                property by the picture, so it comes before anything you might change
                about it. */}
            <ListingPhotoManager
              listingId={listing.listing_id}
              photos={photos}
              canEdit={canEditPhotos}
            />

            {/* Owner pipeline + advert status, one tap each. */}
            <ListingManageCard
              listingId={listing.listing_id}
              ownerStage={listing.owner_stage}
              listingStatus={listing.listing_status}
            />

            {/* Spec strip */}
            <Card>
              <CardContent className="flex items-center gap-6 flex-wrap">
                <Spec icon={Bed} label="นอน" value={listing.bed != null ? String(listing.bed) : "—"} />
                <Spec icon={Bath} label="น้ำ" value={listing.bath != null ? String(listing.bath) : "—"} />
                <Spec
                  icon={Maximize}
                  label="พื้นที่ใช้สอย"
                  value={listing.area_sqm ? `${formatNumber(listing.area_sqm)} ตร.ม.` : "—"}
                />
                <Spec
                  icon={Car}
                  label="จอดรถ"
                  value={listing.parking != null ? `${listing.parking} คัน` : "—"}
                />
              </CardContent>
            </Card>

            {/* Full property spec — the rest of the Listings sheet's spec block. Rows with no
                value are dropped entirely rather than rendered as dashes. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ruler size={16} strokeWidth={1.75} className="text-text-muted" />
                  ข้อมูลทรัพย์
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-small">
                <Field label="ที่ดิน" value={formatLandArea(listing.area_rai, listing.area_ngan, listing.area_wa)} />
                <Field label="บ้านเลขที่ / ยูนิต" value={listing.unit_no} />
                <Field label="ชั้น" value={listing.floor} />
                <Field label="อาคาร" value={listing.building} />
                <Field label="ทิศ" value={listing.direction} />
                <Field label="วิว" value={listing.view_type} />
                <Field label="ตำแหน่ง" value={listing.unit_position} />
                <Field label="สภาพห้อง" value={listing.unit_condition} />
                <Field label="ใน/นอกโครงการ" value={listing.in_out_project} />
                <Field label="ถนน / ซอย" value={listing.road_soi} />
              </CardContent>
              {listing.remark && (
                <div className="px-4 pb-4">
                  <div className="text-label text-text-subtle mb-1">หมายเหตุ</div>
                  <p className="text-small text-text-muted whitespace-pre-line">{listing.remark}</p>
                </div>
              )}
            </Card>

            {/* Price cards — the absent deal type is dimmed */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className={cn(listing.asking_price == null && "opacity-50")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag size={16} strokeWidth={1.75} className="text-accent" />
                    ราคาขาย
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {listing.asking_price != null ? (
                    <div className="num text-h1 text-accent">{formatBaht(listing.asking_price)}</div>
                  ) : (
                    <div className="text-small text-text-subtle">ไม่ได้ลงขาย</div>
                  )}
                </CardContent>
              </Card>
              <Card className={cn(listing.rental_price == null && "opacity-50")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound size={16} strokeWidth={1.75} className="text-violet" />
                    ค่าเช่า
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {listing.rental_price != null ? (
                    <div className="num text-h1 text-violet">{formatRent(listing.rental_price)}</div>
                  ) : (
                    <div className="text-small text-text-subtle">ไม่ได้ลงเช่า</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Price history — Listings cols J/K/L + AR. Rendered only when there is
                something to show, so untouched listings don't grow an empty card. */}
            {(hasPriceMove || listing.price_remark) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown size={16} strokeWidth={1.75} className="text-text-muted" />
                    ประวัติราคา
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-small">
                  {hasPriceMove && (
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="num text-text-subtle line-through">
                        {formatBaht(listing.old_price)}
                      </span>
                      <ArrowRight size={14} strokeWidth={1.75} className="text-text-subtle shrink-0" />
                      <span className="num text-body font-semibold">{formatBaht(listing.new_price)}</span>
                      {priceDelta != null && (
                        <Pill tone={priceDelta < 0 ? "green" : "amber"}>
                          {priceDelta < 0 ? "ลด" : "เพิ่ม"} {Math.abs(priceDelta).toFixed(1)}%
                        </Pill>
                      )}
                    </div>
                  )}
                  {listing.update_remark && (
                    <p className="text-text-muted whitespace-pre-line">{listing.update_remark}</p>
                  )}
                  {listing.price_remark && (
                    <div className="border-t border-border pt-2.5">
                      <div className="text-label text-text-subtle mb-0.5">เงื่อนไขราคา</div>
                      <p className="text-text-muted whitespace-pre-line">{listing.price_remark}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* กิจกรรม & ประวัติ — the activity log and the audit trail, in one card.
                These were two (กิจกรรมล่าสุด + a ประวัติการแก้ไข placeholder wired to
                nothing) until Ben pointed out they answer the same question. */}
            <ListingTimeline
              listingId={listing.listing_id}
              dateCreated={listing.date_created}
              activities={timeline.activities}
              audits={timeline.audits}
              auditReadable={timeline.auditReadable}
              actionTypes={listingActions}
              ownerStage={listing.owner_stage}
              nicknameOf={nicknameOf}
            />

            {/* ผู้สนใจ — real, from main_6_buyer_crm.listing_code. Was a "เร็ว ๆ นี้"
                placeholder that had never shown anything, while 977 leads across 251
                listings already carried the link it needed. */}
            <ListingInterestedLeads leads={interested} nicknameOf={nicknameOf} />
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* At-a-glance details (real data) */}
            <Card>
              <CardHeader>
                <CardTitle>รายละเอียด</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-small">
                <Row label="สถานะประกาศ">
                  <StatusBadge color={listingStatusDot(listing.listing_status)}>
                    {listing.listing_status ?? "—"}
                  </StatusBadge>
                </Row>
                <Row label="Potential">
                  {listing.potential ? (
                    <Pill tone={potentialTone(listing.potential)}>{listing.potential}</Pill>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </Row>
                <Row label="ทำเล">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} strokeWidth={1.75} className="text-text-subtle" />
                    {listing.zone_name_thai ?? "—"}
                    {listing.zone && <span className="num text-text-subtle">{listing.zone}</span>}
                  </span>
                </Row>
                <Row label="ประเภทประกาศ">
                  <span>{listing.listing_type ?? "—"}</span>
                </Row>
                <Row label="ลงประกาศ">
                  <span className="num">{daysOnMarketLabel(listing.days_on_market)}</span>
                </Row>
                <Row label="วันที่สร้าง">
                  <span className="num">{formatDate(listing.date_created)}</span>
                </Row>
                {/* `created_by` holds an auth.users uuid, and every one of the 511 imported
                    rows holds the SAME one (the admin the import ran as) — it was being
                    printed raw. Relabelled too: this is who filed the record, not who
                    manages the property; the manager has its own card above. */}
                <Row label="ผู้สร้างรายการ">
                  <span>{creatorName ?? "—"}</span>
                </Row>
                {listing.owner_focus && (
                  <Row label="Owner Focus">
                    <Pill tone="amber">ติดตามเจ้าของ</Pill>
                  </Row>
                )}
              </CardContent>
            </Card>

            {/* Exclusive agreement window — renders only for Exclusive listings (null otherwise) */}
            <ExclusiveAgreementCard
              listingId={listing.listing_id}
              potential={listing.potential}
              agreement={{
                start: listing.agreement_start ?? null,
                end: listing.agreement_end ?? null,
              }}
              canEdit={canEditChecklist}
            />

            {/* Project knowledge — links to the full project page */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark size={16} strokeWidth={1.75} className="text-text-muted" />
                  โครงการ
                </CardTitle>
              </CardHeader>
              {project ? (
                <Link href={`/projects/${project.id}`} className="block group">
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-body font-medium truncate group-hover:text-accent transition-colors">
                          {project.name_thai}
                        </div>
                        <div className="text-small text-text-subtle truncate">{project.name_eng}</div>
                      </div>
                      <ChevronRight
                        size={16}
                        strokeWidth={1.75}
                        className="text-text-subtle group-hover:text-accent transition-colors shrink-0"
                      />
                    </div>
                    {(project.pros || project.cons) && (
                      <div className="flex flex-col gap-1 text-small border-t border-border pt-2.5">
                        {project.pros && (
                          <span className="text-text-muted line-clamp-1">
                            <span className="text-green">+</span> {project.pros}
                          </span>
                        )}
                        {project.cons && (
                          <span className="text-text-muted line-clamp-1">
                            <span className="text-red">−</span> {project.cons}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              ) : (
                <div className="p-4 text-small text-text-subtle">
                  {listing.project_name_eng ?? "ไม่ระบุโครงการ"}
                </div>
              )}
            </Card>

            {/* Owner (real data) — contact is PRIVATE: gated to contacts.view_all or the
                managing agent; everyone else sees the managing agent's contact for Co-Agent. */}
            <ListingOwnerCard
              ownerName={listing.owner_name}
              ownerPhone={listing.owner_phone}
              ownerLine={listing.owner_line}
              ownerTalkLastDate={listing.owner_talk_last_date}
              activityComment={listing.activity_comment}
              agent={managingAgent}
              isManager={isManager}
            />

            {/* Marketing — REAL data now (portal links + media + sign/VDO flags all come
                from v_main_listing). The DD/LV Boost, FB Repost and Marketing Report fields
                are still missing from the view; see CEO_FEEDBACK_R1.md §2.3. */}
            <Card>
              <CardHeader>
                <CardTitle>การตลาด</CardTitle>
                <span className="num text-label text-text-subtle">
                  {postedCount}/{PORTALS.length} พอร์ทัล
                </span>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5 text-small">
                {/* Ad-copy generator (คำประกาศโฆษณา) — live template fill */}
                <ListingCopyButton listing={listing} />

                <div className="border-t border-border pt-2.5 flex flex-col gap-2">
                  {PORTALS.map(({ name, url, date }) => (
                    <div key={name} className="flex items-center justify-between gap-2">
                      <span className={cn(url ? "text-text-muted" : "text-text-subtle")}>{name}</span>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline shrink-0"
                        >
                          {date ? <span className="num text-label">{formatDate(date)}</span> : "ดูประกาศ"}
                          <ExternalLink size={11} strokeWidth={1.75} />
                        </a>
                      ) : (
                        <span className="text-text-subtle shrink-0">ยังไม่ลง</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Media assets + physical marketing */}
                <div className="border-t border-border pt-2.5 flex flex-wrap gap-1.5">
                  <MarketingFlag on={listing.sign} label="ป้าย" />
                  <MarketingFlag on={listing.vdo} label="วิดีโอ" />
                  <MediaLink href={listing.shorts_reels_link} label="Reels" />
                  <MediaLink href={listing.hometour_link} label="Hometour" />
                  <MediaLink href={listing.link_location} label="แผนที่" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Value-add checklist — full-width, last block. A-List / Exclusive only (null otherwise). */}
        <ListingChecklist
          listingId={listing.listing_id}
          potential={listing.potential}
          progress={checklistProgress}
          roles={roleOptions}
          canEdit={canEditChecklist}
        />
    </div>
  );
}

function Spec({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="size-9 rounded-md bg-surface-2 grid place-items-center">
        <Icon size={16} strokeWidth={1.75} className="text-text-muted" />
      </div>
      <div>
        <div className="text-body font-semibold num">{value}</div>
        <div className="text-label text-text-subtle">{label}</div>
      </div>
    </div>
  );
}

/** Spec row that renders nothing when the value is missing — keeps sparse listings clean. */
function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0">
      <div className="text-label text-text-subtle">{label}</div>
      <div className="text-small truncate">{value}</div>
    </div>
  );
}

/** Boolean marketing flag (ป้าย / วิดีโอ) — green when done, muted when not. */
function MarketingFlag({ on, label }: { on: boolean | null; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-label border",
        on
          ? "bg-green-bg text-green border-green/30"
          : "text-text-subtle border-border"
      )}
    >
      {on && <Check size={11} strokeWidth={2.25} />}
      {label}
    </span>
  );
}

/** Media asset chip — a link when present, a dimmed chip when not. */
function MediaLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-label border border-border text-text-subtle">
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-label border border-accent/30 bg-accent-wash text-accent hover:bg-accent-wash/70 transition-colors"
    >
      {label}
      <ExternalLink size={10} strokeWidth={2} />
    </a>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-subtle">{label}</span>
      {children}
    </div>
  );
}

