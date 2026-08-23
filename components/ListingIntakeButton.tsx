"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { useRbac } from "@/components/RbacProvider";
import { ListingForm } from "@/components/ListingForm";

// Topbar action for the listings page. Gated to listings.create — creating listings is Sales'
// job (not Listing Support, who edits/markets existing ones).
//
// No `agents` prop any more: the listing is filed under whoever is adding it, so the form
// only needs their name to show.
export function ListingIntakeButton() {
  const { can, currentUser } = useRbac();
  const [open, setOpen] = React.useState(false);

  if (!can("listings.create")) return null;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>+ เพิ่มทรัพย์</Button>
      <ListingForm open={open} onClose={() => setOpen(false)} ownerName={currentUser.name} />
    </>
  );
}
