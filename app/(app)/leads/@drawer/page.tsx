/* Closes the drawer when the router lands back on /leads.

   Parallel slots keep showing their last match on client-side navigation, so without a
   /leads entry of its own the slot would still be holding the lead it was opened with —
   the panel staying on screen after Back. Matching the list URL to null is what empties
   it. */
export default function DrawerClosed() {
  return null;
}
