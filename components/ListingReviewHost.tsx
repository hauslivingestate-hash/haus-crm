"use client";

import * as React from "react";
import { useRbac } from "@/components/RbacProvider";
import { useOpenedDraft, useParseQueue } from "@/components/ParseQueueProvider";
import { ListingForm } from "@/components/ListingForm";
import { listingDraftOf } from "@/lib/ai/types";

/* Where a parsed LISTING draft gets reviewed, wherever you happen to be standing.
 *
 * Leads did not need this — LeadForm is already mounted app-wide by LeadIntakeFab, so the
 * tray hands its draft straight to it. ListingForm is not: it belongs to the + เพิ่มทรัพย์
 * button on the ทรัพย์ page, and a listing parsed while reading /leads would have nowhere to
 * open. Mounting a second host in the shell is what keeps "review it from any page" true.
 *
 * It renders nothing at all until a listing draft is opened, so it costs one null check per
 * render on every other page.
 */
export function ListingReviewHost() {
  const { can, currentUser } = useRbac();
  const { clearOpened, close } = useParseQueue();
  const reviewing = useOpenedDraft("listing");
  const [savedDraft, setSavedDraft] = React.useState(false);

  // A new draft arriving resets the flag — otherwise the second draft of a session would
  // inherit the first one's outcome and be marked `saved` without ever being submitted.
  React.useEffect(() => {
    if (reviewing) setSavedDraft(false);
    // Keyed on the ID alone, not the whole job: the poll replaces the object on every
    // tick, and depending on it would reset the flag a saver had just set.
  }, [reviewing?.id]);

  if (!reviewing || !can("listings.create")) return null;

  /* Consumed on DISMISS, not on save — see the same note in LeadIntakeFab. Closing the job
     clears `opened`, which unmounts this component, which would throw away the
     "เพิ่มทรัพย์แล้ว · รหัส CAS001" line the person was about to read. */
  const dismiss = () => {
    if (savedDraft) void close(reviewing.id, "saved");
    else clearOpened();
  };

  return (
    <ListingForm
      open
      ownerName={currentUser.name}
      draft={listingDraftOf(reviewing)}
      draftNote={reviewing.note}
      onClose={dismiss}
      onCreated={() => setSavedDraft(true)}
    />
  );
}
