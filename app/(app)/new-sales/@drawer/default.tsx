/* What the drawer slot renders when nobody is open — every URL under /new-sales except an
   intercepted /new-sales/:code, plus every hard load of one.

   Required, not optional: Next renders default.tsx for slots that do not match the current
   URL on a full page load, and 404s when the file is missing. Without it, refreshing on
   /new-sales/S-006 would 404 instead of showing the full page. */
export default function NoDrawer() {
  return null;
}
