import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Home,
  ThumbsUp,
  ThumbsDown,
  Users,
  Building2,
  Droplets,
  ScrollText,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { getProject, projectCompleteness } from "@/lib/projects";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) notFound();

  const pct = projectCompleteness(p);
  const tone = pct >= 70 ? "green" : pct >= 30 ? "amber" : "neutral";

  return (
    <>
      <Topbar title="โครงการ" actions={false} />

      <div className="p-4 lg:p-6 space-y-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> กลับไปโครงการ
        </Link>

        {/* Identity header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h1 className="text-h1">{p.name_thai}</h1>
            <p className="text-small text-text-muted mt-0.5">{p.name_eng}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {p.zone && (
                <Pill tone="neutral">
                  <MapPin size={11} strokeWidth={1.75} /> {p.zone}
                </Pill>
              )}
              {p.property_type && (
                <Pill tone="neutral">
                  <Home size={11} strokeWidth={1.75} /> {p.property_type}
                </Pill>
              )}
              <Pill tone={tone}>
                ข้อมูล <span className="num">{pct}%</span>
              </Pill>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            <Button variant="secondary" size="sm" disabled>
              แก้ไข
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* Main column */}
          <div className="flex flex-col gap-4 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>รายละเอียดโครงการ</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-small">
                <Fact label="ประเภท" value={p.property_type} />
                <Fact label="โซน" value={p.zone} />
                <Fact label="จำนวนยูนิต" value={p.units} />
                <Fact label="จำนวนเฟส" value={p.phases} />
                <Fact label="อายุโครงการ" value={p.age} />
                <Fact label="วัสดุ" value={p.material} />
                <Fact label="พื้นถึงฝ้า" value={p.floor_to_ceiling} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ประเภทยูนิต</CardTitle>
              </CardHeader>
              <CardContent>
                {p.unit_types ? (
                  <p className="text-small text-text-muted whitespace-pre-line leading-relaxed">
                    {p.unit_types}
                  </p>
                ) : (
                  <Empty icon={Building2}>ยังไม่มีข้อมูลประเภทยูนิต</Empty>
                )}
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp size={16} strokeWidth={1.75} className="text-green" /> ข้อดี
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {p.pros ? (
                    <p className="text-small text-text-muted whitespace-pre-line leading-relaxed">
                      {p.pros}
                    </p>
                  ) : (
                    <span className="text-small text-text-subtle">—</span>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsDown size={16} strokeWidth={1.75} className="text-red" /> ข้อเสีย
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {p.cons ? (
                    <p className="text-small text-text-muted whitespace-pre-line leading-relaxed">
                      {p.cons}
                    </p>
                  ) : (
                    <span className="text-small text-text-subtle">—</span>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={16} strokeWidth={1.75} className="text-text-muted" /> ลูกบ้าน / Persona
                </CardTitle>
              </CardHeader>
              <CardContent>
                {p.resident_persona ? (
                  <p className="text-small text-text-muted leading-relaxed">{p.resident_persona}</p>
                ) : (
                  <Empty icon={Users}>ยังไม่มีข้อมูลกลุ่มลูกบ้าน</Empty>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText size={16} strokeWidth={1.75} className="text-text-muted" /> ค่าใช้จ่าย & นิติ
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-small">
                <Row label="ค่าส่วนกลาง" value={p.common_fee} />
                <Row label="อัตราเก็บได้" value={p.fee_collection_rate} />
                <Row label="จอดเกิน" value={p.overflow_parking_fee} />
                <Row label="ค่าเช่าในโครงการ" value={p.rental_range} />
                <Row label="ราคาจบโครงการ" value={p.closing_price} />
                <Row label="นิติบุคคล" value={p.juristic} />
                <Row label="น้ำท่วม">
                  {p.flood ? (
                    <span className="inline-flex items-center gap-1">
                      <Droplets size={12} strokeWidth={1.75} className="text-blue" />
                      {p.flood}
                    </span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </Row>
              </CardContent>
            </Card>

            {/* Cross-link to listings in this project — filter wired later */}
            <Card>
              <CardHeader>
                <CardTitle>ทรัพย์ในโครงการ</CardTitle>
                <Pill>เร็ว ๆ นี้</Pill>
              </CardHeader>
              <CardContent>
                <Link
                  href="/listings"
                  className="inline-flex items-center gap-1.5 text-small text-accent hover:underline"
                >
                  <Building2 size={14} strokeWidth={1.75} /> ดูทรัพย์ทั้งหมด
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-label text-text-subtle">{label}</div>
      <div className="text-body mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-text-subtle shrink-0">{label}</span>
      {children ?? <span className="text-right">{value ?? "—"}</span>}
    </div>
  );
}

function Empty({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <Icon size={22} strokeWidth={1.5} className="text-text-subtle" />
      <p className="text-small text-text-subtle">{children}</p>
    </div>
  );
}
