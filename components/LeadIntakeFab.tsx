"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { useRbac } from "@/components/RbacProvider";
import { useOpenedDraft, useParseQueue } from "@/components/ParseQueueProvider";
import { LeadForm, type AgentOption } from "@/components/LeadForm";
import { leadDraftOf } from "@/lib/ai/types";

// Lead-intake FAB — for whoever receives leads across channels and logs them. Gated to
// leads.create (Admin / Listing Support / Sales Leader / CEO).
//
// This is the ONLY intake FAB (CEO feedback R1: "FAB เหลือแค่เพิ่มลีด"). Positioning lives
// in FabDock, which owns the whole bottom-right stack — this renders a button, not a
// floating one, so the AI tray above it can share the column.
//
// It is ALSO the single host of LeadForm for the app. An AI draft reviewed from the tray
// opens this same form rather than a second copy of it: two mounts of one modal is how the
// add and edit listing screens drifted apart, and there is no reason to repeat that here.
export function LeadIntakeFab({ agents }: { agents: AgentOption[] }) {
  const { can, currentUser } = useRbac();
  const { clearOpened, close } = useParseQueue();
  const reviewing = useOpenedDraft("lead");
  const [open, setOpen] = React.useState(false);
  // Whether the draft currently under review actually became a lead. Read on dismiss.
  const [savedDraft, setSavedDraft] = React.useState(false);

  // A new draft arriving resets the flag — otherwise the second draft of a session would
  // inherit the first one's outcome and be marked `saved` without ever being submitted.
  React.useEffect(() => {
    if (reviewing) setSavedDraft(false);
    // Keyed on the ID alone, not the whole job: the poll replaces the object on every
    // tick, and depending on it would reset the flag a saver had just set.
  }, [reviewing?.id]);

  if (!can("leads.create")) return null;
  const mode = can("leads.assign") ? "admin" : "rep";

  // A draft handed over from the tray opens the form and fills it; the FAB opens it empty.
  const showing = open || !!reviewing;

  /* THE JOB IS CONSUMED ON DISMISS, NOT ON SAVE.
     Closing it at the moment of saving looked right and was wrong: consuming clears
     `opened`, which unmounts this form, which throws away the "บันทึกลีด L-123 แล้ว"
     confirmation the person was about to read. So the save only records WHAT happened and
     the decision is made here, when the form is actually being put away.

     Dismissing WITHOUT having saved does not discard — the draft stays in the tray, because
     closing a form is not the same as throwing its contents away. */
  const dismiss = () => {
    setOpen(false);
    if (!reviewing) return;
    if (savedDraft) void close(reviewing.id, "saved");
    else clearOpened();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="เพิ่มลีด"
        className="inline-flex items-center gap-2 rounded-full bg-accent text-text-onaccent h-12 pl-4 pr-5 shadow-pop hover:bg-accent-hover transition-colors font-medium"
      >
        <UserPlus size={18} strokeWidth={2.25} /> เพิ่มลีด
      </button>
      <LeadForm
        open={showing}
        mode={mode}
        createdBy={currentUser.name}
        agents={agents}
        draft={leadDraftOf(reviewing)}
        draftNote={reviewing?.note ?? null}
        onClose={dismiss}
        onCreated={() => setSavedDraft(true)}
      />
    </>
  );
}
