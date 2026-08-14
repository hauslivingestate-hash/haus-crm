// The contacts directory — types and pure helpers.
//
// ⚠️ THERE IS NO `contacts` TABLE BEHIND THIS PAGE, deliberately (Ben, 2026-08-13).
// People already exist in two places: owners in `main_2_owner`, buyers/tenants in
// `main_6_buyer_crm`. A unified table was in the original design, but the real data does
// not justify it — of 1,169 distinct phone numbers only 5 (0.4%) belong to someone who is
// both an owner and a buyer. Copying every name and phone into a third table would buy that
// 0.4% at the cost of two records to keep in step, plus a snapshot that silently goes stale
// as new owners and leads are created.
//
// So `getContacts()` (lib/queries.ts) reads the two source tables live and merges on phone
// number. Nothing to import, nothing to sync, and the one thing a directory is genuinely
// useful for still works: type a phone number and find out whether this person is already
// known to us, and in what capacity.
//
// Scoping comes free with that: both source tables are already RLS-scoped, so an agent's
// search covers their own owners and leads and nobody else's.

export type ContactRole = "owner" | "buyer" | "tenant" | "landlord" | "agent";

type PillTone = "neutral" | "accent" | "green" | "amber" | "blue" | "violet" | "red";

export const ROLE_LABEL: Record<ContactRole, string> = {
  owner: "เจ้าของ",
  buyer: "ผู้ซื้อ",
  tenant: "ผู้เช่า",
  landlord: "ปล่อยเช่า",
  agent: "นายหน้า",
};

export const ROLE_TONE: Record<ContactRole, PillTone> = {
  owner: "blue",
  buyer: "accent",
  tenant: "violet",
  landlord: "green",
  agent: "amber",
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

/** What the directory list needs. Kept separate from `Contact` so the list page doesn't
 *  ship every person's listings and leads to the browser — there are ~1,200 of them. */
export interface ContactSummary {
  /** Synthetic and stable: the person's digits-only phone, or their source row's id when
   *  they have no phone. Not a database key — there is no contacts table. */
  id: string;
  name: string;
  roles: ContactRole[];
  phone: string | null;
  line: string | null;
}

export interface Contact extends ContactSummary {
  email: string | null;
  note: string | null;
  /** Nickname of the agent responsible, resolved from the listing/lead. */
  assignedTo: string | null;
  owned: ContactOwned[];
  demand: ContactDemand[];
}

/** Digits only, so "081-909-4966" and "0819094966" are recognised as one person. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length ? digits : null;
}

/** `lead_type` → the role it implies. The vocabulary is the DB's, not a seed's. */
export function roleForLeadType(leadType: string | null | undefined): ContactRole {
  if (leadType === "Buyer - Rent") return "tenant";
  if (leadType === "Co-Agent") return "agent";
  if (leadType?.startsWith("Owner - ")) return "owner";
  return "buyer";
}
