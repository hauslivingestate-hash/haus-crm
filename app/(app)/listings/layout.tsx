/* Second render slot for the listings list — see app/(app)/leads/layout.tsx, same shape
   and same reasoning. Scoped here so a listing opened from a lead's "ทรัพย์ที่สนใจ" card
   gets the full page, not a drawer floating over an unrelated screen. */
export default function ListingsLayout({
  children,
  drawer,
}: {
  children: React.ReactNode;
  drawer: React.ReactNode;
}) {
  return (
    <>
      {children}
      {drawer}
    </>
  );
}
