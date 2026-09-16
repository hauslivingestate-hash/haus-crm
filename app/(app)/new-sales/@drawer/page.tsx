/* Closes the drawer when the router lands back on /new-sales.

   Parallel slots keep showing their last match across client-side navigation, so without a
   /new-sales entry of its own the slot would still hold the agent it was opened with —
   the panel staying on screen after Back. Matching the list URL to null is what empties it. */
export default function DrawerClosed() {
  return null;
}
