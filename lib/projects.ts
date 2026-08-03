// SAMPLE DATA — UI-first. Shapes mirror the source workbook "Projects" tab so
// wiring to Supabase later is a drop-in swap (replace listProjects/getProject
// with queries returning the same Project type). See DATA_MODEL.md §3.
//
// Reality check baked in: the real tab is sparse (only ~10 of 39 rows have detail
// beyond name/type/zone), so some samples below are intentionally thin to exercise
// the empty states.

export interface Project {
  /** Routing key. Source `Project ID` is mostly blank, so we slug the Eng name. */
  id: string;
  name_eng: string;
  name_thai: string;
  property_type: string | null;
  zone: string | null;
  units: string | null;
  phases: string | null;
  unit_types: string | null;
  material: string | null;
  floor_to_ceiling: string | null;
  age: string | null;
  common_area: string | null;
  common_fee: string | null;
  juristic: string | null;
  fee_collection_rate: string | null;
  overflow_parking_fee: string | null;
  rental_range: string | null;
  flood: string | null;
  resident_persona: string | null;
  closing_price: string | null;
  pros: string | null;
  cons: string | null;
  created_by: string | null;
}

// name_eng values mirror the live listings' project_name_eng so the listing↔project
// cross-link resolves in the running app. Completeness deliberately varies.
const SAMPLE: Project[] = [
  {
    id: "chaiyaphruek-park",
    name_eng: "Chaiyaphruek Park",
    name_thai: "ชัยพฤกษ์ ปาร์ค",
    property_type: "ทาวน์เฮ้าส์",
    zone: "ชัยพฤกษ์",
    units: "220 ยูนิต",
    phases: "2 เฟส",
    unit_types:
      "3 ไทป์ · Type A 21 ตร.วา (3 นอน/2 น้ำ) · Type B 24 ตร.วา (3/3) · Type C 28 ตร.วา (4/3)",
    material: "อิฐมวลเบา",
    floor_to_ceiling: "2.6 ม.",
    age: "6 ปี",
    common_area: "สระว่ายน้ำ · ฟิตเนส · สวนกลาง",
    common_fee: "35 บาท/ตร.วา",
    juristic: "คุณแนน 081-234-5678",
    fee_collection_rate: "~85%",
    overflow_parking_fee: "500 บาท/คัน/เดือน",
    rental_range: "15,000–18,000 บาท/เดือน",
    flood: "ไม่ท่วม",
    resident_persona: "ครอบครัวเริ่มต้น · พนักงานออฟฟิศย่านรัตนาธิเบศร์ · First jobber",
    closing_price: "3.5–4.2 ล้าน",
    pros: "ทำเลเข้าเมืองสะดวก ใกล้ MRT สายสีม่วง · ส่วนกลางครบ",
    cons: "บ้านหันทิศตะวันตกหลายแปลง · ที่จอดรถแขกจำกัด",
    created_by: "Stone",
  },
  {
    id: "rama-2-grand-villa",
    name_eng: "Rama 2 Grand Villa",
    name_thai: "พระราม 2 แกรนด์ วิลล่า",
    property_type: "บ้านเดี่ยว",
    zone: "พระราม 2",
    units: "150 หลัง",
    phases: "3 เฟส",
    unit_types:
      "Grand 60 ตร.วา (4 นอน/4 น้ำ/2 จอด) · Grand Plus 80 ตร.วา (4/5/3) · Prestige 100 ตร.วา (5/6/3)",
    material: "ผนังคอนกรีตสำเร็จรูป",
    floor_to_ceiling: "3.0 ม.",
    age: "8 ปี",
    common_area: "คลับเฮาส์ · สระ · สวน",
    common_fee: "42 บาท/ตร.วา",
    juristic: "คุณโอ๋ 089-876-5432",
    fee_collection_rate: null,
    overflow_parking_fee: null,
    rental_range: "35,000–45,000 บาท/เดือน",
    flood: "เคยท่วมปี 54 · ยกระดับถนนแล้ว",
    resident_persona: "เจ้าของธุรกิจฝั่งธน · แพทย์ · ครอบครัวขยาย",
    closing_price: "9–14 ล้าน",
    pros: "แปลงใหญ่ ฟังก์ชันครบ · ใกล้ทางด่วนพระราม 2",
    cons: "รถติดชั่วโมงเร่งด่วนหนัก · ไกลรถไฟฟ้า",
    created_by: "Stone",
  },
  {
    id: "the-nern-by-sansiri",
    name_eng: "The Nern by Sansiri",
    name_thai: "เดอะ เนิน บาย แสนสิริ",
    property_type: "คอนโด",
    zone: "บางใหญ่",
    units: "1,120 ยูนิต · 2 อาคาร",
    phases: "1 เฟส",
    unit_types: "Studio 26 ตร.ม. · 1 Bed 30–35 ตร.ม. · 2 Bed 55 ตร.ม.",
    material: null,
    floor_to_ceiling: "2.5 ม.",
    age: "3 ปี",
    common_area: "สระ · ฟิตเนส · Co-working · Sky garden",
    common_fee: "50 บาท/ตร.ม.",
    juristic: "แสนสิริ พร็อพเพอร์ตี้",
    fee_collection_rate: null,
    overflow_parking_fee: null,
    rental_range: "8,500–13,000 บาท/เดือน",
    flood: "ไม่ท่วม",
    resident_persona: null,
    closing_price: null,
    pros: "ติด MRT บางใหญ่ · แบรนด์แสนสิริ ปล่อยเช่าง่าย",
    cons: "ยูนิตเยอะ ปล่อยเช่าแข่งกันสูง",
    created_by: "Stone",
  },
  {
    id: "asoke-sky-residence",
    name_eng: "Asoke Sky Residence",
    name_thai: "อโศก สกาย เรสซิเดนซ์",
    property_type: "คอนโด",
    zone: "อโศก",
    units: "480 ยูนิต",
    phases: "1 เฟส",
    unit_types: "1 Bed 34 ตร.ม. · 2 Bed 62 ตร.ม. · Duplex 88 ตร.ม.",
    material: null,
    floor_to_ceiling: null,
    age: "5 ปี",
    common_area: "Rooftop pool · Sky lounge",
    common_fee: "65 บาท/ตร.ม.",
    juristic: null,
    fee_collection_rate: null,
    overflow_parking_fee: null,
    rental_range: "25,000–40,000 บาท/เดือน",
    flood: "ไม่ท่วม",
    resident_persona: "Expat · ผู้บริหาร · นักลงทุนปล่อยเช่า",
    closing_price: null,
    pros: "ใจกลาง CBD ติด MRT/BTS · yield ปล่อยเช่าดี",
    cons: "ราคา/ตร.ม. สูง",
    created_by: "Stone",
  },
  {
    id: "baan-klang-muang",
    name_eng: "Baan Klang Muang",
    name_thai: "บ้านกลางเมือง",
    property_type: "ทาวน์โฮม",
    zone: "ราชพฤกษ์ต้น",
    units: null,
    phases: null,
    unit_types: null,
    material: null,
    floor_to_ceiling: null,
    age: "10 ปี",
    common_area: null,
    common_fee: "30 บาท/ตร.วา",
    juristic: null,
    fee_collection_rate: null,
    overflow_parking_fee: null,
    rental_range: null,
    flood: null,
    resident_persona: null,
    closing_price: null,
    pros: "ใกล้ราชพฤกษ์ เข้าเมืองสะดวก",
    cons: null,
    created_by: "Stone",
  },
  {
    id: "phetkasem-home-place",
    name_eng: "Phetkasem Home Place",
    name_thai: "เพชรเกษม โฮม เพลส",
    property_type: "บ้านแฝด",
    zone: "เพชรเกษม",
    units: null,
    phases: null,
    unit_types: null,
    material: null,
    floor_to_ceiling: null,
    age: null,
    common_area: null,
    common_fee: null,
    juristic: null,
    fee_collection_rate: null,
    overflow_parking_fee: null,
    rental_range: null,
    flood: null,
    resident_persona: null,
    closing_price: null,
    pros: null,
    cons: null,
    created_by: "Stone",
  },
];

export function listProjects(): Project[] {
  return SAMPLE;
}

export function getProject(id: string): Project | undefined {
  return SAMPLE.find((p) => p.id === id);
}

/** Match a listing's project_name_eng back to a project (loose, name-based —
 *  mirrors the source's free-text join; see DATA_MODEL.md import must-fixes). */
export function getProjectByName(name: string | null | undefined): Project | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return SAMPLE.find(
    (p) => p.name_eng.toLowerCase() === n || p.name_thai.trim().toLowerCase() === n
  );
}

/** How "filled in" a project is — the source is mostly sparse, so the list
 *  surfaces this to nudge agents to complete records. */
export function projectCompleteness(p: Project): number {
  const fields = [
    p.units, p.phases, p.unit_types, p.material, p.age, p.common_fee, p.juristic,
    p.flood, p.resident_persona, p.pros, p.cons, p.closing_price,
  ];
  const filled = fields.filter((v) => v != null && v !== "").length;
  return Math.round((filled / fields.length) * 100);
}
