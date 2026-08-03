// SAMPLE DATA — UI-first. Shape mirrors the source `zone` table
// (seq, zone_id, name_eng, name_thai, sale_id_assigned). Zone is CEO-managed
// master data: the controlled vocabulary that listings / leads / last-match all
// reference. Wire later = swap listZones for a Supabase query. See DATA_MODEL.md.

export interface Zone {
  seq: number;
  zone_id: string; // short code, e.g. "CYP"
  name_eng: string;
  name_thai: string;
  sale_id_assigned: string | null; // owning agent, or null = unassigned
}

// Codes for the live listings are included so the CRM's zone references line up.
const SAMPLE: Zone[] = [
  { seq: 1, zone_id: "ASK", name_eng: "Asoke", name_thai: "อโศก", sale_id_assigned: "S-004" },
  { seq: 2, zone_id: "BGY", name_eng: "Bang Yai", name_thai: "บางใหญ่", sale_id_assigned: "S-001" },
  { seq: 3, zone_id: "CYP", name_eng: "Chaiyaphruek", name_thai: "ชัยพฤกษ์", sale_id_assigned: "S-003" },
  { seq: 4, zone_id: "RP1", name_eng: "Ratchaphruek (Ton)", name_thai: "ราชพฤกษ์ต้น", sale_id_assigned: "S-003" },
  { seq: 5, zone_id: "RM2", name_eng: "Rama 2", name_thai: "พระราม 2", sale_id_assigned: "S-002" },
  { seq: 6, zone_id: "PKS", name_eng: "Phetkasem", name_thai: "เพชรเกษม", sale_id_assigned: "S-002" },
  { seq: 7, zone_id: "PTM", name_eng: "Phutthamonthon Sai 2", name_thai: "พุทธมณฑลสาย 2", sale_id_assigned: null },
  { seq: 8, zone_id: "PT3", name_eng: "Phutthamonthon Sai 3", name_thai: "พุทธมณฑลสาย 3", sale_id_assigned: null },
  { seq: 9, zone_id: "SLY", name_eng: "Salaya", name_thai: "ศาลายา", sale_id_assigned: "S-001" },
  { seq: 10, zone_id: "BKL", name_eng: "Bang Kluay", name_thai: "บางกรวย", sale_id_assigned: null },
  { seq: 11, zone_id: "BWK", name_eng: "Bang Waek", name_thai: "บางแวก", sale_id_assigned: "S-004" },
  { seq: 12, zone_id: "SSW", name_eng: "Suksawat", name_thai: "สุขสวัสดิ์", sale_id_assigned: null },
];

export function listZones(): Zone[] {
  return [...SAMPLE].sort((a, b) => a.seq - b.seq);
}
