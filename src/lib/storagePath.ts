const BUCKET_ID = "pratiche-files";

/**
 * Returns the storage object path for bucket pratiche-files from a stored file_url.
 * file_url can be:
 * - Full signed URL: https://.../object/sign/pratiche-files/userId/.../file.pdf?token=...
 * - Relative path: userId/file.pdf or userId/praticaId/file.pdf
 * RLS requires the path to start with user_id (first segment).
 */
export function getPraticheFilesStoragePath(fileUrl: string | null | undefined): string {
  if (!fileUrl?.trim()) return "";
  const url = fileUrl.trim();
  const bucketPrefix = `${BUCKET_ID}/`;
  const idx = url.indexOf(bucketPrefix);
  if (idx !== -1) {
    const after = url.slice(idx + bucketPrefix.length);
    const path = after.split("?")[0].replace(/^\/+|\/+$/g, "");
    return path || url;
  }
  if (url.startsWith("http")) {
    const segments = url.split("/");
    const bucketIdx = segments.findIndex((s) => s === BUCKET_ID);
    if (bucketIdx !== -1 && segments[bucketIdx + 1])
      return segments.slice(bucketIdx + 1).join("/").split("?")[0].replace(/^\/+|\/+$/g, "") || url;
    return segments.slice(-2).join("/").split("?")[0] || url;
  }
  return url.replace(/^\/+|\/+$/g, "");
}
