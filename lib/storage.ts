import { supabase } from "./supabase";

const BUCKET = "documents";

/**
 * Uploads a file to the private "documents" Supabase Storage bucket and
 * returns its object path (not a permanent URL — the bucket is private, so
 * viewing later requires a short-lived signed URL via getDocumentSignedUrl).
 * There is no local-only fallback: this feature only exists when cloud sync
 * is configured, since the file itself has nowhere else to live.
 */
export async function uploadDocumentFile(
  file: File
): Promise<{ path: string } | { error: string }> {
  if (!supabase) return { error: "Cloud sync is not configured." };

  const ext = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return { error: error.message };
  return { path };
}

/** A short-lived URL for viewing/downloading a document; null if unavailable. */
export async function getDocumentSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

/** Removes the underlying file from Storage (best-effort; errors are swallowed). */
export async function deleteDocumentFile(path: string): Promise<void> {
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
