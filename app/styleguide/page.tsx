import { Topbar } from "@/components/Topbar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { StatusBadge, Dot } from "@/components/ui/Dot";
import { GradeChip } from "@/components/ui/GradeChip";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented } from "@/components/ui/Segmented";
import { STAGES } from "@/lib/pipeline";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <div className="w-32 shrink-0 text-label uppercase text-text-subtle">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const NEUTRALS = [
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-surface-2"],
  ["border", "bg-border"],
  ["text", "bg-text"],
];
const STATUS = [
  ["green", "bg-green"],
  ["blue", "bg-blue"],
  ["amber", "bg-amber"],
  ["red", "bg-red"],
  ["violet", "bg-violet"],
];

export default function StyleguidePage() {
  return (
    <>
      <Topbar title="Styleguide" subtitle="โทเคน + คอมโพเนนต์ทั้งหมดของ HAUS CRM" />
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Color */}
        <Card>
          <CardHeader>
            <CardTitle>สี (Color)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-label uppercase text-text-subtle mb-2">Accent · Crimson</div>
              <div className="flex gap-3">
                <Swatch name="accent" cls="bg-accent" />
                <Swatch name="accent-hover" cls="bg-accent-hover" />
                <Swatch name="accent-wash" cls="bg-accent-wash" border />
                <Swatch name="maroon-900" cls="bg-maroon-900" />
              </div>
            </div>
            <div>
              <div className="text-label uppercase text-text-subtle mb-2">Neutral · Stone</div>
              <div className="flex gap-3">
                {NEUTRALS.map(([n, c]) => (
                  <Swatch key={n} name={n} cls={c} border />
                ))}
              </div>
            </div>
            <div>
              <div className="text-label uppercase text-text-subtle mb-2">Status</div>
              <div className="flex gap-3">
                {STATUS.map(([n, c]) => (
                  <Swatch key={n} name={n} cls={c} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Type */}
        <Card>
          <CardHeader>
            <CardTitle>ตัวอักษร (Typography)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-display">Display 24 · แดชบอร์ด ฿12.9 ล้าน</div>
            <div className="text-h1">Heading 1 · ประกาศทรัพย์ทั้งหมด</div>
            <div className="text-h2">Heading 2 · ไปป์ไลน์การขาย</div>
            <div className="text-body">Body 13 · ข้อความปกติของระบบ HAUS CRM ภาษาไทยอ่านสบาย</div>
            <div className="text-small text-text-muted">Small 12 · ข้อมูลรอง/เมทาดาทา</div>
            <div className="text-label uppercase text-text-subtle">Label 11 · TABLE HEADER</div>
            <div className="num text-h2 pt-1">1234567890 · ฿3,900,000 · 6 ก.ค. 2569</div>
          </CardContent>
        </Card>

        {/* Components */}
        <Card>
          <CardHeader>
            <CardTitle>คอมโพเนนต์ (Components)</CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <Row label="Button">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </Row>
            <Row label="Grade chip">
              <GradeChip grade="A" />
              <GradeChip grade="B" />
              <GradeChip grade="C" />
            </Row>
            <Row label="Status">
              <StatusBadge color="bg-green">Posted</StatusBadge>
              <StatusBadge color="bg-amber">Ready to Post</StatusBadge>
              <StatusBadge color="bg-blue">Update</StatusBadge>
              <StatusBadge color="bg-red">Cancel</StatusBadge>
            </Row>
            <Row label="Pill">
              <Pill>Normal</Pill>
              <Pill tone="accent">A List</Pill>
              <Pill tone="green">Win</Pill>
              <Pill tone="amber">Follow</Pill>
            </Row>
            <Row label="Avatar">
              <Avatar name="Ploy Srisai" tone="crimson" />
              <Avatar name="Beam Wattana" />
            </Row>
            <Row label="Stage dots">
              {STAGES.slice(0, 6).map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-small">
                  <Dot className={s.dot} />
                  {s.th}
                </span>
              ))}
            </Row>
            <Row label="Segmented">
              <Segmented options={["วันนี้", "เดือนนี้", "ไตรมาส"]} />
            </Row>
          </CardContent>
        </Card>

        {/* Stat */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Stat label="ทรัพย์ทั้งหมด" value="10" hint="6 เข้าเกณฑ์ A List" />
          <Stat label="คอมมิชชั่น" value="฿2.3 แสน" delta={{ value: "2 ดีล", positive: true }} />
          <Stat label="มูลค่าไปป์ไลน์" value="฿3.6 ล้าน" delta={{ value: "12%", positive: false }} />
        </div>
      </div>
    </>
  );
}

function Swatch({ name, cls, border }: { name: string; cls: string; border?: boolean }) {
  return (
    <div className="text-center">
      <div className={`h-12 w-16 rounded-md ${cls} ${border ? "border border-border" : ""}`} />
      <div className="text-label text-text-subtle mt-1">{name}</div>
    </div>
  );
}
