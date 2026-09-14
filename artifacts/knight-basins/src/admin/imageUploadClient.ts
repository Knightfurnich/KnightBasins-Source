export type ImageUploadRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function responseUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const url = (payload as { url?: unknown }).url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export async function uploadImageFile(
  file: File,
  request: ImageUploadRequest = fetch,
) {
  return uploadMediaFile(file, "/api/admin/upload", request, "อัปโหลดรูปภาพไม่สำเร็จ");
}

export async function uploadVideoFile(
  file: File,
  request: ImageUploadRequest = fetch,
) {
  return uploadMediaFile(file, "/api/admin/upload/video", request, "อัปโหลดวิดีโอไม่สำเร็จ");
}

async function uploadMediaFile(
  file: File,
  endpoint: string,
  request: ImageUploadRequest,
  fallbackMessage: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await request(endpoint, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  const url = responseUrl(payload);

  if (!response.ok || !url) {
    const message =
      payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : fallbackMessage;
    throw new Error(message);
  }

  return url;
}