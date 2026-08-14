import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, MessageCircle, Building2 } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Dot";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { ROLE_LABEL, ROLE_TONE } from "@/lib/contacts";
import { getContact } from "@/lib/queries";
import { formatBaht, formatRent } from "@/lib/format";
import { cn } from "@/lib/cn";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getContact(id);
  if (!c) notFound();

  return (
    <>
      <Topbar title="ผู้ติดต่อ" actions={false} />

      <div className="p-4 lg:p-6 space-y-4">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> กลับไปผู้ติดต่อ
        </Link>

        {/* Identity header — inline block (Shelter-style). Stacks on mobile. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={c.name} tone="crimson" className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-h1 truncate">{c.name}</h1>
              <div className="flex items-center flex-wrap gap-1.5 mt-1">
                {c.roles.map((r) => (
                  <Pill key={r} tone={ROLE_TONE[r]}>
                    {ROLE_LABEL[r]}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            <Button variant="secondary" size="sm" disabled>
              แก้ไข
            </Button>
            <Button variant="secondary" size="sm" disabled>
              <MessageCircle size={15} strokeWidth={1.75} /> LINE
            </Button>
            {c.phone ? (
              <a
                href={`tel:${c.phone}`}
                className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-small font-medium rounded-md bg-accent text-text-onaccent hover:bg-accent-hover transition-colors whitespace-nowrap"
              >
                <Phone size={15} strokeWidth={1.75} /> โทร
              </a>
            ) : (
              <Button size="sm" disabled>
                <Phone size={15} strokeWidth={1.75} /> โทร
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
          {/* Contact info */}
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลติดต่อ</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-body">
              <Row label="เบอร์โทร">
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="num hover:text-accent transition-colors">
                    {c.phone}
                  </a>
                ) : (
                  <span className="text-text-subtle">—</span>
                )}
              </Row>
              <Row label="LINE">
                <span className={c.line ? "" : "text-text-subtle"}>{c.line ?? "—"}</span>
              </Row>
              <Row label="อีเมล">
                <span className={c.email ? "" : "text-text-subtle"}>{c.email ?? "—"}</span>
              </Row>
              {c.note && (
                <div className="text-small text-text-muted pt-3 border-t border-border">
                  {c.note}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Demand + owned */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>ดีล / ความสนใจ ({c.demand.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {c.demand.length === 0 ? (
                  <div className="text-small text-text-subtle p-4">ไม่มีรายการ</div>
                ) : (
                  c.demand.map((d, i, arr) => (
                    <div
                      key={d.leadId}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3",
                        i < arr.length - 1 && "border-b border-border"
                      )}
                    >
                      <Pill tone={d.deal === "rent" ? "violet" : "accent"}>
                        {d.deal === "rent" ? "เช่า" : "ซื้อ"}
                      </Pill>
                      <span className="text-body truncate">{d.interest}</span>
                      {d.budget != null && (
                        <span className="num text-small text-text-muted ml-auto">
                          {d.deal === "rent" ? formatRent(d.budget) : formatBaht(d.budget)}
                        </span>
                      )}
                      <span className={cn("shrink-0", d.budget == null && "ml-auto")}>
                        <StatusBadge color={d.stageDot}>{d.stageTh}</StatusBadge>
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {c.owned.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>ทรัพย์ที่เป็นเจ้าของ ({c.owned.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {c.owned.map((l, i, arr) => (
                    <Link
                      key={l.listingId}
                      href={`/listings/${l.listingId}`}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors",
                        i < arr.length - 1 && "border-b border-border"
                      )}
                    >
                      <div className="size-9 rounded-md bg-surface-2 grid place-items-center shrink-0">
                        <Building2 size={16} strokeWidth={1.75} className="text-text-muted" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-body font-medium truncate">{l.name}</div>
                        <div className="num text-label text-text-subtle">
                          {l.deal === "rent" ? formatRent(l.price) : formatBaht(l.price)}
                        </div>
                      </div>
                      <Pill tone={l.deal === "rent" ? "violet" : "accent"} className="ml-auto">
                        {l.deal === "rent" ? "เช่า" : "ขาย"}
                      </Pill>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-subtle">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
