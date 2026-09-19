import { redirect } from "next/navigation";

// The desk is three pages now, one per job, each with its own sidebar entry (Ben,
// 2026-09-19). /support itself — the home Listing Support lands on — opens the first.
export default function SupportIndex() {
  redirect("/support/new");
}
