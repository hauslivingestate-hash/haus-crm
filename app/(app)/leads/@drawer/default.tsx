/* What the drawer slot renders when no lead is open — which is every URL under /leads
   except an intercepted /leads/:id, plus every hard load of one.

   Required, not optional: Next renders default.tsx for slots that do not match the
   current URL on a full page load, and returns a 404 when the file is missing. Without
   it, refreshing on /leads/L26-322 would 404 instead of showing the full page. */
export default function NoDrawer() {
  return null;
}
