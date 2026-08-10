import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// Real reassignment history, read from audit_log — replaces the in-memory trail that used to
// live in NewLeadsProvider and vanished on every refresh.

export interface AssignHistoryEntry {
  at: string; // ISO datetime
  from: string | null; // null = was unassigned
  to: string | null; // null = unassigned
  by: string; // employee_code of whoever made the change
}

/**
 * Reassignments for one lead, newest first.
 *
 * `readable` is NOT the same as "empty": audit_log is only selectable by roles.manage, so
 * anyone else gets zero rows back from RLS. Returning that as an empty history would state,
 * falsely, that a lead was never reassigned — so the caller is told it could not read rather
 * than being handed a misleading blank.
 */
export async function getAssignHistory(
  leadId: string
): Promise<{ readable: boolean; entries: AssignHistoryEntry[] }> {
  const auth = await getAuthContext();
  if (!auth?.permissions.includes("roles.manage")) return { readable: false, entries: [] };

  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("before,after,changed_by,created_at")
    .eq("entity", "main_6_buyer_crm")
    .eq("entity_id", leadId)
    .eq("action", "assign")
    .order("created_at", { ascending: false });

  const entries = ((data ?? []) as {
    before: { sale_id?: string | null } | null;
    after: { sale_id?: string | null } | null;
    changed_by: string;
    created_at: string;
  }[]).map((r) => ({
    at: r.created_at,
    from: r.before?.sale_id ?? null,
    to: r.after?.sale_id ?? null,
    by: r.changed_by,
  }));

  return { readable: true, entries };
}
