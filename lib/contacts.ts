// Central contacts directory — mirrors Shelter CRM's unified `contacts` model
// (one person, one or more roles, plus their owned listings and demand/leads).
//
// DESIGN-FIRST / SAMPLE DATA: HAUS has no contacts table yet. People currently
// live split across v_main_listing (owner_name/owner_phone) and
// main_6_buyer_crm (lead_name/phone) with no link between them. This hardcoded
// sample lets the full UI be designed now; wire a real Supabase contacts table
// later and swap listContacts/getContact to query it.

export type ContactRole = "owner" | "buyer" | "tenant" | "landlord";

type PillTone = "neutral" | "accent" | "green" | "amber" | "blue" | "violet" | "red";

export const ROLE_LABEL: Record<ContactRole, string> = {
  owner: "เจ้าของ",
  buyer: "ผู้ซื้อ",
  tenant: "ผู้เช่า",
  landlord: "ปล่อยเช่า",
};

export const ROLE_TONE: Record<ContactRole, PillTone> = {
  owner: "blue",
  buyer: "accent",
  tenant: "violet",
  landlord: "green",
};

/** A listing this contact owns — links to /listings/[listingId]. */
export interface ContactOwned {
  listingId: string;
  name: string;
  price: number;
  deal: "sale" | "rent";
}

/** A demand/interest (buyer or tenant lead) this contact has. */
export interface ContactDemand {
  leadId: string;
  interest: string;
  budget: number | null;
  stageTh: string;
  stageDot: string; // bg-* token
  deal: "buy" | "rent";
}

export interface Contact {
  id: string;
  name: string;
  roles: ContactRole[];
  phone: string | null;
  line: string | null;
  email: string | null;
  note: string | null;
  /** Owner of the record (agent name) — drives the privacy rule. */
  createdBy: string;
  /** Agent the contact is assigned to (agent name), if any. */
  assignedTo: string | null;
  owned: ContactOwned[];
  demand: ContactDemand[];
}

const CONTACTS: Contact[] = [
  {
    id: "c-thana",
    name: "คุณธนา มั่งมี",
    roles: ["owner"],
    createdBy: "Stone",
    assignedTo: "Stone",
    phone: "089-500-5000",
    line: "thana.m",
    email: "thana@example.com",
    note: "ขายด่วน ต้องการเงินก้อน ต่อรองได้",
    owned: [
      { listingId: "CASK001", name: "อโศก สกาย เรสซิเดนซ์", price: 9800000, deal: "sale" },
      { listingId: "CASK002", name: "อโศก สกาย เรสซิเดนซ์", price: 32000, deal: "rent" },
    ],
    demand: [],
  },
  {
    id: "c-napha",
    name: "คุณนภา ศรีสุข",
    roles: ["buyer"],
    createdBy: "Q",
    assignedTo: "Q",
    phone: "082-111-0011",
    line: "napha.s",
    email: null,
    note: null,
    owned: [],
    demand: [
      {
        leadId: "L-1001",
        interest: "คอนโด 2 นอน ย่านอโศก",
        budget: 4500000,
        stageTh: "ใหม่",
        stageDot: "bg-dot-blue",
        deal: "buy",
      },
    ],
  },
  {
    id: "c-james",
    name: "คุณเจมส์ วิลสัน",
    roles: ["buyer"],
    createdBy: "Stone",
    assignedTo: "Stone",
    phone: "082-103-0003",
    line: "jameswil",
    email: "james@example.com",
    note: "พร้อมโอน มองหาบ้านอยู่จริง",
    owned: [],
    demand: [
      {
        leadId: "L-1002",
        interest: "บ้านเดี่ยว พระราม 2",
        budget: 12000000,
        stageTh: "ติดต่อแล้ว",
        stageDot: "bg-dot-teal",
        deal: "buy",
      },
    ],
  },
  {
    id: "c-weera",
    name: "คุณวีระ ตั้งใจดี",
    roles: ["owner", "buyer"],
    createdBy: "Mhow",
    assignedTo: "Mhow",
    phone: "082-105-0005",
    line: "weera.t",
    email: null,
    note: "ขายหลังเดิมเพื่ออัปไซส์",
    owned: [{ listingId: "TCYP001", name: "ชัยพฤกษ์ ปาร์ค", price: 3200000, deal: "sale" }],
    demand: [
      {
        leadId: "L-1003",
        interest: "ทาวน์เฮาส์ ชัยพฤกษ์ 3 นอน",
        budget: 3500000,
        stageTh: "นัดหมาย",
        stageDot: "bg-dot-violet",
        deal: "buy",
      },
    ],
  },
  {
    id: "c-pimjai",
    name: "คุณพิมพ์ใจ รักบ้าน",
    roles: ["tenant"],
    createdBy: "Q",
    assignedTo: "Q",
    phone: "082-104-0004",
    line: "pimjai",
    email: null,
    note: "หาเช่าใกล้ BTS เข้าอยู่ได้ทันที",
    owned: [],
    demand: [
      {
        leadId: "L-1004",
        interest: "เช่าคอนโด 1 นอน ใกล้ BTS",
        budget: 25000,
        stageTh: "พาชม",
        stageDot: "bg-dot-amber",
        deal: "rent",
      },
    ],
  },
  {
    id: "c-somchai",
    name: "คุณสมชาย ใจดี",
    roles: ["landlord"],
    createdBy: "Stone",
    assignedTo: "Stone",
    phone: "081-222-3333",
    line: "somchai.j",
    email: null,
    note: null,
    owned: [{ listingId: "HRM2002", name: "แกรนด์ วิลล่า พระราม 2", price: 85000, deal: "rent" }],
    demand: [],
  },
];

export function listContacts(): Contact[] {
  return CONTACTS;
}

export function getContact(id: string): Contact | null {
  return CONTACTS.find((c) => c.id === id) ?? null;
}

/**
 * Contact privacy: a contact is hidden unless the viewer created it or it's
 * assigned to them. `canViewAll` (contacts.view_all) bypasses the rule for
 * Admin/CEO. Managers/team scoping is handled at wiring time.
 */
export function visibleContacts(
  contacts: Contact[],
  viewerName: string,
  canViewAll: boolean
): Contact[] {
  if (canViewAll) return contacts;
  return contacts.filter((c) => c.createdBy === viewerName || c.assignedTo === viewerName);
}
