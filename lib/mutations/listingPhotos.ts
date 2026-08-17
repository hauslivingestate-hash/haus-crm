"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { MAX_PHOTOS_PER_LISTING } from "@/lib/imageCompress";

// รูปทรัพย์ — `main_8_listing_photo` + the `listing-photos` storage bucket.
//
// The FILE goes straight from the browser to Storage (see ListingPhotoManager): pushing a
// few MB through a server action would double the transfer and hit the body-size limit.
// These actions record and remove the ROW, and delete the object when the row goes.

type Result = { ok: true } | { ok: false; error: string };

async function requireEdit(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  // Same set the table's own policies ask for.
  if (
    !(
      perms.has("listings.edit") ||
      perms.has("listings.marketing") ||
      perms.has("listings.create") ||
      perms.has("roles.manage")
    )
  ) {
    return { error: "ไม่มีสิทธิ์แก้รูปทรัพย์" };
  }
  return { employeeCode: auth.employeeCode };
}

function done(listingId: string) {
  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/company-listings");
}

/** Record a photo that the browser has already put in the bucket. */
export async function addListingPhoto(listingId: string, storagePath: string): Promise<Result> {
  const auth = await requireEdit();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!storagePath.startsWith(`${listingId}/`)) {
    // The path is generated client-side; refuse anything filed under another listing.
    return { ok: false, error: "เส้นทางไฟล์ไม่ตรงกับทรัพย์นี้" };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("main_8_listing_photo")
    .select("photo_id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if ((count ?? 0) >= MAX_PHOTOS_PER_LISTING) {
    return { ok: false, error: `ทรัพย์นี้มีรูปครบ ${MAX_PHOTOS_PER_LISTING} รูปแล้ว` };
  }

  const { data: { publicUrl } } = supabase.storage
    .from("listing-photos")
    .getPublicUrl(storagePath);

  const { error } = await supabase.from("main_8_listing_photo").insert({
    listing_id: listingId,
    photo_url: publicUrl,
    sort_order: (count ?? 0) + 1,
  });
  if (error) {
    // The row failed, so the object it points at is now orphaned — clean it up rather than
    // leaving it billing against the 1 GB quota with nothing referencing it.
    await supabase.storage.from("listing-photos").remove([storagePath]);
    return { ok: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    entity: "main_8_listing_photo",
    entity_id: listingId,
    action: "add_photo",
    changed_by: auth.employeeCode,
    before: {},
    after: { path: storagePath },
  });

  done(listingId);
  return { ok: true };
}

export async function deleteListingPhoto(photoId: number): Promise<Result> {
  const auth = await requireEdit();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("main_8_listing_photo")
    .select("photo_id,listing_id,photo_url")
    .eq("photo_id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "ไม่พบรูปนี้" };

  const { error } = await supabase
    .from("main_8_listing_photo")
    .delete()
    .eq("photo_id", photoId);
  if (error) return { ok: false, error: error.message };

  // Drop the file too. Derived from the public URL, which always ends
  // /object/public/listing-photos/<path>.
  const marker = "/listing-photos/";
  const at = (photo.photo_url as string).indexOf(marker);
  if (at >= 0) {
    const path = (photo.photo_url as string).slice(at + marker.length);
    await supabase.storage.from("listing-photos").remove([path]);
  }

  await supabase.from("audit_log").insert({
    entity: "main_8_listing_photo",
    entity_id: photo.listing_id as string,
    action: "delete_photo",
    changed_by: auth.employeeCode,
    before: { photo_url: photo.photo_url },
    after: {},
  });

  done(photo.listing_id as string);
  return { ok: true };
}

/** Make one photo the cover — it is simply the one with the lowest sort_order. */
export async function setListingCover(photoId: number): Promise<Result> {
  const auth = await requireEdit();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("main_8_listing_photo")
    .select("photo_id,listing_id")
    .eq("photo_id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "ไม่พบรูปนี้" };

  const { data: siblings } = await supabase
    .from("main_8_listing_photo")
    .select("photo_id")
    .eq("listing_id", photo.listing_id)
    .order("sort_order")
    .order("photo_id");

  // Renumber the whole set so there is exactly one photo at position 1.
  const ordered = [
    photoId,
    ...((siblings ?? []) as { photo_id: number }[])
      .map((p) => p.photo_id)
      .filter((id) => id !== photoId),
  ];
  for (let i = 0; i < ordered.length; i++) {
    await supabase
      .from("main_8_listing_photo")
      .update({ sort_order: i + 1 })
      .eq("photo_id", ordered[i]);
  }

  done(photo.listing_id as string);
  return { ok: true };
}
