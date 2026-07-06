import { Topbar } from "@/components/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Dot";
import { Pill } from "@/components/ui/Pill";
import { getListings } from "@/lib/queries";
import { formatPrice, formatNumber, daysOnMarketLabel } from "@/lib/format";
import { listingStatusDot } from "@/lib/status";

export const dynamic = "force-dynamic";

function potentialTone(p: string | null): "neutral" | "accent" | "amber" {
  if (!p || p === "Normal") return "neutral";
  if (p.startsWith("Exclusive")) return "accent";
  return "amber";
}

export default async function ListingsPage() {
  const listings = await getListings();

  return (
    <>
      <Topbar title="ทรัพย์" subtitle={`ประกาศทั้งหมด · ${listings.length} รายการ`} />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Listing ID</TH>
                  <TH>โครงการ</TH>
                  <TH>โซน</TH>
                  <TH>ประเภท</TH>
                  <TH className="text-right">ห้อง</TH>
                  <TH className="text-right">พื้นที่</TH>
                  <TH>Potential</TH>
                  <TH>สถานะ</TH>
                  <TH className="text-right">ราคา</TH>
                  <TH className="text-right">DOM</TH>
                </TR>
              </THead>
              <TBody>
                {listings.map((l) => (
                  <TR key={l.listing_id}>
                    <TD className="num text-small text-accent font-medium">{l.listing_id}</TD>
                    <TD>
                      <div className="font-medium">{l.listing_name ?? "—"}</div>
                      <div className="text-label text-text-subtle">{l.project_name_eng}</div>
                    </TD>
                    <TD className="text-small text-text-muted">
                      {l.zone_name_thai}
                      <span className="num text-text-subtle ml-1">{l.zone}</span>
                    </TD>
                    <TD className="text-small">{l.property_type}</TD>
                    <TD className="text-right num text-small">
                      {l.bed ?? "—"}<span className="text-text-subtle">น</span> {l.bath ?? "—"}
                      <span className="text-text-subtle">บ</span>
                    </TD>
                    <TD className="text-right num text-small">
                      {l.area_sqm ? `${formatNumber(l.area_sqm)}` : "—"}
                      <span className="text-text-subtle"> ตร.ม.</span>
                    </TD>
                    <TD>
                      <Pill tone={potentialTone(l.potential)}>{l.potential}</Pill>
                    </TD>
                    <TD>
                      <StatusBadge color={listingStatusDot(l.listing_status)}>
                        {l.listing_status}
                      </StatusBadge>
                    </TD>
                    <TD className="text-right num font-medium">
                      {formatPrice(l.asking_price, l.listing_type)}
                    </TD>
                    <TD className="text-right num text-small text-text-muted">
                      {daysOnMarketLabel(l.days_on_market)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
