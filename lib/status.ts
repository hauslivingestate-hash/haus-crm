// listing_status -> dot color token (status = dot + text)
const LISTING_STATUS_DOT: Record<string, string> = {
  Posted: "bg-green",
  "Ready to Post": "bg-amber",
  Update: "bg-blue",
  "Need Info": "bg-amber",
  Cancel: "bg-red",
  "Cancel Completed": "bg-text-subtle",
  Sold: "bg-accent",
  "Sold Completed": "bg-text-subtle",
};

export function listingStatusDot(status: string | null | undefined): string {
  return (status && LISTING_STATUS_DOT[status]) || "bg-text-subtle";
}

// lead_status -> dot color
const LEAD_STATUS_DOT: Record<string, string> = {
  Active: "bg-blue",
  Win: "bg-green",
  Lose: "bg-red",
  Reject: "bg-text-subtle",
};

export function leadStatusDot(status: string | null | undefined): string {
  return (status && LEAD_STATUS_DOT[status]) || "bg-text-subtle";
}
