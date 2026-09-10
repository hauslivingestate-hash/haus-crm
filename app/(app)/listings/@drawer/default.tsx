/* Empty drawer slot. Required: Next 404s a full page load when a slot has no match and
   no default.tsx — without this, refreshing on /listings/HBGY005 would 404. */
export default function NoDrawer() {
  return null;
}
