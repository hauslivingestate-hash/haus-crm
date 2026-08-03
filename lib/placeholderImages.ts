/**
 * PREVIEW ONLY — temporary fake listing imagery.
 *
 * HAUS has no real listing photos wired to storage yet. This module hands out
 * deterministic placeholder photos so we can see how the listing surfaces look
 * with imagery. A given listing_id always maps to the same photo(s), so the UI
 * stays stable across refreshes.
 *
 * When real photo storage lands: delete this file and replace the call sites
 * (ListingsBrowser `Cover`, the listing detail gallery) with the real URLs.
 * Grep for `placeholderImages` to find every consumer.
 */

// Curated real-estate photos (hotlinked from Unsplash — no attribution config
// needed for a preview). Mix of exteriors and interiors.
const POOL = [
  "photo-1568605114967-8130f3a36994", // modern house exterior
  "photo-1512917774080-9991f1c4c750", // white modern house
  "photo-1570129477492-45c003edd2be", // suburban house
  "photo-1580587771525-78b9dba3b914", // villa exterior
  "photo-1600596542815-ffad4c1539a9", // contemporary home
  "photo-1600585154340-be6161a56a0c", // bright interior
  "photo-1600607687939-ce8a6c25118c", // living room
  "photo-1600566753086-00f18fb6b3ea", // bedroom
  "photo-1600210492486-724fe5c67fb0", // open-plan living
  "photo-1600047509807-ba8f99d2cdde", // condo interior
  "photo-1502672260266-1c1ef2d93688", // apartment interior
  "photo-1522708323590-d24dbb6b0267", // cozy living room
];

/** Stable non-crypto hash so a listing_id maps to the same photos every render. */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function url(photoId: string, w: number): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&q=70`;
}

/** Deterministic cover photo for a listing. */
export function listingCoverImage(listingId: string, w = 200): string {
  return url(POOL[hash(listingId) % POOL.length], w);
}

/** Deterministic gallery — `count` distinct photos, starting from the cover. */
export function listingGallery(listingId: string, count = 5, w = 1200): string[] {
  const start = hash(listingId) % POOL.length;
  return Array.from({ length: Math.min(count, POOL.length) }, (_, i) =>
    url(POOL[(start + i) % POOL.length], w)
  );
}
