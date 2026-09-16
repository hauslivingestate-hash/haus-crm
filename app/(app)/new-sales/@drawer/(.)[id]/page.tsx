import { notFound } from "next/navigation";
import { NewSalesDetail } from "@/components/NewSalesDetail";
import { getEmployees, getProbationTallies, getAgentActivities } from "@/lib/queries";

/* The intercepted /new-sales/:code — the drawer's contents. The panel itself is layout.tsx.

   `(.)` matches a segment at the same level as this slot's parent. Slots are not route
   segments, so @drawer does not count as a level: /(app)/new-sales/@drawer/(.)[id]
   resolves to /new-sales/[id].

   The fetch is duplicated from the full page rather than shared, which is deliberate: they
   are two server components with the same body, and the only alternative — a helper that
   both call — would save four lines and hide which of them is allowed to notFound(). The
   RENDERED content is what must not diverge, and that is <NewSalesDetail />, shared. */
export default async function NewSalesDrawer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const code = decodeURIComponent(id);
  const employees = await getEmployees();
  const employee = employees.find((e) => e.code === code);
  if (!employee || !employee.probationStart || employee.probationPassedAt) notFound();

  const [tallies, activities] = await Promise.all([
    getProbationTallies([{ code: employee.code, probationStart: employee.probationStart }]),
    getAgentActivities(employee.code),
  ]);

  return (
    <NewSalesDetail
      employeeCode={employee.code}
      employees={employees}
      tallies={tallies}
      activities={activities}
      inDrawer
    />
  );
}
