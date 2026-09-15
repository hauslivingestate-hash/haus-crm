/** Whose revenue target a card or form is about.
 *
 * One form (components/dashboard/RevenueTargetForm) and one card (TargetRevenueCard) serve
 * both a salesperson's number and a team's. They differ only in which server action the
 * save goes to, and this is the value that decides it. Client-safe: types only. */
export type TargetScope =
  | { kind: "employee"; employeeCode: string }
  | { kind: "team"; teamId: string };
