import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  UserCog,
  Share2,
  Building2,
  Warehouse,
  Contact,
  Landmark,
  Handshake,
  Globe,
  Sprout,
  Settings,
  CalendarOff,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show only if the viewer has any of these permissions (omit = always visible). */
  perm?: string | string[];
}

export interface NavGroup {
  /** Section header. Empty string renders the items with no header. */
  title: string;
  items: NavItem[];
  /** CEO/admin-only section (role-gated once auth is wired). */
  admin?: boolean;
  /** Pin this group to the bottom of the sidebar (e.g. Settings). */
  bottom?: boolean;
}

// Grouped by what the user is *doing*, not 1:1 with source tabs:
//   เซลล์ = what sales work on daily (leads, listings, assignment) ·
//   คลังข้อมูล = reference data (contacts, projects, comparables) ·
//   ผลงาน = performance (leadership-only) · ตั้งค่า = master data the CEO governs.
export const NAV: NavGroup[] = [
  {
    title: "ภาพรวม",
    items: [
      { href: "/", label: "แดชบอร์ด", icon: LayoutDashboard },
      { href: "/today", label: "แผนวันนี้", icon: CalendarCheck, perm: ["performance.view_own", "performance.view_team"] },
    ],
  },
  {
    // Back-office main job (lead assignment) — pinned ABOVE เซลล์ so Admin / Listing Support
    // land on it first. Gated to leads.assign, so sales never see this section.
    title: "แอดมิน",
    admin: true,
    items: [
      { href: "/assign", label: "Lead Database", icon: Share2, perm: ["leads.view_all", "leads.assign"] },
    ],
  },
  {
    title: "เซลล์",
    items: [
      { href: "/leads", label: "Lead", icon: Users, perm: ["leads.view_all", "leads.view_own"] },
      // Sales' operational listing page (create + manage). Gated to listings.create so it's
      // Sales/CEO only — everyone else views the same inventory via ทรัพย์ทั้งบริษัท → detail.
      { href: "/listings", label: "ทรัพย์", icon: Building2, perm: "listings.create" },
    ],
  },
  {
    title: "คลังข้อมูล",
    items: [
      // Company-wide inventory — every sale sees who manages what (for Co-Agent), but never
      // the owner contact (that stays gated on the listing detail). Own component, not /listings.
      { href: "/company-listings", label: "ทรัพย์ทั้งบริษัท", icon: Warehouse, perm: "listings.view" },
      { href: "/contacts", label: "ผู้ติดต่อ", icon: Contact, perm: ["contacts.view_all", "contacts.view_own"] },
      { href: "/projects", label: "โครงการ", icon: Landmark, perm: "listings.view" },
      // Gated on the VIEW scopes, not listings.view — a closing record is private
      // performance data, so roles with no scope (Marketing / Admin / HR) don't see the
      // page at all. See CEO_FEEDBACK_R1.md item 3.
      {
        href: "/last-match",
        label: "Last Match",
        icon: Handshake,
        perm: ["lastmatch.view_all", "lastmatch.view_team", "lastmatch.view_own"],
      },
    ],
  },
  {
    // Marketing-only (website.manage): manage the customer-facing portal website's
    // menu/content. Coming-soon placeholder until the portal itself is designed.
    title: "การตลาด",
    items: [{ href: "/website", label: "เว็บพอร์ทัล", icon: Globe, perm: "website.manage" }],
  },
  {
    // HR / people directory — roster, roles, and employee records. Leadership/HR only:
    // visible with people.manage (full HR) or performance.view_team (leaders see the roster).
    title: "บุคลากร",
    items: [
      { href: "/team", label: "ทีม / บุคคล", icon: UserCog, perm: ["people.manage", "performance.view_team"] },
      // New-sales probation board — rank ladder progress, CEO/Sales Leader oversight.
      { href: "/new-sales", label: "เซลล์ใหม่", icon: Sprout, perm: "performance.view_team" },
      // Leave. Visible to EVERYONE (leave.request) — a rep sees only their own requests;
      // leave.manage holders see the whole company plus the approval queue. Requests are
      // filed from แผนวันนี้, not here.
      { href: "/leave", label: "วันลา", icon: CalendarOff, perm: ["leave.manage", "leave.request"] },
    ],
  },
  {
    // Single settings hub, pinned to the bottom; sections (roles, zones, master-data) live inside.
    title: "",
    admin: true,
    bottom: true,
    items: [
      { href: "/settings", label: "ตั้งค่า", icon: Settings, perm: ["roles.manage", "masterdata.govern", "reference.manage", "teams.manage"] },
    ],
  },
];
