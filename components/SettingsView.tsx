"use client";

import * as React from "react";
import { ShieldCheck, Users, Map, Home, ListChecks, Activity, Target, Info, Lock, ClipboardList, Megaphone, Medal, Tags, CalendarOff, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { type Zone } from "@/lib/zones";
import { RolesManager } from "@/components/RolesManager";
import { TeamsManager } from "@/components/TeamsManager";
import { ZonesAdmin } from "@/components/ZonesAdmin";
import {
  PropertyTypesManager,
  LeadReferenceManager,
  LeadTagsManager,
  ActionTypesManager,
  KpiTemplatesManager,
} from "@/components/MasterDataManagers";
import { ChecklistTemplatesManager } from "@/components/ChecklistTemplatesManager";
import { CopyTemplateEditor } from "@/components/CopyTemplateEditor";
import { SalesRankManager } from "@/components/SalesRankManager";
import { LeaveAllowanceManager } from "@/components/LeaveAllowanceManager";
import { AccountsManager } from "@/components/AccountsManager";
import type { AccountRow } from "@/lib/accounts";
import type { Employee } from "@/lib/team";
import { useRbac } from "@/components/RbacProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type SectionKey = "roles" | "teams" | "zones" | "property_types" | "lead_fields" | "lead_tags" | "action_types" | "kpi" | "ranks" | "checklists" | "copy" | "leave" | "accounts";
// Each section is gated to a permission — the sub-nav only shows what the viewer can govern,
// so Listing Support (reference.manage) sees the reference lists but not roles/zones/KPI.
type Section = { key: SectionKey; label: string; icon: LucideIcon; perm: string };

// Single settings hub (Shelter-style): add a section here and it appears in the sub-nav.
const SECTIONS: Section[] = [
  { key: "roles", label: "บทบาท & สิทธิ์", icon: ShieldCheck, perm: "roles.manage" },
  { key: "teams", label: "ทีมขาย", icon: Users, perm: "teams.manage" },
  { key: "zones", label: "โซน", icon: Map, perm: "masterdata.govern" },
  { key: "property_types", label: "ประเภททรัพย์", icon: Home, perm: "reference.manage" },
  { key: "checklists", label: "เช็คลิสต์ทรัพย์", icon: ClipboardList, perm: "checklists.manage" },
  { key: "copy", label: "คำโฆษณา", icon: Megaphone, perm: "copy.manage" },
  { key: "lead_fields", label: "ช่องทาง & ฟิลด์ Lead", icon: ListChecks, perm: "reference.manage" },
  // CEO-only (masterdata.govern), NOT reference.manage: the group tag is a company-wide
  // reporting dimension, not a light intake vocabulary. CEO can delegate it by granting
  // masterdata.govern to a role.
  { key: "lead_tags", label: "แท็ก Lead", icon: Tags, perm: "masterdata.govern" },
  { key: "action_types", label: "ประเภทกิจกรรม", icon: Activity, perm: "masterdata.govern" },
  { key: "kpi", label: "เป้าหมาย KPI", icon: Target, perm: "masterdata.govern" },
  { key: "ranks", label: "Rank เซลล์ใหม่", icon: Medal, perm: "masterdata.govern" },
  // Leave quota — gated leave.manage (CEO/HR), NOT masterdata.govern: it is an HR policy
  // number, not part of the CRM vocabulary.
  { key: "leave", label: "โควตาวันลา", icon: CalendarOff, perm: "leave.manage" },
  // Reaches auth.users directly via service_role — CEO / HR / system_admin only.
  { key: "accounts", label: "บัญชีผู้ใช้", icon: KeyRound, perm: "people.manage_accounts" },
];

export function SettingsView({
  zones,
  propertyTypeUsage,
  accounts,
  employees,
}: {
  zones: Zone[];
  /** Listings per property type — impact line for the delete confirm. */
  propertyTypeUsage?: Record<string, number>;
  accounts: AccountRow[];
  /** Real roster (main_1_hr) — the team builder picks its members from this. */
  employees: Employee[];
}) {
  const { can } = useRbac();
  const visible = SECTIONS.filter((s) => can(s.perm));
  const [section, setSection] = React.useState<SectionKey>(() => visible[0]?.key ?? "roles");

  // Keep the selection valid as the viewer (view-as) changes and the visible set shifts.
  const visibleKeys = visible.map((s) => s.key).join(",");
  React.useEffect(() => {
    if (!visible.some((s) => s.key === section)) setSection(visible[0]?.key ?? "roles");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKeys]);

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Lock size={22} strokeWidth={1.5} className="text-text-subtle" />
        <p className="text-small text-text-subtle">คุณไม่มีสิทธิ์เข้าถึงการตั้งค่า</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 items-start">
      {/* Section sub-nav */}
      <nav className="flex lg:flex-col gap-px overflow-x-auto lg:overflow-visible lg:sticky lg:top-[72px]">
        {visible.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-body font-medium transition-colors text-left whitespace-nowrap shrink-0",
              section === s.key
                ? "bg-accent-wash text-text"
                : "text-text-muted hover:bg-surface-hover hover:text-text"
            )}
          >
            <s.icon
              size={16}
              strokeWidth={1.75}
              className={section === s.key ? "text-accent" : ""}
            />
            {s.label}
          </button>
        ))}
      </nav>

      {/* Section content */}
      <div className="flex flex-col gap-4 min-w-0">
        {section === "roles" && <RolesSection />}
        {section === "teams" && (
          <>
            <SectionHeader title="ทีมขาย" desc="สร้างทีม กำหนดหัวหน้า เป้ารายได้ และมอบหมายเซลเข้าทีม · จัดการโดย CEO" />
            <TeamsManager employees={employees} />
          </>
        )}
        {section === "zones" && <ZonesSection zones={zones} employees={employees} />}
        {section === "property_types" && (
          <>
            <SectionHeader title="ประเภททรัพย์" desc="รายการประเภททรัพย์กลาง · จัดการโดย CEO / Listing Support" />
            <PropertyTypesManager usage={propertyTypeUsage} />
          </>
        )}
        {section === "checklists" && (
          <>
            <SectionHeader
              title="เช็คลิสต์ทรัพย์เด่น"
              desc="เทมเพลตงานเพิ่มมูลค่าสำหรับทรัพย์ A-List / Exclusive — กำหนดว่าใช้กับระดับไหน มอบหมายให้ทีมใด · จัดการโดย CEO / Listing Support"
            />
            <Note>
              ทรัพย์ A-List / Exclusive จะแสดงเช็คลิสต์นี้อัตโนมัติในหน้าทรัพย์ ตั้งค่า “ใช้กับ” เป็น Exclusive
              หรือ A-List (หรือทั้งคู่) เพื่อคุมว่าเทมเพลตไหนใช้กับระดับใด{" "}
              <span className="text-text">โหมดออกแบบ: การเปลี่ยนแปลงยังไม่ถูกบันทึก</span>
            </Note>
            <ChecklistTemplatesManager />
          </>
        )}
        {section === "copy" && (
          <>
            <SectionHeader
              title="เทมเพลตคำโฆษณา"
              desc="คำประกาศโฆษณาทรัพย์ แยกตามระดับ (Grade) × ประเภท (ขาย/เช่า) — สร้างอัตโนมัติจากข้อมูลทรัพย์ · จัดการโดย CEO / Marketing / Listing Support"
            />
            <Note>
              คำโฆษณาสร้างจากเทมเพลตเหล่านี้ โดยแทนค่า <code className="num">&lt;...&gt;</code> ด้วยข้อมูลของทรัพย์แต่ละรายการ
              — ปุ่ม “สร้างคำโฆษณา” ในหน้าทรัพย์จะให้ Headline / โพสต์ / DDproperty พร้อมคัดลอก{" "}
              <span className="text-text">โหมดออกแบบ: การเปลี่ยนแปลงยังไม่ถูกบันทึก</span>
            </Note>
            <CopyTemplateEditor />
          </>
        )}
        {section === "lead_fields" && (
          <>
            <SectionHeader
              title="ช่องทาง & ฟิลด์ Lead"
              desc="รายการที่ฟอร์มรับลีดใช้ (Marketing Channel · Contact By · เพศ · สัญชาติ) · จัดการโดย CEO / Listing Support"
            />
            <LeadReferenceManager />
          </>
        )}
        {section === "lead_tags" && (
          <>
            <SectionHeader
              title="แท็ก Lead"
              desc="แท็กกลุ่มลูกค้ามาตรฐานของบริษัท · เซลส์เลือกได้ 1 แท็กต่อลูกค้า 1 คน และสร้างเองไม่ได้ · จัดการโดย CEO"
            />
            <Note>
              แท็กนี้เป็น <span className="text-text">กลุ่มประเภทลูกค้า</span> ไม่ใช่ระดับความร้อน —
              ระดับความร้อนใช้ช่อง Potential (A / B / C) ที่มีอยู่แล้ว ควรตั้งให้แต่ละแท็ก
              <span className="text-text"> แยกจากกันชัดเจน</span> เพราะลูกค้า 1 คนติดได้แค่แท็กเดียว{" "}
              <span className="text-text">โหมดออกแบบ: การเปลี่ยนแปลงยังไม่ถูกบันทึก</span>
            </Note>
            <LeadTagsManager />
          </>
        )}
        {section === "leave" && (
          <>
            <SectionHeader
              title="โควตาวันลา"
              desc="จำนวนวันลาต่อปีของแต่ละประเภท · ใช้คำนวณวันลาคงเหลือในหน้าวันลา · CEO / HR"
            />
            <LeaveAllowanceManager />
          </>
        )}
        {section === "action_types" && (
          <>
            <SectionHeader
              title="ประเภทกิจกรรม"
              desc="ชุดกิจกรรมกลางที่ปุ่มบันทึกและหน้าผลงานใช้ · จัดการโดย CEO"
            />
            <ActionTypesManager />
          </>
        )}
        {section === "kpi" && (
          <>
            <SectionHeader
              title="เป้าหมาย KPI"
              desc="เทมเพลตเป้าหมายที่หัวหน้าใช้ตั้งเป้าให้ทีม (เชื่อมกับกิจกรรม/ไปป์ไลน์)"
            />
            <KpiTemplatesManager />
          </>
        )}
        {section === "ranks" && (
          <>
            <SectionHeader
              title="Rank เซลล์ใหม่ (โปรเบชั่น)"
              desc="บันไดเลื่อนขั้นของเซลล์ใหม่ — เกณฑ์แต่ละ Rank นับจากกิจกรรม (เหมือน KPI) · จัดการโดย CEO"
            />
            <Note>
              เซลล์ใหม่เลื่อน Rank <span className="text-text">อัตโนมัติ</span>เมื่อทำครบทุกเกณฑ์ของ Rank
              ถัดไป (นับจากกิจกรรมที่บันทึกจริง — เลือกได้ว่านับสะสมรวมหรือต่อเดือน) ผ่าน Rank สุดท้าย =
              ผ่านโปรเบชั่น ดูภาพรวมได้ที่หน้า “เซลล์ใหม่”{" "}
              <span className="text-text">โหมดออกแบบ: การเปลี่ยนแปลงยังไม่ถูกบันทึก</span>
            </Note>
            <SalesRankManager />
          </>
        )}
        {section === "accounts" && (
          <>
            <SectionHeader
              title="บัญชีผู้ใช้"
              desc="สร้างบัญชี login ใหม่ให้พนักงาน หรือรีเซ็ตรหัสผ่านให้คนที่ล็อกอินไม่ได้ · CEO / HR เท่านั้น"
            />
            <Note>
              การเปลี่ยนแปลงตรงนี้เขียนลง <span className="text-text">auth.users</span> จริงทันที
              — บอกพนักงานให้เปลี่ยนรหัสผ่านเองที่หน้า “บัญชีของฉัน” หลัง login ครั้งแรก
            </Note>
            <AccountsManager accounts={accounts} />
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-h2">{title}</h2>
        {desc && <p className="text-small text-text-muted mt-0.5">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-2 px-4 py-3">
      <Info size={16} strokeWidth={1.75} className="text-accent mt-0.5 shrink-0" />
      <p className="text-small text-text-muted">{children}</p>
    </div>
  );
}

function RolesSection() {
  return (
    <>
      <SectionHeader title="บทบาท & สิทธิ์" desc="กำหนดบทบาทและสิทธิ์การใช้งาน · จัดการโดย CEO" />
      <Note>
        สร้างบทบาท เปิด/ปิดสิทธิ์ และกำหนดผู้ใช้ได้ที่นี่ — ผู้ใช้หนึ่งคนถือได้หลายบทบาท (สิทธิ์รวมกัน)
        เช่น หัวหน้าทีมที่ยังขายอยู่ = Agent + Sales Leader.{" "}
        <span className="text-text">โหมดออกแบบ: การเปลี่ยนแปลงยังไม่ถูกบันทึก</span>
      </Note>
      <RolesManager />
    </>
  );
}

function ZonesSection({ zones, employees }: { zones: Zone[]; employees: Employee[] }) {
  return (
    <>
      <SectionHeader
        title="โซน"
        desc="ข้อมูลอ้างอิงกลางที่ทรัพย์ · Lead · Last Match ใช้ร่วมกัน"
      />
      <ZonesAdmin zones={zones} employees={employees} />
    </>
  );
}

